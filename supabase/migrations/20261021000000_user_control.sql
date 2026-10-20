/*
  User control (modelled on finance_manager's /admin/staff-logins, minus roles).

  - app_users            one row per login: username, per-user section access
                         and notification choices. The owner (shrikavin) has
                         everything and is the only one allowed into User control.
  - app_user_secrets     encrypted copy of each password so the owner can reveal
                         it. Never readable from the browser.
  - app_settings         business-wide switches (notifications.global).
  - audit_log            who changed which login, and when.
  - kbs_can()            permission check used by RLS on rental_records/jcb_records.
  - admin_* functions    list / revoke Supabase Auth sessions; service role only.
  - resolve_login_email  username -> email for the login form.

  Every login that already exists keeps full access, so nothing breaks the
  moment this runs. admin@kbstractors.com becomes username "bhaskaran".
*/

-- ── Users ────────────────────────────────────────────────────────────────────

create table if not exists public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z]{3,32}$'),
  name text not null,
  phone text,
  is_owner boolean not null default false,
  login_enabled boolean not null default true,
  access jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_single_owner on public.app_users (is_owner) where is_owner;

alter table public.app_users enable row level security;

drop policy if exists app_users_read_self on public.app_users;
create policy app_users_read_self on public.app_users
  for select to authenticated
  using (id = (select auth.uid()));

-- Writes go through /api/user-control (service role) only.
revoke insert, update, delete on public.app_users from anon, authenticated;

alter table public.app_users replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.app_users;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.app_user_secrets (
  user_id uuid primary key references public.app_users (id) on delete cascade,
  password_cipher text,
  password_set_at timestamptz,
  password_set_by text
);
alter table public.app_user_secrets enable row level security;
revoke all on public.app_user_secrets from anon, authenticated;

-- ── Settings + audit ─────────────────────────────────────────────────────────

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text not null,
  action text not null,
  target_id uuid,
  target_name text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- ── Backfill existing logins with full access ────────────────────────────────

do $$
declare
  u record;
  base text;
  candidate text;
  n int;
begin
  for u in select id, email from auth.users where id not in (select id from public.app_users) loop
    if lower(u.email) = 'admin@kbstractors.com' then
      base := 'bhaskaran';
    elsif lower(u.email) = 'shrikavinkbs@gmail.com' then
      base := 'shrikavin';
    else
      base := left(regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z]', '', 'g'), 28);
    end if;
    if length(base) < 3 then
      base := 'user';
    end if;
    -- Usernames are letters only, so de-duplicate with a letter suffix (userb, userc, …).
    candidate := base;
    n := 0;
    while exists (select 1 from public.app_users where username = candidate) loop
      n := n + 1;
      candidate := base || chr(97 + (n % 26)) || repeat('z', n / 26);
    end loop;

    insert into public.app_users (id, username, name, is_owner, access, notifications)
    values (
      u.id,
      candidate,
      case
        when lower(u.email) = 'admin@kbstractors.com' then 'Bhaskaran'
        when lower(u.email) = 'shrikavinkbs@gmail.com' then 'Shrikavin'
        else initcap(base)
      end,
      lower(u.email) = 'shrikavinkbs@gmail.com',
      '{"tractor":["read","create","update","delete","collect"],"jcb":["read","create","update","delete"]}'::jsonb,
      '["tractor","collection","jcb","reminders","session"]'::jsonb
    );
  end loop;
end $$;

-- ── Permission check + RLS on business tables ────────────────────────────────

create or replace function public.kbs_can(p_section text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.login_enabled
       and (u.is_owner or coalesce(u.access -> p_section, '[]'::jsonb) ? p_action)
    from public.app_users u
    where u.id = (select auth.uid())
  ), false);
$$;

revoke execute on function public.kbs_can(text, text) from public, anon;
grant execute on function public.kbs_can(text, text) to authenticated;

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('rental_records', 'jcb_records')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy rental_read on public.rental_records
  for select to authenticated using (public.kbs_can('tractor', 'read'));
create policy rental_create on public.rental_records
  for insert to authenticated with check (public.kbs_can('tractor', 'create'));
create policy rental_update on public.rental_records
  for update to authenticated
  using (public.kbs_can('tractor', 'update') or public.kbs_can('tractor', 'collect'))
  with check (public.kbs_can('tractor', 'update') or public.kbs_can('tractor', 'collect'));
create policy rental_delete on public.rental_records
  for delete to authenticated using (public.kbs_can('tractor', 'delete'));

-- A collect-only login may raise received_amount (and settle an old balance),
-- nothing else.
create or replace function public.rental_collect_only_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.kbs_can('tractor', 'update') then
    return new;
  end if;
  if (to_jsonb(new) - 'received_amount' - 'old_balance_status')
       is distinct from (to_jsonb(old) - 'received_amount' - 'old_balance_status')
     or new.received_amount < old.received_amount then
    raise exception 'This login can only record collections.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists rental_collect_only_guard on public.rental_records;
create trigger rental_collect_only_guard
  before update on public.rental_records
  for each row execute function public.rental_collect_only_guard();

create policy jcb_read on public.jcb_records
  for select to authenticated using (public.kbs_can('jcb', 'read'));
create policy jcb_create on public.jcb_records
  for insert to authenticated with check (public.kbs_can('jcb', 'create'));
create policy jcb_update on public.jcb_records
  for update to authenticated
  using (public.kbs_can('jcb', 'update'))
  with check (public.kbs_can('jcb', 'update'));
create policy jcb_delete on public.jcb_records
  for delete to authenticated using (public.kbs_can('jcb', 'delete'));

-- ── Login + sessions ─────────────────────────────────────────────────────────

-- Public by necessity: the login form only has a username.
create or replace function public.resolve_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select au.email::text
  from public.app_users u
  join auth.users au on au.id = u.id
  where u.username = lower(trim(p_username))
  limit 1;
$$;

revoke execute on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

create or replace function public.admin_list_sessions()
returns table (
  id uuid,
  user_id uuid,
  created_at timestamptz,
  last_seen_at timestamptz,
  user_agent text,
  ip text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.user_id,
         s.created_at,
         coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at),
         s.user_agent,
         host(s.ip)
  from auth.sessions s;
$$;

create or replace function public.admin_revoke_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.refresh_tokens where session_id = p_session;
  delete from auth.sessions where id = p_session;
end;
$$;

create or replace function public.admin_revoke_user_sessions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.refresh_tokens where session_id in (select id from auth.sessions where user_id = p_user);
  delete from auth.sessions where user_id = p_user;
end;
$$;

revoke execute on function public.admin_list_sessions() from public, anon, authenticated;
revoke execute on function public.admin_revoke_session(uuid) from public, anon, authenticated;
revoke execute on function public.admin_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_sessions() to service_role;
grant execute on function public.admin_revoke_session(uuid) to service_role;
grant execute on function public.admin_revoke_user_sessions(uuid) to service_role;

-- ── Notifications: who caused it, so they aren't pushed their own change ─────

alter table public.app_notifications
  add column if not exists actor_id uuid default auth.uid();
alter table public.app_notifications
  add column if not exists origin_endpoint text;

create or replace function public.handle_app_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id bigint;
  webhook_secret text;
  push_url text;
begin
  select c.webhook_secret, c.push_url
    into webhook_secret, push_url
  from public.app_push_config c
  where c.id = 1;

  if webhook_secret is null or webhook_secret = '' then
    return NEW;
  end if;

  if push_url is null or push_url = '' then
    push_url := 'https://kbstractors.vercel.app/api/send-push';
  end if;

  select net.http_post(
    url := push_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'title', NEW.title,
      'body', NEW.body,
      'notification_id', NEW.id::text,
      'kind', NEW.kind,
      'actor_id', NEW.actor_id,
      'exclude_endpoint', NEW.origin_endpoint
    )
  ) into request_id;

  return NEW;
exception when others then
  return NEW;
end;
$$;

notify pgrst, 'reload schema';

/*
  Daily summary (9:30 PM IST) + payment-reduced tracking.

  1. money_events — one row every time an entry's received amount changes
     (Collect, an edit, a JCB payment). Logged by a trigger, so every path is
     covered. received_amount itself is a running total; this ledger is what
     lets the summary say "₹18,500 collected today" and flag money that was
     taken back out.
  2. pg_cron job at 16:00 UTC = 21:30 IST calls /api/daily-summary with the
     same webhook secret the push trigger uses (app_push_config).
  3. The owner gets the new "summary" notification type switched on; other
     logins can be opted in from User control.

  Needs app_push_config.webhook_secret to be set (already required for push).
*/

-- ── 1. Ledger of received-amount changes ────────────────────────────────────

create table if not exists public.money_events (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('rental', 'jcb')),
  record_id uuid not null,
  record_name text,
  delta numeric not null,
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists money_events_created_idx on public.money_events (created_at desc);

alter table public.money_events enable row level security;
revoke all on public.money_events from anon, authenticated;

create or replace function public.log_money_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_rental boolean := TG_TABLE_NAME = 'rental_records';
  col text := case when TG_TABLE_NAME = 'rental_records' then 'received_amount' else 'amount_received' end;
  old_amount numeric := 0;
  new_amount numeric;
  row_name text;
begin
  -- An "old balance only" entry saved as already paid is history being
  -- recorded, not money collected today.
  if TG_OP = 'INSERT' and jsonb_array_length(coalesce(to_jsonb(new) -> 'details', '[]'::jsonb)) = 0 then
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    old_amount := coalesce((to_jsonb(old) ->> col)::numeric, 0);
  end if;
  new_amount := coalesce((to_jsonb(new) ->> col)::numeric, 0);
  if new_amount = old_amount then
    return new;
  end if;

  row_name := case
    when is_rental then to_jsonb(new) ->> 'name'
    else coalesce(nullif(to_jsonb(new) ->> 'driver_name', ''), to_jsonb(new) ->> 'company_name')
  end;

  insert into public.money_events (entity, record_id, record_name, delta, actor_id)
  values (case when is_rental then 'rental' else 'jcb' end, new.id, row_name, new_amount - old_amount, auth.uid());
  return new;
exception when others then
  -- Never block saving an entry because the ledger write failed.
  return new;
end;
$$;

drop trigger if exists rental_money_event on public.rental_records;
create trigger rental_money_event
  after insert or update on public.rental_records
  for each row execute function public.log_money_event();

drop trigger if exists jcb_money_event on public.jcb_records;
create trigger jcb_money_event
  after insert or update on public.jcb_records
  for each row execute function public.log_money_event();

-- ── 2. 9:30 PM IST schedule ─────────────────────────────────────────────────

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.trigger_daily_summary()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  base_url text;
begin
  select c.webhook_secret, c.push_url into secret, base_url from public.app_push_config c where c.id = 1;
  if secret is null or secret = '' then
    return;
  end if;
  base_url := coalesce(nullif(base_url, ''), 'https://kbstractors.vercel.app/api/send-push');
  perform net.http_post(
    url := regexp_replace(base_url, '/api/[^/]+$', '/api/daily-summary'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.trigger_daily_summary() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('kbs-daily-summary');
exception when others then
  null; -- not scheduled yet
end $$;

-- pg_cron runs in UTC: 16:00 UTC = 21:30 IST.
select cron.schedule('kbs-daily-summary', '0 16 * * *', 'select public.trigger_daily_summary();');

-- ── 3. Owner receives the summary ───────────────────────────────────────────

update public.app_users
set notifications = notifications || '["summary"]'::jsonb
where is_owner and not (notifications ? 'summary');

notify pgrst, 'reload schema';

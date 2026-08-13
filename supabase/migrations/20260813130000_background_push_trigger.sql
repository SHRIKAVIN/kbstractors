-- Server-side Web Push: fires when an app_notifications row is inserted.
-- Works even when the sender's app is closed (unlike client-only /api/send-push).
--
-- After running this migration:
-- 1. Reuse the existing Vercel CRON_SECRET (or set APP_PUSH_WEBHOOK_SECRET) in
--    Vercel → Settings → Environment Variables.
-- 2. SQL Editor → run (same secret as step 1):
--    insert into public.app_push_config (id, webhook_secret)
--    values (1, 'your-secret-here')
--    on conflict (id) do update set webhook_secret = excluded.webhook_secret;
-- 3. Deploy the updated /api/send-push (accepts x-push-secret).
-- 4. Optional (Expense Manager style): supabase secrets set VAPID_* APP_PUSH_WEBHOOK_SECRET
--    then supabase functions deploy send-app-push
--    and point push_url at the Edge Function.

create extension if not exists pg_net with schema extensions;

create table if not exists public.app_push_config (
  id int primary key default 1,
  webhook_secret text not null default '',
  push_url text not null default 'https://kbstractors.vercel.app/api/send-push',
  constraint app_push_config_singleton check (id = 1)
);

alter table public.app_push_config enable row level security;

insert into public.app_push_config (id, webhook_secret)
values (1, '')
on conflict (id) do nothing;

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
      'notification_id', NEW.id::text
    )
  ) into request_id;

  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists app_notification_push on public.app_notifications;
create trigger app_notification_push
  after insert on public.app_notifications
  for each row
  execute function public.handle_app_notification_push();

notify pgrst, 'reload schema';

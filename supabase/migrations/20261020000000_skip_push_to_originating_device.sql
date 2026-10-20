-- Don't push a CRUD alert back to the device that made the change.
--
-- The client stores its own Web Push endpoint in origin_endpoint when it
-- inserts an app_notifications row; the trigger forwards it to /api/send-push
-- as exclude_endpoint, which skips that one subscription. Rows without an
-- origin (e.g. the daily pending-reminders cron) still reach every device.

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
      'exclude_endpoint', NEW.origin_endpoint
    )
  ) into request_id;

  return NEW;
exception when others then
  return NEW;
end;
$$;

notify pgrst, 'reload schema';

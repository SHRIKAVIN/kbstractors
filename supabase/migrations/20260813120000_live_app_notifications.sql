/*
  Live notifications (same pattern as expense-manager):

  1. app_notifications — queue of alerts. The client inserts a row after
     rental/JCB create/update/delete. Open apps subscribe via Realtime.
  2. supabase_realtime — rental_records + jcb_records so dashboards refresh
     on other devices without a manual reload.
*/

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name text NOT NULL DEFAULT 'KBS',
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_created
  ON public.app_notifications (created_at DESC);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_notifications'
      AND policyname = 'app_notifications_select_authenticated'
  ) THEN
    CREATE POLICY app_notifications_select_authenticated
      ON public.app_notifications FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_notifications'
      AND policyname = 'app_notifications_insert_authenticated'
  ) THEN
    CREATE POLICY app_notifications_insert_authenticated
      ON public.app_notifications FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_records;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jcb_records;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

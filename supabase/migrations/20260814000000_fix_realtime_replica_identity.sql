-- Make live replication actually deliver row payloads, and relax RLS so
-- authenticated Realtime clients receive app_notifications inserts.

ALTER TABLE public.app_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER TABLE public.rental_records REPLICA IDENTITY FULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.jcb_records REPLICA IDENTITY FULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DROP POLICY IF EXISTS app_notifications_select_authenticated ON public.app_notifications;
CREATE POLICY app_notifications_select_authenticated
  ON public.app_notifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS app_notifications_insert_authenticated ON public.app_notifications;
CREATE POLICY app_notifications_insert_authenticated
  ON public.app_notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

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

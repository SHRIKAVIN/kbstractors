/*
  # Push notification support

  1. New Tables
    - `push_subscriptions` — one row per subscribed browser/device (Web Push / VAPID).
    - `notification_sent` — dedup log so the daily pending-payment digest doesn't
      re-send more than once per day.
  2. Security
    - RLS enabled on both, same "any authenticated user" policy already used for
      `rental_records` / `jcb_records` (this app has a single admin account).
    - The server-side Vercel functions use the Supabase service role key and bypass
      RLS entirely, so `notification_sent` needs no public policy.
*/

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'push_subscriptions'
        AND policyname = 'Allow authenticated users to manage push subscriptions'
    ) THEN
        CREATE POLICY "Allow authenticated users to manage push subscriptions" ON push_subscriptions
            FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS notification_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedup_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_sent ENABLE ROW LEVEL SECURITY;
-- No public policies: only the service-role key (used by /api/pending-reminders) touches this table.

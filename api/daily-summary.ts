import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { loadNotificationSettings } from '../server/push.js';
import { getJCBPending, getRentalPending } from '../src/utils/pending.js';
import { dailySummary } from '../src/lib/notificationTemplates.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (body: unknown) => Res };

function normalizeEnv(value?: string) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function header(req: Req, name: string): string {
  const value = req.headers?.[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** Today's IST date (YYYY-MM-DD) and the UTC instant IST midnight fell on. */
function istToday(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const dayKey = ist.toISOString().slice(0, 10);
  const startUtc = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
  return { dayKey, startIso: startUtc.toISOString() };
}

/**
 * 9:30 PM IST wrap-up of the day, scheduled by pg_cron in Supabase (see
 * 20261022000000_daily_summary.sql). Auth: the push webhook secret (what
 * pg_cron sends) or `Authorization: Bearer $CRON_SECRET` for a manual run.
 * Sends at most once per IST day; `?force=1` re-sends (for testing).
 */
export default async function handler(req: Req, res: Res) {
  const cronSecret = normalizeEnv(process.env.CRON_SECRET);
  const webhookSecret = normalizeEnv(process.env.APP_PUSH_WEBHOOK_SECRET || process.env.CRON_SECRET);
  const pushSecret = header(req, 'x-push-secret');
  const bearer = header(req, 'authorization');
  const authorized =
    (webhookSecret && pushSecret === webhookSecret) || (cronSecret && bearer === `Bearer ${cronSecret}`);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseUrl = normalizeEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const settings = await loadNotificationSettings(admin);
  if (!settings.push || !settings.summary) {
    return res.status(200).json({ ok: true, skipped: 'Daily summary is turned off.' });
  }

  const { dayKey, startIso } = istToday();
  const force = String(req.query?.force ?? '') === '1';

  try {
    if (!force) {
      const { data: fresh, error: dedupErr } = await admin
        .from('notification_sent')
        .upsert({ dedup_key: `daily-summary:${dayKey}` }, { onConflict: 'dedup_key', ignoreDuplicates: true })
        .select('dedup_key');
      if (dedupErr) throw dedupErr;
      if (!fresh?.length) return res.status(200).json({ ok: true, skipped: `Already sent for ${dayKey}.` });
    }

    const [moneyRes, rentalsRes, jcbsRes, usersRes] = await Promise.all([
      admin.from('money_events').select('delta, actor_id').gte('created_at', startIso),
      admin.from('rental_records').select('total_amount, received_amount, old_balance_status, created_at, details'),
      admin.from('jcb_records').select('total_amount, amount_received, old_balance_status, created_at, details'),
      admin.from('app_users').select('id, name'),
    ]);
    if (moneyRes.error) throw moneyRes.error;
    if (rentalsRes.error) throw rentalsRes.error;
    if (jcbsRes.error) throw jcbsRes.error;

    type MoneyRow = { delta: number | string; actor_id: string | null };
    type EntryRow = { total_amount: number; created_at: string; details: unknown[] | null; old_balance_status: 'paid' | 'pending' | null };
    type RentalRow = EntryRow & { received_amount: number | null };
    type JcbRow = EntryRow & { amount_received: number | null };

    const names = new Map(((usersRes.data ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]));
    let collected = 0;
    let reduced = 0;
    const byActor = new Map<string, number>();
    for (const row of (moneyRes.data ?? []) as MoneyRow[]) {
      const delta = Number(row.delta) || 0;
      if (delta > 0) {
        collected += delta;
        const who = (row.actor_id && names.get(row.actor_id)) || 'Other';
        byActor.set(who, (byActor.get(who) ?? 0) + delta);
      } else {
        reduced += -delta;
      }
    }

    const rentals = (rentalsRes.data ?? []) as RentalRow[];
    const jcbs = (jcbsRes.data ?? []) as JcbRow[];
    // "New entries" = work added today, not old-balance-only records.
    const isNewWork = (r: EntryRow) => r.created_at >= startIso && Array.isArray(r.details) && r.details.length > 0;
    const newToday = [...rentals.filter(isNewWork), ...jcbs.filter(isNewWork)];
    const pendingOverall =
      rentals.reduce((sum, r) => sum + getRentalPending(r).amount, 0) + jcbs.reduce((sum, r) => sum + getJCBPending(r).amount, 0);

    const message = dailySummary({
      collected,
      reduced,
      newEntries: newToday.length,
      newEntriesTotal: newToday.reduce((sum, r) => sum + (r.total_amount || 0), 0),
      collectors: [...byActor.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      pendingOverall,
    });

    // Insert only — the app_notifications trigger delivers the push.
    const { error: insertErr } = await admin.from('app_notifications').insert({
      id: randomUUID(),
      actor_name: 'system',
      ...message,
    });
    if (insertErr) throw insertErr;

    return res.status(200).json({ ok: true, day: dayKey, ...message });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Daily summary failed.' });
  }
}

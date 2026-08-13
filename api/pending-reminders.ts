import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readVapidConfig, sendPushToAllSubscriptions } from '../server/push.js';
import { getRentalPending, getJCBPending } from '../src/utils/pending.js';
import { formatCurrency } from '../src/utils/calculations.js';

function normalizeEnv(value?: string) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

const DEADLINE_DAYS = 10;
// After the first nudge at 10 days overdue, re-nudge weekly (not daily) for as
// long as the record stays unpaid.
const REMINDER_INTERVAL_DAYS = 7;
const DIGEST_LIST_LIMIT = 6;

type Overdue = {
  id: string;
  entity: 'rental' | 'jcb';
  label: string;
  payer: string;
  amount: number;
  daysOld: number;
};

function daysOld(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  return Math.floor((now.getTime() - created) / 86400000);
}

/** 0 the day it first crosses DEADLINE_DAYS, 1 a week later, 2 the week after, etc. */
function cycleIndex(daysOverdue: number): number {
  return Math.floor((daysOverdue - DEADLINE_DAYS) / REMINDER_INTERVAL_DAYS);
}

function dedupKeyFor(o: Pick<Overdue, 'entity' | 'id' | 'daysOld'>): string {
  return `pending:${o.entity}:${o.id}:cycle:${cycleIndex(o.daysOld)}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = normalizeEnv(process.env.CRON_SECRET);
  if (cronSecret) {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const vapid = readVapidConfig();
  if (!vapid) {
    return res.status(503).json({ error: 'VAPID keys not configured on server.' });
  }

  const supabaseUrl = normalizeEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();
  const cutoff = new Date(now.getTime() - DEADLINE_DAYS * 86400000).toISOString();

  try {
    const [{ data: rentals, error: rentalErr }, { data: jcbs, error: jcbErr }] = await Promise.all([
      admin
        .from('rental_records')
        .select('id, name, total_amount, received_amount, old_balance_status, created_at')
        .lte('created_at', cutoff),
      admin
        .from('jcb_records')
        .select('id, company_name, driver_name, total_amount, amount_received, old_balance_status, created_at')
        .lte('created_at', cutoff),
    ]);
    if (rentalErr) throw rentalErr;
    if (jcbErr) throw jcbErr;

    const overdue: Overdue[] = [];

    for (const record of rentals ?? []) {
      const { amount, isPaid } = getRentalPending(record as any);
      if (isPaid || amount <= 0) continue;
      overdue.push({
        id: (record as any).id,
        entity: 'rental',
        label: 'rental',
        payer: (record as any).name || 'Unknown',
        amount,
        daysOld: daysOld((record as any).created_at, now),
      });
    }

    for (const record of jcbs ?? []) {
      const { amount, isPaid } = getJCBPending(record as any);
      if (isPaid || amount <= 0) continue;
      const payer = (record as any).driver_name || (record as any).company_name || 'Unknown';
      overdue.push({
        id: (record as any).id,
        entity: 'jcb',
        label: 'JCB',
        payer,
        amount,
        daysOld: daysOld((record as any).created_at, now),
      });
    }

    if (!overdue.length) {
      return res.status(200).json({ ok: true, overdue: 0, dueToday: 0 });
    }

    // Per-record dedup: only records crossing a new cycle boundary today (day 10,
    // then day 17, day 24, ...) get inserted — `ignoreDuplicates` + `.select()`
    // means the response only contains the keys that were actually new, so this
    // single upsert also tells us exactly which records are due for a nudge today.
    const candidates = overdue.map((o) => ({ dedup_key: dedupKeyFor(o) }));
    const { data: inserted, error: dedupErr } = await admin
      .from('notification_sent')
      .upsert(candidates, { onConflict: 'dedup_key', ignoreDuplicates: true })
      .select('dedup_key');
    if (dedupErr) throw dedupErr;

    const dueKeys = new Set((inserted ?? []).map((r: any) => r.dedup_key as string));
    const dueToday = overdue.filter((o) => dueKeys.has(dedupKeyFor(o)));

    if (!dueToday.length) {
      return res.status(200).json({ ok: true, overdue: overdue.length, dueToday: 0, skipped: 'no reminders due today' });
    }

    dueToday.sort((a, b) => b.daysOld - a.daysOld);

    const totalPending = dueToday.reduce((sum, o) => sum + o.amount, 0);
    const shown = dueToday.slice(0, DIGEST_LIST_LIMIT);
    const more = dueToday.length - shown.length;

    const lines = shown.map((o) => {
      const tag = o.label === 'JCB' ? '[JCB] ' : '';
      return `${tag}${o.payer} ${formatCurrency(o.amount)} (${o.daysOld}d)`;
    });
    if (more > 0) lines.push(`+${more} more`);

    const title = `⏰ ${dueToday.length} pending payment${dueToday.length === 1 ? '' : 's'} — 10+ days overdue`;
    const body = `${lines.join(' • ')} — Total ${formatCurrency(totalPending)}`;

    const notificationId = randomUUID();
    const result = await sendPushToAllSubscriptions(admin, vapid, title, body, notificationId);

    // Live clients pick this up via Realtime; the insert trigger also sends
    // background Web Push (same notification id, so the SW tag dedupes).
    const { error: liveErr } = await admin.from('app_notifications').insert({
      id: notificationId,
      actor_name: 'system',
      title,
      body,
      kind: 'pending_digest',
    });
    if (liveErr) console.warn('Live pending digest insert failed:', liveErr.message);

    return res.status(200).json({ ok: true, overdue: overdue.length, dueToday: dueToday.length, totalPending, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}

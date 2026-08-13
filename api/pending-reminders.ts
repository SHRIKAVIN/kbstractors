import { createClient } from '@supabase/supabase-js';
import { readVapidConfig, sendPushToAllSubscriptions } from '../server/push';
import { getRentalPending, getJCBPending } from '../src/utils/pending';
import { formatCurrency } from '../src/utils/calculations';

function normalizeEnv(value?: string) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

const DEADLINE_DAYS = 10;
const DIGEST_LIST_LIMIT = 6;

type Overdue = {
  label: string;
  payer: string;
  amount: number;
  daysOld: number;
};

function daysOld(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  return Math.floor((now.getTime() - created) / 86400000);
}

function todayUTC(now: Date): string {
  return now.toISOString().slice(0, 10);
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
      overdue.push({ label: 'JCB', payer, amount, daysOld: daysOld((record as any).created_at, now) });
    }

    if (!overdue.length) {
      return res.status(200).json({ ok: true, overdue: 0 });
    }

    overdue.sort((a, b) => b.daysOld - a.daysOld);

    const dedupKey = `pending-digest:${todayUTC(now)}`;
    const { error: dedupErr } = await admin.from('notification_sent').insert({ dedup_key: dedupKey });
    if (dedupErr?.code === '23505') {
      return res.status(200).json({ ok: true, skipped: 'already sent today', overdue: overdue.length });
    }
    if (dedupErr) throw dedupErr;

    const totalPending = overdue.reduce((sum, o) => sum + o.amount, 0);
    const shown = overdue.slice(0, DIGEST_LIST_LIMIT);
    const more = overdue.length - shown.length;

    const lines = shown.map((o) => {
      const tag = o.label === 'JCB' ? '[JCB] ' : '';
      return `${tag}${o.payer} ${formatCurrency(o.amount)} (${o.daysOld}d)`;
    });
    if (more > 0) lines.push(`+${more} more`);

    const title = `⏰ ${overdue.length} pending payment${overdue.length === 1 ? '' : 's'} — 10+ days overdue`;
    const body = `${lines.join(' • ')} — Total ${formatCurrency(totalPending)}`;

    const result = await sendPushToAllSubscriptions(admin, vapid, title, body, dedupKey);
    return res.status(200).json({ ok: true, overdue: overdue.length, totalPending, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}

import { createClient } from '@supabase/supabase-js';
import { readVapidConfig, sendPushToAllSubscriptions } from '../server/push.js';

function normalizeEnv(value?: string) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function headerValue(headers: Record<string, unknown> | undefined, name: string): string {
  if (!headers) return '';
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (typeof direct === 'string') return direct;
  if (Array.isArray(direct) && typeof direct[0] === 'string') return direct[0];
  return '';
}

function readJsonBody(req: { body?: unknown }): { title?: string; body?: string; notification_id?: string } {
  const raw = req.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) {
    return raw as { title?: string; body?: string; notification_id?: string };
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { title?: string; body?: string; notification_id?: string };
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Background Web Push fan-out.
 *
 * Auth: logged-in admin JWT, or x-push-secret matching APP_PUSH_WEBHOOK_SECRET
 * / CRON_SECRET (used by the Postgres trigger, same pattern as Expense Manager).
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-push-secret');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const vapid = readVapidConfig();
  if (!vapid) {
    return res.status(503).json({ error: 'VAPID keys not configured on server.' });
  }

  const supabaseUrl = normalizeEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = normalizeEnv(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const webhookSecret = normalizeEnv(process.env.APP_PUSH_WEBHOOK_SECRET || process.env.CRON_SECRET);

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
  }

  const pushSecret = headerValue(req.headers, 'x-push-secret');
  const webhookOk = Boolean(webhookSecret && pushSecret && pushSecret === webhookSecret);

  if (!webhookOk) {
    if (!supabaseAnonKey) {
      return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
    }
    const authHeader = headerValue(req.headers, 'authorization') || headerValue(req.headers, 'Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { title, body, notification_id } = readJsonBody(req);
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required.' });
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const result = await sendPushToAllSubscriptions(admin, vapid, title, body, notification_id);
    return res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send push.' });
  }
}

import { createClient } from '@supabase/supabase-js';
import { readVapidConfig, sendPushToAllSubscriptions } from '../server/push.js';

function normalizeEnv(value?: string) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Called from the client (with the logged-in admin's Supabase access token)
 * right after a rental/JCB record is created, updated, or deleted, to push a
 * Web Push notification to every subscribed device.
 */
export default async function handler(req: any, res: any) {
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

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
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

  const { title, body, notification_id } = req.body || {};
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

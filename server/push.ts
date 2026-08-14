import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function readVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@kbstractors.local';
  return { publicKey, privateKey, subject };
}

/**
 * Deliver a Web Push notification to every subscribed device (this app has a
 * single admin account, so there is no per-recipient filtering — just fan out
 * to whatever is registered in `push_subscriptions`, and prune any endpoint
 * the push service reports as gone).
 */
function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'unknown';
  }
}

type SendOutcome = { host: string; ok: boolean; status?: number; attempt: 'initial' | 'retry'; error?: string };

export async function sendPushToAllSubscriptions(
  admin: SupabaseClient,
  vapid: VapidConfig,
  title: string,
  body: string,
  notificationId?: string,
): Promise<{ sent: number; total: number; results: SendOutcome[] }> {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error) throw error;
  if (!subs?.length) return { sent: 0, total: 0, results: [] };

  const payload = JSON.stringify({
    id: notificationId,
    title,
    body,
    url: '/',
  });

  // 404/410 = subscription gone. 401/403 = the push service rejected these
  // VAPID keys for this subscription — permanent for that row (e.g. it was
  // created under a since-rotated key pair), not a transient error, so it's
  // safe to prune the same as an expired endpoint.
  const isDeadSubscription = (status: number | undefined) =>
    status === 404 || status === 410 || status === 401 || status === 403;

  let sent = 0;
  const stale: string[] = [];
  const results: SendOutcome[] = [];

  for (const sub of subs) {
    const host = endpointHost(sub.endpoint as string);
    const keys = { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } };

    try {
      await webpush.sendNotification(keys, payload, { TTL: 60 * 60 * 24, urgency: 'high' });
      sent++;
      results.push({ host, ok: true, attempt: 'initial' });
      continue;
    } catch (err: any) {
      const status = err?.statusCode;
      if (isDeadSubscription(status)) {
        stale.push(sub.endpoint as string);
        results.push({ host, ok: false, status, attempt: 'initial', error: 'stale — pruned' });
        continue;
      }
      console.warn(`Web Push initial attempt failed (${host}, status=${status}):`, err?.body || err?.message || err);
    }

    // Retry without TTL/urgency — some push services reject those headers.
    try {
      await webpush.sendNotification(keys, payload);
      sent++;
      results.push({ host, ok: true, attempt: 'retry' });
    } catch (retryErr: any) {
      const retryStatus = retryErr?.statusCode;
      if (isDeadSubscription(retryStatus)) {
        stale.push(sub.endpoint as string);
        results.push({ host, ok: false, status: retryStatus, attempt: 'retry', error: 'stale — pruned' });
      } else {
        const message = retryErr?.body || retryErr?.message || String(retryErr);
        console.warn(`Web Push retry also failed (${host}, status=${retryStatus}):`, message);
        results.push({ host, ok: false, status: retryStatus, attempt: 'retry', error: String(message).slice(0, 300) });
      }
    }
  }

  if (stale.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return { sent, total: subs.length, results };
}

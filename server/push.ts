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
type SendAttempt = { ok: true } | { ok: false; status?: number; detail: string };

async function attemptSend(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  payload: string,
  options?: { TTL: number; urgency: 'high' },
): Promise<SendAttempt> {
  try {
    await webpush.sendNotification({ endpoint, keys }, payload, options);
    return { ok: true };
  } catch (err: any) {
    const detail = String(err?.body || err?.message || err || 'unknown error').slice(0, 300);
    return { ok: false, status: err?.statusCode, detail };
  }
}

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

  // 404/410 = subscription gone for good. 401/403 usually means "gone" too,
  // but only trust that once *both* attempts below have failed — the with-
  // headers attempt failing with 401/403 can also mean the push service
  // objected to the TTL/urgency headers themselves, not the subscription.
  const isDeadSubscription = (status: number | undefined) =>
    status === 404 || status === 410 || status === 401 || status === 403;

  let sent = 0;
  const stale: string[] = [];
  const results: SendOutcome[] = [];

  for (const sub of subs) {
    const host = endpointHost(sub.endpoint as string);
    const keys = { p256dh: sub.p256dh as string, auth: sub.auth as string };
    const endpoint = sub.endpoint as string;

    const initial = await attemptSend(endpoint, keys, payload, { TTL: 60 * 60 * 24, urgency: 'high' });
    if (initial.ok) {
      sent++;
      results.push({ host, ok: true, attempt: 'initial' });
      continue;
    }

    // Always retry without TTL/urgency, even on a 401/403 — some push
    // services (notably Apple's) reject those headers on an otherwise-valid
    // subscription, so bailing out early here would prune good rows.
    const retry = await attemptSend(endpoint, keys, payload);
    if (retry.ok) {
      sent++;
      results.push({
        host,
        ok: true,
        attempt: 'retry',
        error: `initial attempt failed (status=${initial.status}): ${initial.detail}`,
      });
      continue;
    }

    const bothDead = isDeadSubscription(initial.status) && isDeadSubscription(retry.status);
    const detail = `initial(${initial.status}): ${initial.detail} | retry(${retry.status}): ${retry.detail}`;
    if (bothDead) {
      stale.push(endpoint);
    } else {
      console.warn(`Web Push failed for ${host} —`, detail);
    }
    results.push({
      host,
      ok: false,
      status: retry.status,
      attempt: 'retry',
      error: bothDead ? `stale — pruned. ${detail}` : detail,
    });
  }

  if (stale.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return { sent, total: subs.length, results };
}

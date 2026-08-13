import { createClient } from '@supabase/supabase-js';
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
export async function sendPushToAllSubscriptions(
  admin: ReturnType<typeof createClient>,
  vapid: VapidConfig,
  title: string,
  body: string,
  notificationId?: string,
): Promise<{ sent: number; total: number }> {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error) throw error;
  if (!subs?.length) return { sent: 0, total: 0 };

  const payload = JSON.stringify({
    id: notificationId,
    title,
    body,
    url: '/',
  });

  let sent = 0;
  const stale: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload,
      );
      sent++;
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) stale.push(sub.endpoint as string);
    }
  }

  if (stale.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return { sent, total: subs.length };
}

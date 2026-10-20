import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
  NOTIFICATION_SETTINGS_KEY,
  notificationTypeForKind,
  resolveNotificationSettings,
  sanitizeNotifications,
  type NotificationSettings,
} from '../src/lib/userAccess.js';

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

// Apple's push service validates the VAPID JWT far more strictly than FCM —
// a stray leading/trailing space or wrapping quote picked up from a
// copy-paste into the Vercel dashboard is enough to make it reject the
// token outright as malformed ("BadJwtToken"), while FCM tolerates the same
// defect silently. Always normalize, unlike a plain `process.env.X` read.
function normalizeEnv(value?: string): string {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function readVapidConfig(): VapidConfig | null {
  const publicKey = normalizeEnv(process.env.VAPID_PUBLIC_KEY);
  const privateKey = normalizeEnv(process.env.VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) return null;
  const subject = normalizeEnv(process.env.VAPID_SUBJECT) || 'mailto:support@kbstractors.local';
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

export type PushTargeting = {
  /** Skip this one device (the one that caused the notification). */
  excludeEndpoint?: string;
  /** Skip every device of the user who caused the notification. */
  excludeUserId?: string;
  /** app_notifications.kind — decides which per-user switch applies. */
  kind?: string;
  /** Only this user's devices, ignoring every switch (test push). */
  onlyUserId?: string;
};

/** Business-wide switches; both on if the row is missing or unreadable. */
export async function loadNotificationSettings(admin: SupabaseClient): Promise<NotificationSettings> {
  const { data, error } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', NOTIFICATION_SETTINGS_KEY)
    .maybeSingle();
  // Before the user-control migration runs the table doesn't exist — keep notifying.
  if (error) return resolveNotificationSettings(null);
  return resolveNotificationSettings(data?.value);
}

type PushRecipient = { loginEnabled: boolean; notifications: Set<string> };

/** null when app_users can't be read (migration not applied yet) — then nobody is filtered out. */
async function loadPushRecipients(admin: SupabaseClient): Promise<Map<string, PushRecipient> | null> {
  const { data, error } = await admin.from('app_users').select('id, login_enabled, notifications');
  if (error) {
    console.warn('Could not load app_users for push targeting:', error.message);
    return null;
  }
  return new Map(
    ((data ?? []) as { id: string; login_enabled: boolean | null; notifications: unknown }[]).map((row) => [
      row.id,
      { loginEnabled: row.login_enabled !== false, notifications: new Set<string>(sanitizeNotifications(row.notifications)) },
    ]),
  );
}

export async function sendPushToAllSubscriptions(
  admin: SupabaseClient,
  vapid: VapidConfig,
  title: string,
  body: string,
  notificationId?: string,
  options?: PushTargeting,
): Promise<{ sent: number; total: number; results: SendOutcome[]; skipped?: string }> {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const { data: allSubs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id');

  if (error) throw error;

  let subs = allSubs ?? [];
  if (options?.onlyUserId) {
    // A test push goes to the caller's own devices, whatever the switches say.
    subs = subs.filter((sub) => sub.user_id === options.onlyUserId);
  } else {
    const settings = await loadNotificationSettings(admin);
    const type = notificationTypeForKind(options?.kind);
    if (!settings.push) return { sent: 0, total: 0, results: [], skipped: 'push turned off' };
    if (type === 'reminders' && !settings.reminders) {
      return { sent: 0, total: 0, results: [], skipped: 'reminders turned off' };
    }
    if (type === 'summary' && !settings.summary) {
      return { sent: 0, total: 0, results: [], skipped: 'daily summary turned off' };
    }
    const users = await loadPushRecipients(admin);
    subs = subs.filter((sub) => {
      // The device that made the change already knows about it.
      if (options?.excludeEndpoint && sub.endpoint === options.excludeEndpoint) return false;
      // Subscriptions saved before User control existed have no user yet;
      // they get one the next time that device opens the app.
      if (!sub.user_id) return true;
      // Never push someone their own change, on any of their devices.
      if (options?.excludeUserId && sub.user_id === options.excludeUserId) return false;
      if (!users) return true;
      const user = users.get(sub.user_id as string);
      if (!user || !user.loginEnabled) return false;
      if (type && !user.notifications.has(type)) return false;
      return true;
    });
  }
  if (!subs.length) return { sent: 0, total: 0, results: [] };

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

  // One device's push service being slow must not delay every other
  // device's notification — dispatch all of them at once instead of
  // awaiting each subscription in turn.
  const perSubscription = subs.map(async (sub): Promise<{ outcome: SendOutcome; delivered: boolean; deadEndpoint?: string }> => {
    const host = endpointHost(sub.endpoint as string);
    const keys = { p256dh: sub.p256dh as string, auth: sub.auth as string };
    const endpoint = sub.endpoint as string;

    const initial = await attemptSend(endpoint, keys, payload, { TTL: 60 * 60 * 24, urgency: 'high' });
    if (initial.ok) {
      return { outcome: { host, ok: true, attempt: 'initial' }, delivered: true };
    }

    // Always retry without TTL/urgency, even on a 401/403 — some push
    // services (notably Apple's) reject those headers on an otherwise-valid
    // subscription, so bailing out early here would prune good rows.
    const retry = await attemptSend(endpoint, keys, payload);
    if (retry.ok) {
      return {
        outcome: {
          host,
          ok: true,
          attempt: 'retry',
          error: `initial attempt failed (status=${initial.status}): ${initial.detail}`,
        },
        delivered: true,
      };
    }

    const bothDead = isDeadSubscription(initial.status) && isDeadSubscription(retry.status);
    const detail = `initial(${initial.status}): ${initial.detail} | retry(${retry.status}): ${retry.detail}`;
    if (!bothDead) console.warn(`Web Push failed for ${host} —`, detail);
    return {
      outcome: {
        host,
        ok: false,
        status: retry.status,
        attempt: 'retry',
        error: bothDead ? `stale — pruned. ${detail}` : detail,
      },
      delivered: false,
      deadEndpoint: bothDead ? endpoint : undefined,
    };
  });

  const settled = await Promise.all(perSubscription);
  const sent = settled.filter((r) => r.delivered).length;
  const results = settled.map((r) => r.outcome);
  const stale = settled.map((r) => r.deadEndpoint).filter((e): e is string => Boolean(e));

  if (stale.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return { sent, total: subs.length, results };
}

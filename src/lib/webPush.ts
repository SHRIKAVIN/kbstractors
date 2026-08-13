import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function isSupabaseEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function webPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function vapidConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY);
}

/** True when auto-registering push on app load is expected to succeed. */
export function shouldAttemptWebPushRegistration(): boolean {
  if (!webPushSupported() || Notification.permission !== 'granted') return false;
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIos && !isStandalonePwa()) return false;
  if (import.meta.env.DEV && !navigator.serviceWorker.controller) return false;
  return true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function waitForServiceWorker(timeoutMs = 15000): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Service worker did not load — refresh and try again.'));
    }, timeoutMs);

    void navigator.serviceWorker.ready
      .then((reg) => {
        window.clearTimeout(timer);
        resolve(reg);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err instanceof Error ? err : new Error('Service worker unavailable.'));
      });
  });
}

/** Subscribe this device for Web Push (VAPID) and persist in Supabase. */
export async function registerWebPushSubscription(userId: string): Promise<void> {
  if (!isSupabaseEnabled()) throw new Error('Supabase is not configured.');
  if (!webPushSupported()) {
    throw new Error('Web Push is not available — check VITE_VAPID_PUBLIC_KEY and redeploy.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted.');
  }

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIos && !isStandalonePwa()) {
    throw new Error('On iPhone, add this app to your Home Screen first, then open it from the icon.');
  }

  // VitePWA injects registration in production. Avoid re-registering the ESM
  // dev worker without `type: "module"` (causes "import outside a module").
  if (!navigator.serviceWorker.controller) {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) {
      if (import.meta.env.DEV) {
        throw new Error('Service worker is disabled in Vite dev. Use a production build or `vite preview` to test push.');
      }
      await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
    }
  }
  const reg = await waitForServiceWorker();

  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription from browser.');
  }

  const row = {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 240),
    updated_at: new Date().toISOString(),
  };

  const { error: insertErr } = await supabase.from('push_subscriptions').insert(row);
  if (insertErr) {
    if (insertErr.code === '23505') {
      const { error: updateErr } = await supabase
        .from('push_subscriptions')
        .update({
          user_id: userId,
          p256dh: row.p256dh,
          auth: row.auth,
          user_agent: row.user_agent,
          updated_at: row.updated_at,
        })
        .eq('endpoint', row.endpoint);
      if (updateErr) throw new Error(updateErr.message);
    } else {
      throw new Error(
        insertErr.message.includes('push_subscriptions')
          ? 'Database table missing — run the push_subscriptions migration in Supabase SQL Editor.'
          : insertErr.message,
      );
    }
  }
}

/** Remove this device's push subscription from Supabase and unsubscribe locally. */
export async function unregisterWebPushSubscription(userId: string): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId);
    }
  } catch {
    /* no-op */
  }
}

/** Whether the browser has an active push subscription on this device. */
export async function hasLocalPushSubscription(): Promise<boolean> {
  if (!webPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/** Whether this user has at least one push subscription saved in Supabase. */
export async function hasPushSubscription(userId: string): Promise<boolean> {
  if (!isSupabaseEnabled()) return false;
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export type PushSetupStatus =
  | 'ready'
  | 'needs_permission'
  | 'needs_pwa'
  | 'needs_vapid'
  | 'needs_register';

export async function getPushSetupStatus(userId: string): Promise<PushSetupStatus> {
  if (!vapidConfigured()) return 'needs_vapid';
  if (Notification.permission !== 'granted') return 'needs_permission';
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIos && !isStandalonePwa()) return 'needs_pwa';
  const [local, remote] = await Promise.all([hasLocalPushSubscription(), hasPushSubscription(userId)]);
  if (local && remote) return 'ready';
  return 'needs_register';
}

/** Ask the server to deliver a Web Push to every registered device. */
export async function invokeSendPush(input: { title: string; body: string }): Promise<{
  ok: boolean;
  sent?: number;
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, error: 'Not signed in' };

    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: result?.error ?? `HTTP ${response.status}` };
    return { ok: true, sent: result?.sent };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Push failed';
    console.warn('Web push invoke failed:', err);
    return { ok: false, error: message };
  }
}

/** Send a test background push to verify the API route + VAPID setup. */
export async function sendTestBackgroundPush(): Promise<{ ok: boolean; message: string }> {
  const result = await invokeSendPush({
    title: 'KBS Tractors',
    body: 'Background push is working — you can close the app and still get alerts.',
  });
  if (result.ok) return { ok: true, message: 'Test sent — close the app to verify the banner.' };
  if (result.error?.includes('VAPID')) {
    return { ok: false, message: 'Server missing VAPID env vars — set them in Vercel.' };
  }
  return { ok: false, message: result.error ?? 'Push failed' };
}

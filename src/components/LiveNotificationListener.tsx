import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { emitRecordsChanged } from '../lib/liveEvents';
import { bindAlertChannel } from '../lib/alertBus';
import { registerWebPushSubscription, shouldAttemptWebPushRegistration } from '../lib/webPush';
import type { AppNotificationRow } from '../lib/appNotify';

const SEEN_PREFIX = 'kbs.notifications.seen.';

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function seenKey(userId: string) {
  return `${SEEN_PREFIX}${userId}`;
}

function readSeen(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(userId: string, id: string) {
  try {
    const set = readSeen(userId);
    set.add(id);
    localStorage.setItem(seenKey(userId), JSON.stringify([...set].slice(-100)));
  } catch {
    /* no-op */
  }
}

/**
 * No UI of its own — real notifications come only from actual Web Push (the
 * service worker's `push` handler shows the OS banner, on every device,
 * whether the app is open, backgrounded, or closed). This component just
 * keeps the push subscription registered and silently refreshes open
 * dashboards (via Realtime Broadcast + postgres_changes) when data changes
 * on another device, so there is no separate in-app toast to duplicate what
 * the OS notification already shows.
 */
export function LiveNotificationListener() {
  const { user } = useAuth();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    seenRef.current = readSeen(user.id);
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectAttempt = 0;

    if (shouldAttemptWebPushRegistration()) {
      void registerWebPushSubscription(user.id).catch((err) => {
        console.warn('Push subscription failed:', err);
      });
    }

    const deliver = (row: Pick<AppNotificationRow, 'id' | 'title' | 'body'>) => {
      if (!row.id || seenRef.current.has(row.id)) return;
      seenRef.current.add(row.id);
      markSeen(user.id, row.id);

      // Silent refresh only — the OS notification for this row already came
      // (or is coming) from the service worker's real Web Push `push` event.
      emitRecordsChanged();
    };

    const onRecordsChange = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        emitRecordsChanged();
      }, 120);
    };

    const removeChannel = () => {
      bindAlertChannel(null, false);
      if (!channel) return;
      const ch = channel;
      channel = null;
      void supabase.removeChannel(ch);
    };

    const subscribe = () => {
      if (disposed) return;
      removeChannel();

      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.access_token) void supabase.realtime.setAuth(data.session.access_token);
      });

      const ch = supabase
        .channel('kbs-alerts', { config: { broadcast: { self: false, ack: false } } })
        .on('broadcast', { event: 'notify' }, ({ payload }) => {
          const row = payload as Pick<AppNotificationRow, 'id' | 'title' | 'body'>;
          if (row?.id && row.title && row.body) deliver(row);
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'app_notifications' },
          (payload) => {
            deliver(payload.new as AppNotificationRow);
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rental_records' },
          onRecordsChange,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jcb_records' },
          onRecordsChange,
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            reconnectAttempt = 0;
            bindAlertChannel(ch, true);
            return;
          }
          bindAlertChannel(ch, false);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            window.clearTimeout(reconnectTimer);
            const delay = Math.min(8_000, 800 * 2 ** reconnectAttempt);
            reconnectAttempt += 1;
            reconnectTimer = setTimeout(subscribe, delay);
          }
        });

      channel = ch;
    };

    const wake = () => {
      if (disposed) return;
      emitRecordsChanged();
      subscribe();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') wake();
    };

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);

      const { data, error } = await supabase
        .from('app_notifications')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.warn('Could not seed notification ids:', error.message);
      } else {
        for (const row of data ?? []) {
          seenRef.current.add(row.id);
          markSeen(user.id, row.id);
        }
      }
      if (!disposed) subscribe();
    })();

    if (isStandalonePwa()) {
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') emitRecordsChanged();
      }, 12_000);
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', wake);
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);

    const onLocalNotification = (event: Event) => {
      const detail = (event as CustomEvent<AppNotificationRow>).detail;
      if (detail?.id && detail.title && detail.body) deliver(detail);
    };
    window.addEventListener('kbs-local-notification', onLocalNotification);

    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string; title?: string; body?: string } | null;
      if (data?.type !== 'kbs-push') return;
      emitRecordsChanged();
      if (data.title && data.body) {
        deliver({
          id: data.id ?? `sw-${Date.now()}`,
          title: data.title,
          body: data.body,
        });
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      disposed = true;
      bindAlertChannel(null, false);
      window.clearTimeout(debounceTimer);
      window.clearTimeout(reconnectTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      window.removeEventListener('kbs-local-notification', onLocalNotification);
      removeChannel();
    };
  }, [user]);

  return null;
}

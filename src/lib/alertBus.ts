import type { RealtimeChannel } from '@supabase/supabase-js';

export type LiveAlert = {
  id: string;
  title: string;
  body: string;
};

let channel: RealtimeChannel | null = null;
let ready = false;
const pending: LiveAlert[] = [];

/** Called by LiveNotificationListener once the shared Realtime channel is up. */
export function bindAlertChannel(ch: RealtimeChannel | null, isReady: boolean) {
  channel = ch;
  ready = Boolean(ch) && isReady;
  if (!channel || !ready) return;
  const queued = pending.splice(0);
  for (const alert of queued) {
    void channel.send({ type: 'broadcast', event: 'notify', payload: alert });
  }
}

/** Fan out to every other open app (does not need DB replication). */
export function broadcastAlert(alert: LiveAlert) {
  if (channel && ready) {
    void channel.send({ type: 'broadcast', event: 'notify', payload: alert });
    return;
  }
  pending.push(alert);
}

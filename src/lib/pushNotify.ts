import type { RentalRecord } from '../types/rental';
import type { JCBRecord } from '../types/jcb';
import { getJCBPending, getRentalPending } from '../utils/pending';
import { insertAppNotification } from './appNotify';
import { broadcastAlert } from './alertBus';
import { getCurrentPushEndpoint } from './webPush';
import type { EntrySnapshot, NotificationMessage } from './notificationTemplates';

// ── Who is acting ───────────────────────────────────────────────────────────
// Set by AuthProvider once the signed-in user's profile loads, so every
// notification can say "By Ravi" without threading the name through services.

let actorName: string | null = null;

export function setNotificationActor(name: string | null) {
  actorName = name;
}

export function currentActor(): string | null {
  return actorName;
}

// ── Snapshots for the templates ─────────────────────────────────────────────

function oldBalanceOf(record: { old_balance?: string | null; old_balance_status?: 'paid' | 'pending' | null }) {
  if (!record.old_balance) return null;
  return { amount: parseFloat(record.old_balance) || 0, status: record.old_balance_status === 'paid' ? 'paid' as const : 'pending' as const };
}

export function rentalSnapshot(record: RentalRecord): EntrySnapshot {
  const details = record.details ?? [];
  return {
    entity: 'rental',
    name: record.name || 'Unknown',
    total: record.total_amount || 0,
    received: record.received_amount || 0,
    pending: getRentalPending(record).amount,
    jobs: details.map((d) => ({
      equipment: d.equipment_type,
      detail: d.equipment_type === 'Dipper' ? `${d.nadai ?? 0} nadai` : `${d.acres} acres × ${d.rounds}`,
    })),
    equipment: [...new Set(details.map((d) => d.equipment_type))].join(', '),
    oldBalance: oldBalanceOf(record),
  };
}

export function jcbSnapshot(record: JCBRecord): EntrySnapshot {
  const details = record.details ?? [];
  const hours = details.reduce((sum, d) => sum + (Number(d.hours) || 0), 0);
  return {
    entity: 'jcb',
    name: record.driver_name || record.company_name || 'Unknown',
    total: record.total_amount || 0,
    received: record.amount_received || 0,
    pending: getJCBPending(record).amount,
    jobs: details.map((d) => ({ equipment: 'JCB', detail: `${d.hours} h` })),
    equipment: hours ? `JCB ${hours} h` : '',
    oldBalance: oldBalanceOf(record),
  };
}

// ── Delivery ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: queue a notification. Never throws — a failed push must
 * never break saving an entry. Pass null (e.g. an edit with no real change)
 * to send nothing.
 *
 * Inserting into app_notifications is the only trigger needed: a Postgres
 * AFTER INSERT trigger (see supabase/migrations/20260813130000_*.sql) calls
 * /api/send-push server-to-server via pg_net, which reaches every device in
 * push_subscriptions — reliable even if this client closes immediately after
 * the insert, unlike a client-side fetch (same pattern as expense-manager's
 * partner_notification_push trigger: "do not also invoke here"). The row
 * records who caused it (actor_id) and this device's push endpoint, so the
 * server never pushes someone their own change. Realtime Broadcast + the
 * local CustomEvent just refresh other open dashboards live; they don't show
 * a notification themselves.
 */
export function notify(message: NotificationMessage | null): void {
  if (!message) return;
  void (async () => {
    try {
      const id = crypto.randomUUID();
      const { title, body, kind } = message;

      const originEndpoint = await getCurrentPushEndpoint();
      const row = await insertAppNotification({ id, title, body, kind, originEndpoint, actorName: actorName ?? undefined });
      const alertId = row?.id ?? id;

      broadcastAlert({ id: alertId, title, body });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kbs-local-notification', {
            detail: {
              id: alertId,
              actor_name: actorName ?? 'KBS',
              title,
              body,
              kind,
              created_at: new Date().toISOString(),
            },
          }),
        );
      }
    } catch (err) {
      console.warn('Push notification failed:', err);
    }
  })();
}

import { formatCurrency } from '../utils/calculations';
import { insertAppNotification } from './appNotify';
import { broadcastAlert } from './alertBus';

export type CrudAction = 'created' | 'updated' | 'deleted';
export type CrudEntity = 'rental' | 'jcb';

const ENTITY_LABEL: Record<CrudEntity, string> = {
  rental: 'Rental',
  jcb: 'JCB',
};

function buildMessage(
  action: CrudAction,
  entity: CrudEntity,
  payerName: string,
  totalAmount: number,
  pendingAmount: number,
): { title: string; body: string; kind: string } {
  const label = ENTITY_LABEL[entity];
  const name = payerName || 'Unknown';
  const kind = `${entity}_${action}`;

  if (action === 'deleted') {
    return {
      title: `${label} entry deleted`,
      body: `${name} — ${formatCurrency(totalAmount)} entry was removed`,
      kind,
    };
  }

  return {
    title: action === 'created' ? `New ${label.toLowerCase()} entry` : `${label} entry updated`,
    body:
      pendingAmount > 0
        ? `${name} — ${formatCurrency(totalAmount)} total, ${formatCurrency(pendingAmount)} pending`
        : `${name} — ${formatCurrency(totalAmount)} total, fully paid`,
    kind,
  };
}

/**
 * Fire-and-forget notification for a rental/JCB create, update, or delete.
 * Never throws — a failed push must never break CRUD.
 *
 * Inserting into app_notifications is the only trigger needed: a Postgres
 * AFTER INSERT trigger (see supabase/migrations/20260813130000_*.sql) calls
 * /api/send-push server-to-server via pg_net, which reaches every device in
 * push_subscriptions — reliable even if this client closes immediately after
 * the insert, unlike a client-side fetch (same pattern as expense-manager's
 * partner_notification_push trigger: "do not also invoke here"). Realtime
 * Broadcast + the local CustomEvent just refresh other open dashboards live;
 * they don't show a notification themselves.
 */
export function notifyCrud(
  action: CrudAction,
  entity: CrudEntity,
  payerName: string,
  totalAmount: number,
  pendingAmount: number,
): void {
  void (async () => {
    try {
      const id = crypto.randomUUID();
      const { title, body, kind } = buildMessage(
        action,
        entity,
        payerName,
        totalAmount,
        pendingAmount,
      );

      const row = await insertAppNotification({ id, title, body, kind });
      const alertId = row?.id ?? id;

      broadcastAlert({ id: alertId, title, body });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kbs-local-notification', {
            detail: {
              id: alertId,
              actor_name: 'KBS',
              title,
              body,
              kind,
              created_at: new Date().toISOString(),
            },
          }),
        );
      }
    } catch (err) {
      console.warn('CRUD push notification failed:', err);
    }
  })();
}

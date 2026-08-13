import { invokeSendPush } from './webPush';
import { formatCurrency } from '../utils/calculations';
import { insertAppNotification } from './appNotify';

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
 * Fire-and-forget live + background notification for a rental/JCB create,
 * update, or delete. Never throws — a failed push must never break CRUD.
 *
 * Live (app open): insert into app_notifications → Realtime → notifyPush.
 * Background: DB trigger calls /api/send-push (Expense Manager pattern).
 * Client invokeSendPush is a fallback if the trigger secret is not set yet.
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

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kbs-local-notification', {
            detail: {
              id: row?.id ?? id,
              actor_name: 'KBS',
              title,
              body,
              kind,
              created_at: new Date().toISOString(),
            },
          }),
        );
      }

      await invokeSendPush({
        title,
        body,
        notification_id: row?.id ?? id,
      });
    } catch (err) {
      console.warn('CRUD push notification failed:', err);
    }
  })();
}

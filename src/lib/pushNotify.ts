import { invokeSendPush } from './webPush';
import { formatCurrency } from '../utils/calculations';

export type CrudAction = 'created' | 'updated' | 'deleted';
export type CrudEntity = 'rental' | 'jcb';

const ENTITY_LABEL: Record<CrudEntity, string> = {
  rental: 'Rental',
  jcb: 'JCB',
};

/**
 * Fire-and-forget push notification for a rental/JCB create, update, or
 * delete. Never throws — a failed push must never break a CRUD operation.
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
      const label = ENTITY_LABEL[entity];
      const name = payerName || 'Unknown';

      if (action === 'deleted') {
        await invokeSendPush({
          title: `${label} entry deleted`,
          body: `${name} — ${formatCurrency(totalAmount)} entry was removed`,
        });
        return;
      }

      const title = action === 'created' ? `New ${label.toLowerCase()} entry` : `${label} entry updated`;
      const body =
        pendingAmount > 0
          ? `${name} — ${formatCurrency(totalAmount)} total, ${formatCurrency(pendingAmount)} pending`
          : `${name} — ${formatCurrency(totalAmount)} total, fully paid`;

      await invokeSendPush({ title, body });
    } catch (err) {
      console.warn('CRUD push notification failed:', err);
    }
  })();
}

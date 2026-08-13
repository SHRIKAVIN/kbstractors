// Shared "how much is still owed on this record" logic.
//
// Kept dependency-free (no React/Supabase imports) so it can be reused both by
// UI components and by the Vercel serverless functions under api/.

export interface PendingInput {
  total_amount: number;
  received_amount?: number | null;
  old_balance_status?: 'paid' | 'pending' | null;
}

export interface PendingResult {
  /** Amount still owed, never negative. */
  amount: number;
  isPaid: boolean;
}

function computePending(totalAmount: number, receivedAmount: number, oldBalanceStatus?: 'paid' | 'pending' | null): PendingResult {
  const amount = Math.max((totalAmount || 0) - (receivedAmount || 0), 0);
  const isPaid = amount <= 0 || oldBalanceStatus === 'paid';
  return { amount, isPaid };
}

/** Pending balance for a rental record (`received_amount` field). */
export function getRentalPending(record: PendingInput & { received_amount?: number | null }): PendingResult {
  return computePending(record.total_amount, record.received_amount ?? 0, record.old_balance_status);
}

/** Pending balance for a JCB record (`amount_received` field). */
export function getJCBPending(record: PendingInput & { amount_received?: number | null }): PendingResult {
  return computePending(record.total_amount, record.amount_received ?? 0, record.old_balance_status);
}

import type { RentalDetail, RentalRecord } from '../../types/rental';
import { calculateTotalAmount } from '../../utils/calculations';
import { getRentalPending } from '../../utils/pending';

export const DIPPER_RATE = 500;

export function detailAmount(d: RentalDetail): number {
  if (d.equipment_type === 'Dipper') {
    return DIPPER_RATE * (parseInt(String(d.nadai || '0'), 10) || 0);
  }
  return calculateTotalAmount(
    parseFloat(String(d.acres || '0')) || 0,
    parseFloat(String(d.rounds || '0')) || 0,
    d.equipment_type as Parameters<typeof calculateTotalAmount>[2],
  );
}

export type RentalStatus = 'paid' | 'partial' | 'pending';

export function rentalStatus(record: RentalRecord): { status: RentalStatus; pending: number } {
  const { amount, isPaid } = getRentalPending(record);
  if (isPaid) return { status: 'paid', pending: 0 };
  return { status: (record.received_amount || 0) > 0 ? 'partial' : 'pending', pending: amount };
}

export const STATUS_LABEL: Record<RentalStatus, string> = {
  paid: 'பெறப்பட்டது',
  partial: 'பகுதி',
  pending: 'நிலுவை',
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // Tamil letters often carry combining vowel signs — keep them with the base letter.
  return (trimmed.match(/^\P{M}\p{M}*/u)?.[0] ?? trimmed[0]).toUpperCase();
}

/** Section heading for a day: இன்று / நேற்று / "18 Oct 2026". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'இன்று';
  if (diffDays === 1) return 'நேற்று';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function paidPercent(record: RentalRecord): number {
  if (rentalStatus(record).status === 'paid') return 100;
  return record.total_amount > 0 ? Math.min(100, ((record.received_amount || 0) / record.total_amount) * 100) : 0;
}

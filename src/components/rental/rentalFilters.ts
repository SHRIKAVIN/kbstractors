import type { RentalRecord } from '../../types/rental';
import { getRentalPending } from '../../utils/pending';

export interface RentalFilters {
  equipment: string;
  status: '' | 'paid' | 'pending';
  oldBalanceStatus: '' | 'paid' | 'pending';
  name: string;
}

export const EMPTY_FILTERS: RentalFilters = { equipment: '', status: '', oldBalanceStatus: '', name: '' };

const KNOWN_EQUIPMENT = ['Cage Wheel', 'Rotavator', 'புழுதி', 'Mini', 'Dipper'];

export function filterRentals(records: RentalRecord[], filters: RentalFilters): RentalRecord[] {
  const q = filters.name.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.equipment) {
      const details = Array.isArray(record.details) ? record.details : [];
      if (!details.some((d) => d.equipment_type === filters.equipment)) {
        const isOther = filters.equipment === 'Others' && details.some((d) => !KNOWN_EQUIPMENT.includes(d.equipment_type));
        if (!isOther) return false;
      }
    }
    if (q && !record.name.toLowerCase().includes(q)) return false;
    if (filters.oldBalanceStatus && (!record.old_balance || record.old_balance_status !== filters.oldBalanceStatus)) return false;
    if (filters.status && (getRentalPending(record).isPaid ? 'paid' : 'pending') !== filters.status) return false;
    return true;
  });
}

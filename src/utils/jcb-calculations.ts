export const JCB_EQUIPMENT_RATES: Record<string, number> = {
  'JCB': 1000,      // ₹1000 per hour
};

export function calculateJCBTotalAmount(hours: number, equipmentType: keyof typeof JCB_EQUIPMENT_RATES): number {
  const rate = JCB_EQUIPMENT_RATES[equipmentType];
  return hours * rate;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

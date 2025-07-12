export const EQUIPMENT_RATES = {
  'Cage Wheel': 350,
  'Rotator': 700
} as const;

export function calculateTotalAmount(
  acres: number,
  rounds: number,
  equipmentType: 'Cage Wheel' | 'Rotator'
): number {
  const rate = EQUIPMENT_RATES[equipmentType];
  return acres * rounds * rate;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(amount);
}
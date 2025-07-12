export const EQUIPMENT_RATES: Record<'Cage Wheel' | 'Rotator' | 'புழுதி', number> = {
  'Cage Wheel': 350,
  'Rotator': 700,
  'புழுதி': 350,
};

export function calculateTotalAmount(
  acres: number,
  rounds: number,
  equipmentType: 'Cage Wheel' | 'Rotator' | 'புழுதி'
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
export const EQUIPMENT_RATES: Record<'Cage Wheel' | 'Rotavator' | 'புழுதி' | 'Mini', number> = {
  'Cage Wheel': 350,
  'Rotavator': 700,
  'புழுதி': 350,
  'Mini': 600,
};

export function calculateTotalAmount(
  acres: number,
  rounds: number,
  equipmentType: 'Cage Wheel' | 'Rotavator' | 'புழுதி' | 'Mini'
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
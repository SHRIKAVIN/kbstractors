export interface RentalRecord {
  id: string;
  name: string;
  acres: number;
  equipment_type: 'Cage Wheel' | 'Rotator';
  rounds: number;
  total_amount: number;
  received_amount: number;
  created_at: string;
  acres2?: number;
  equipment_type2?: 'Cage Wheel' | 'Rotator';
  rounds2?: number;
}

export interface User {
  id: string;
  email: string;
}
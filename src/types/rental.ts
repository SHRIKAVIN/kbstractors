export interface RentalDetail {
  acres: number;
  equipment_type: 'Cage Wheel' | 'Rotator';
  rounds: number;
}

export interface RentalRecord {
  id: string;
  name: string;
  details: RentalDetail[];
  total_amount: number;
  received_amount: number;
  created_at: string;
  old_balance?: string;
}

export interface User {
  id: string;
  email: string;
}
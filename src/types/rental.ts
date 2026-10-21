export interface RentalDetail {
  acres: number;
  equipment_type: 'Cage Wheel' | 'Rotavator' | 'Dipper';
  rounds: number;
  nadai?: number;
  /** Where this job was done (each job in an entry can be at a different place). */
  place?: string;
}

export interface RentalRecord {
  id: string;
  name: string;
  mobile_number?: string | null;
  details: RentalDetail[];
  total_amount: number;
  received_amount: number;
  created_at: string;
  old_balance?: string;
  old_balance_reason?: string;
  old_balance_status?: "paid" | "pending";
}

export interface User {
  id: string;
  email: string;
}
export interface JCBDetail {
  hours: number;
  equipment_type: 'JCB';
}

export interface JCBRecord {
  id: string;
  company_name: string;
  driver_name: string;
  mobile_number?: string | null;
  details: JCBDetail[];
  total_amount: number;
  amount_received?: number;
  advance_amount?: number;
  created_at: string;
  old_balance?: string;
  old_balance_reason?: string;
  old_balance_status?: "paid" | "pending";
  work_date?: string;
}

export interface JCBUser {
  id: string;
  email: string;
}

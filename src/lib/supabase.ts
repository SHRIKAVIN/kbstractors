import { createClient } from '@supabase/supabase-js';
import type { RentalRecord } from '../types/rental';
import { currentActor, notify, rentalSnapshot } from './pushNotify';
import { entryCreated, entryDeleted, entryEdited, paymentCollected } from './notificationTemplates';
import { getRentalPending } from '../utils/pending';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use placeholder values if environment variables are not set
const defaultUrl = 'https://placeholder.supabase.co';
const defaultKey = 'placeholder-key';

export const supabase = createClient(
  supabaseUrl || defaultUrl,
  supabaseKey || defaultKey,
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);

export const auth = supabase.auth;

// Database operations using Supabase
export const rentalService = {
  async create(record: Omit<RentalRecord, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('rental_records')
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    notify(entryCreated(rentalSnapshot(data), currentActor()));
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from('rental_records')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByDateRange(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('rental_records')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByEquipmentType(equipmentType: string) {
    const { data, error } = await supabase
      .from('rental_records')
      .select('*')
      .eq('equipment_type', equipmentType)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Update a rental record by id
  async update(id: string, updates: Partial<RentalRecord>) {
    // The "before" copy lets the notification say exactly what changed.
    const { data: before } = await supabase.from('rental_records').select('*').eq('id', id).maybeSingle();
    const { data, error } = await supabase
      .from('rental_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    notify(before ? entryEdited(rentalSnapshot(before), rentalSnapshot(data), currentActor()) : null);
    return data;
  },

  // Record a payment against an entry: adds to received_amount (capped at
  // what's still pending). Paying off an old-balance-only entry also flips
  // its old_balance_status, matching what the form saves for a paid one.
  async collect(record: RentalRecord, amount: number) {
    const { amount: pending } = getRentalPending(record);
    const collected = Math.min(Math.max(amount, 0), pending);
    const received = (record.received_amount || 0) + collected;
    const updates: Partial<RentalRecord> = { received_amount: received };
    const isOldBalanceOnly = (!record.details || record.details.length === 0) && !!record.old_balance;
    if (isOldBalanceOnly && received >= record.total_amount) {
      updates.old_balance_status = 'paid';
    }

    const { data, error } = await supabase
      .from('rental_records')
      .update(updates)
      .eq('id', record.id)
      .select()
      .single();
    if (error) throw error;
    notify(paymentCollected(rentalSnapshot(data), collected, currentActor()));
    return data as RentalRecord;
  },

  // Delete a rental record
  async delete(record: RentalRecord) {
    const { error } = await supabase
      .from('rental_records')
      .delete()
      .eq('id', record.id);
    if (error) throw error;
    notify(entryDeleted(rentalSnapshot(record), currentActor()));
    return true;
  }
};
import { createClient } from '@supabase/supabase-js';
import type { RentalRecord } from '../types/rental';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use placeholder values if environment variables are not set
const defaultUrl = 'https://placeholder.supabase.co';
const defaultKey = 'placeholder-key';

export const supabase = createClient(
  supabaseUrl || defaultUrl, 
  supabaseKey || defaultKey
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
    const { data, error } = await supabase
      .from('rental_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete a rental record by id
  async delete(id: string) {
    const { error } = await supabase
      .from('rental_records')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
import { supabase } from './supabase';
import type { JCBRecord } from '../types/jcb';

// Database operations using Supabase for JCB
export const jcbService = {
  async create(record: Omit<JCBRecord, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('jcb_records')
      .insert([record])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from('jcb_records')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByDateRange(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('jcb_records')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByEquipmentType(equipmentType: string) {
    const { data, error } = await supabase
      .from('jcb_records')
      .select('*')
      .eq('equipment_type', equipmentType)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Update a JCB record by id
  async update(id: string, updates: Partial<JCBRecord>) {
    const { data, error } = await supabase
      .from('jcb_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete a JCB record by id
  async delete(id: string) {
    const { error } = await supabase
      .from('jcb_records')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

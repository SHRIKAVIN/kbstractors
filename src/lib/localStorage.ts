import type { RentalRecord } from '../types/rental';

const STORAGE_KEY = 'kbs-rental-records';

// Local storage service for rental records
export const localStorageService = {
  // Generate a unique ID for new records
  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Create a new rental record
  async create(record: Omit<RentalRecord, 'id' | 'created_at'>): Promise<RentalRecord> {
    const newRecord: RentalRecord = {
      ...record,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };

    const existingRecords = this.getAll();
    const updatedRecords = [...existingRecords, newRecord];
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
    
    return newRecord;
  },

  // Get all rental records
  getAll(): RentalRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error parsing rental records from localStorage:', error);
      return [];
    }
  },

  // Get records by date range
  getByDateRange(startDate: string, endDate: string): RentalRecord[] {
    const allRecords = this.getAll();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return allRecords.filter(record => {
      const recordDate = new Date(record.created_at);
      return recordDate >= start && recordDate <= end;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // Get records by equipment type
  getByEquipmentType(equipmentType: string): RentalRecord[] {
    const allRecords = this.getAll();
    return allRecords.filter(record => record.equipment_type === equipmentType)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // Update a rental record
  async update(id: string, updates: Partial<RentalRecord>): Promise<RentalRecord> {
    const allRecords = this.getAll();
    const index = allRecords.findIndex(record => record.id === id);
    
    if (index === -1) {
      throw new Error('Record not found');
    }

    const updatedRecord = { ...allRecords[index], ...updates };
    allRecords[index] = updatedRecord;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecords));
    
    return updatedRecord;
  },

  // Delete a rental record
  async delete(id: string): Promise<void> {
    const allRecords = this.getAll();
    const filteredRecords = allRecords.filter(record => record.id !== id);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords));
  },

  // Clear all records (for testing/reset)
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}; 
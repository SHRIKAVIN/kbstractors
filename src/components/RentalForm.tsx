import React, { useState, useEffect } from 'react';
import { Save, X, Calculator } from 'lucide-react';
import { rentalService } from '../lib/supabase';
import { calculateTotalAmount, formatCurrency, EQUIPMENT_RATES } from '../utils/calculations';
import type { RentalRecord, RentalDetail } from '../types/rental';

interface RentalFormProps {
  onClose: () => void;
  onSave: (record: RentalRecord) => void;
  initialData?: RentalRecord;
}

// Add this type for form state
interface RentalDetailDraft {
  acres: string;
  equipment_type: 'Cage Wheel' | 'Rotator';
  rounds: string;
}

export function RentalForm({ onClose, onSave, initialData }: RentalFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    details: initialData?.details?.length
      ? initialData.details.map(d => ({
          acres: String(d.acres),
          equipment_type: d.equipment_type,
          rounds: String(d.rounds),
        }))
      : [{ acres: '', equipment_type: 'Cage Wheel', rounds: '' }],
    received_amount: initialData ? String(initialData.received_amount) : '',
    old_balance: initialData?.old_balance || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate total for all sets
  const totalAmount = formData.details.reduce((sum, d) => {
    if (d.acres && d.rounds) {
      return sum + calculateTotalAmount(
        parseFloat(d.acres) || 0,
        parseFloat(d.rounds) || 0,
        d.equipment_type as 'Cage Wheel' | 'Rotator'
      );
    }
    return sum;
  }, 0);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'பெயர் அவசியம்';
    }
    formData.details.forEach((d, i) => {
      if (!d.acres || parseFloat(d.acres) <= 0) {
        newErrors[`acres_${i}`] = 'சரியான மா எண்ணை உள்ளிடவும்';
      }
      if (!d.rounds || parseFloat(d.rounds) <= 0) {
        newErrors[`rounds_${i}`] = 'சரியான சால் எண்ணை உள்ளிடவும்';
      }
    });
    if (!formData.received_amount || parseFloat(formData.received_amount) < 0) {
      newErrors.received_amount = 'சரியான பெறப்பட்ட தொகையை உள்ளிடவும்';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDetailChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const details = prev.details.map((d, i) =>
        i === index ? { ...d, [field]: value } : d
      );
      return { ...prev, details };
    });
    if (errors[`${field}_${index}`]) {
      setErrors(prev => ({ ...prev, [`${field}_${index}`]: '' }));
    }
  };

  const handleAddDetail = () => {
    setFormData(prev => ({
      ...prev,
      details: [...prev.details, { acres: '', equipment_type: 'Cage Wheel', rounds: '' }],
    }));
  };

  const handleRemoveDetail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const details: RentalDetail[] = formData.details.map(d => ({
        acres: parseFloat(d.acres),
        equipment_type: d.equipment_type as 'Cage Wheel' | 'Rotator',
        rounds: parseFloat(d.rounds),
      }));
      const recordData = {
        name: formData.name.trim(),
        details,
        total_amount: totalAmount,
        received_amount: parseFloat(formData.received_amount),
        old_balance: formData.old_balance || undefined,
      };
      let newRecord;
      if (initialData) {
        newRecord = await rentalService.update(initialData.id, recordData);
      } else {
        newRecord = await rentalService.create(recordData);
      }
      onSave(newRecord);
    } catch (error) {
      console.error('Error saving record:', error);
      setErrors({ submit: 'பதிவு சேமிப்பதில் பிழை ஏற்பட்டது' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div className="bg-blue-600 text-white p-6 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">புதிய வாடகை பதிவு</h2>
                <p className="text-blue-100 mt-1">KBS Tractors</p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-blue-700 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Customer Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                பெயர் *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="வாடகை பெறுபவரின் பெயர்"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Details Sets */}
            {formData.details.map((d, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">மா *</label>
                  <input
                    type="number"
                    value={d.acres}
                    onChange={e => handleDetailChange(i, 'acres', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`acres_${i}`] ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="மா எண்ணிக்கை"
                    min="0"
                    step="0.1"
                  />
                  {errors[`acres_${i}`] && <p className="text-red-500 text-sm mt-1">{errors[`acres_${i}`]}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">வகை *</label>
                  <select
                    value={d.equipment_type}
                    onChange={e => handleDetailChange(i, 'equipment_type', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Cage Wheel">Cage Wheel (₹{EQUIPMENT_RATES['Cage Wheel']}/சால்)</option>
                    <option value="புழுதி">புழுதி (₹{EQUIPMENT_RATES['Cage Wheel']}/சால்)</option>
                    <option value="Rotator">Rotator (₹{EQUIPMENT_RATES['Rotator']}/சால்)</option>
                  </select>
                </div>
                <div className="col-span-2 mt-2 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">சால் *</label>
                    <input
                      type="number"
                      value={d.rounds}
                      onChange={e => handleDetailChange(i, 'rounds', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`rounds_${i}`] ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="சால் எண்ணிக்கை"
                      min="0"
                      step="1"
                    />
                    {errors[`rounds_${i}`] && <p className="text-red-500 text-sm mt-1">{errors[`rounds_${i}`]}</p>}
                  </div>
                  {formData.details.length > 1 && (
                    <button type="button" onClick={() => handleRemoveDetail(i)} className="ml-2 text-red-500 hover:text-red-700 text-lg font-bold px-2 py-1 rounded-full">×</button>
                  )}
                  {i === formData.details.length - 1 && (
                    <button type="button" onClick={handleAddDetail} className="ml-2 text-blue-500 hover:text-blue-700 text-lg font-bold px-2 py-1 rounded-full">+</button>
                  )}
                </div>
              </div>
            ))}

            {/* Calculation Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-sm font-medium text-blue-900">தானியங்கி கணக்கீடு</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">மொத்த தொகை:</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-lg font-bold text-blue-900">
                  மொத்த தொகை: {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>

            {/* Received Amount */}
            <div className="mt-4">
              <label htmlFor="received_amount" className="block text-sm font-medium text-gray-700 mb-2">
                பெறப்பட்ட தொகை (₹) *
              </label>
              <input
                type="number"
                id="received_amount"
                value={formData.received_amount}
                onChange={e => setFormData(prev => ({ ...prev, received_amount: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.received_amount ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="பெறப்பட்ட தொகை"
                min="0"
                step="0.01"
              />
              {errors.received_amount && <p className="text-red-500 text-sm mt-1">{errors.received_amount}</p>}
            </div>

            {/* Old Balance (பழைய பாக்கி) - after total amount, mobile friendly */}
            <div className="mt-4">
              <label htmlFor="old_balance" className="block text-sm font-medium text-gray-700 mb-2">
                பழைய பாக்கி
              </label>
              <input
                type="text"
                id="old_balance"
                value={formData.old_balance || ''}
                onChange={e => setFormData(prev => ({ ...prev, old_balance: e.target.value }))}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-base"
                placeholder="பழைய பாக்கி (விரும்பினால்)"
                autoComplete="off"
              />
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    சேமிக்கவும்
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5 mr-2" />
                ரத்து செய்
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
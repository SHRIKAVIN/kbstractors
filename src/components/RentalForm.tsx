import React, { useState, useEffect } from 'react';
import { Save, X, Calculator } from 'lucide-react';
import { rentalService } from '../lib/supabase';
import { calculateTotalAmount, formatCurrency, EQUIPMENT_RATES } from '../utils/calculations';
import type { RentalRecord } from '../types/rental';

interface RentalFormProps {
  onClose: () => void;
  onSave: (record: RentalRecord) => void;
  initialData?: RentalRecord;
}

export function RentalForm({ onClose, onSave, initialData }: RentalFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    acres: initialData ? String(initialData.acres) : '',
    equipment_type: initialData?.equipment_type || 'Cage Wheel',
    rounds: initialData ? String(initialData.rounds) : '',
    received_amount: initialData ? String(initialData.received_amount) : '',
    acres2: initialData?.acres2 !== undefined && initialData?.acres2 !== null ? String(initialData.acres2) : '',
    equipment_type2: initialData?.equipment_type2 || 'Cage Wheel',
    rounds2: initialData?.rounds2 !== undefined && initialData?.rounds2 !== null ? String(initialData.rounds2) : ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate total for both sets
  const totalAmount1 = formData.acres && formData.rounds
    ? calculateTotalAmount(
        parseFloat(formData.acres) || 0,
        parseFloat(formData.rounds) || 0,
        formData.equipment_type as 'Cage Wheel' | 'Rotator'
      )
    : 0;
  const totalAmount2 = formData.acres2 && formData.rounds2
    ? calculateTotalAmount(
        parseFloat(formData.acres2) || 0,
        parseFloat(formData.rounds2) || 0,
        formData.equipment_type2 as 'Cage Wheel' | 'Rotator'
      )
    : 0;
  const totalAmount = totalAmount1 + totalAmount2;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'பெயர் அவசியம்';
    }

    if (!formData.acres || parseFloat(formData.acres) <= 0) {
      newErrors.acres = 'சரியான மா எண்ணை உள்ளிடவும்';
    }

    if (!formData.rounds || parseFloat(formData.rounds) <= 0) {
      newErrors.rounds = 'சரியான சால் எண்ணை உள்ளிடவும்';
    }

    if (!formData.received_amount || parseFloat(formData.received_amount) < 0) {
      newErrors.received_amount = 'சரியான பெறப்பட்ட தொகையை உள்ளிடவும்';
    }
    // No required validation for acres2/rounds2
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const recordData = {
        name: formData.name.trim(),
        acres: parseFloat(formData.acres || '0'),
        equipment_type: formData.equipment_type,
        rounds: parseFloat(formData.rounds || '0'),
        acres2: formData.acres2 ? parseFloat(formData.acres2) : undefined,
        equipment_type2: formData.acres2 && formData.rounds2 ? formData.equipment_type2 : undefined,
        rounds2: formData.rounds2 ? parseFloat(formData.rounds2) : undefined,
        total_amount: totalAmount,
        received_amount: parseFloat(formData.received_amount)
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="வாடகை பெறுபவரின் பெயர்"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Acres and Equipment Type Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="acres" className="block text-sm font-medium text-gray-700 mb-2">
                  மா *
                </label>
                <input
                  type="number"
                  id="acres"
                  value={formData.acres}
                  onChange={(e) => handleInputChange('acres', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.acres ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="மா எண்ணிக்கை"
                  min="0"
                  step="0.1"
                />
                {errors.acres && <p className="text-red-500 text-sm mt-1">{errors.acres}</p>}
              </div>
              <div>
                <label htmlFor="equipment_type" className="block text-sm font-medium text-gray-700 mb-2">
                  வகை *
                </label>
                <select
                  id="equipment_type"
                  value={formData.equipment_type}
                  onChange={(e) => handleInputChange('equipment_type', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Cage Wheel">Cage Wheel (₹{EQUIPMENT_RATES['Cage Wheel']}/சால்)</option>
                  <option value="Rotator">Rotator (₹{EQUIPMENT_RATES['Rotator']}/சால்)</option>
                </select>
              </div>
            </div>
            {/* Rounds 1 */}
            <div>
              <label htmlFor="rounds" className="block text-sm font-medium text-gray-700 mb-2">
                சால் *
              </label>
              <input
                type="number"
                id="rounds"
                value={formData.rounds}
                onChange={(e) => handleInputChange('rounds', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.rounds ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="சால் எண்ணிக்கை"
                min="0"
                step="1"
              />
              {errors.rounds && <p className="text-red-500 text-sm mt-1">{errors.rounds}</p>}
            </div>
            {/* Acres and Equipment Type Row 2 (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="acres2" className="block text-sm font-medium text-gray-700 mb-2">
                  மா
                </label>
                <input
                  type="number"
                  id="acres2"
                  value={formData.acres2}
                  onChange={(e) => handleInputChange('acres2', e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="மா எண்ணிக்கை"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label htmlFor="equipment_type2" className="block text-sm font-medium text-gray-700 mb-2">
                  வகை
                </label>
                <select
                  id="equipment_type2"
                  value={formData.equipment_type2}
                  onChange={(e) => handleInputChange('equipment_type2', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Cage Wheel">Cage Wheel (₹{EQUIPMENT_RATES['Cage Wheel']}/சால்)</option>
                  <option value="Rotator">Rotator (₹{EQUIPMENT_RATES['Rotator']}/சால்)</option>
                </select>
              </div>
            </div>
            {/* Rounds 2 (optional) */}
            <div>
              <label htmlFor="rounds2" className="block text-sm font-medium text-gray-700 mb-2">
                சால்
              </label>
              <input
                type="number"
                id="rounds2"
                value={formData.rounds2}
                onChange={(e) => handleInputChange('rounds2', e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="சால் எண்ணிக்கை"
                min="0"
                step="1"
              />
            </div>
            {/* Calculation Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-sm font-medium text-blue-900">தானியங்கி கணக்கீடு</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">முதல் தொகுதி:</p>
                  <p className="font-semibold text-gray-900">{formData.acres || 0} × {formData.rounds || 0} × ₹{EQUIPMENT_RATES[formData.equipment_type as 'Cage Wheel' | 'Rotator']} = {formatCurrency(totalAmount1)}</p>
                </div>
                {formData.acres2 && formData.rounds2 ? (
                  <div>
                    <p className="text-gray-600">இரண்டாம் தொகுதி:</p>
                    <p className="font-semibold text-gray-900">{formData.acres2 || 0} × {formData.rounds2 || 0} × ₹{EQUIPMENT_RATES[formData.equipment_type2 as 'Cage Wheel' | 'Rotator']} = {formatCurrency(totalAmount2)}</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-lg font-bold text-blue-900">
                  மொத்த தொகை: {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>

            {/* Received Amount */}
            <div>
              <label htmlFor="received_amount" className="block text-sm font-medium text-gray-700 mb-2">
                பெறப்பட்ட தொகை (₹) *
              </label>
              <input
                type="number"
                id="received_amount"
                value={formData.received_amount}
                onChange={(e) => handleInputChange('received_amount', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.received_amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="பெறப்பட்ட தொகை"
                min="0"
                step="0.01"
              />
              {errors.received_amount && <p className="text-red-500 text-sm mt-1">{errors.received_amount}</p>}
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
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5 mr-2" />
                ரத்து செய்
              </button>
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
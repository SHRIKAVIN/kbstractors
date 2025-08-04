import React, { useState } from 'react';
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
  equipment_type: 'Cage Wheel' | 'Rotavator' | 'புழுதி' | 'Mini' | 'Dipper';
  rounds: string;
  nadai: string; // input as string, parse as number for calculation
}

export function RentalForm({ onClose, onSave, initialData }: RentalFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    details: initialData?.details?.length
      ? initialData.details.map(d => ({
          acres: d.equipment_type === 'Dipper' ? '' : String(d.acres ?? ''),
          equipment_type: d.equipment_type as RentalDetailDraft['equipment_type'],
          rounds: d.equipment_type === 'Dipper' ? '' : String(d.rounds ?? ''),
          nadai: d.equipment_type === 'Dipper' ? d.nadai ?? '' : '',
        }))
      : [{ acres: '', equipment_type: 'Cage Wheel', rounds: '', nadai: '' }],
    received_amount: initialData ? String(initialData.received_amount) : '',
    old_balance: initialData?.old_balance || '',
    old_balance_reason: initialData?.old_balance_reason || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Add state for oldBalanceOnly
  const [oldBalanceOnly, setOldBalanceOnly] = useState(
    initialData && (!initialData.details || initialData.details.length === 0) && initialData.old_balance ? true : false
  );
  const [oldBalanceStatus, setOldBalanceStatus] = useState<'paid' | 'pending'>(
    (initialData && initialData.old_balance_status) ? initialData.old_balance_status : 'pending'
  );
  // Add state to control showing old balance section in full form
  const [showOldBalanceSection, setShowOldBalanceSection] = useState(
    !!(initialData && initialData.old_balance && !oldBalanceOnly)
  );

  // Calculate total for all sets
  const totalAmount = formData.details.reduce((sum, d) => {
    if (d.equipment_type === 'Dipper') {
      const n = parseInt(String(d.nadai), 10);
      if (!isNaN(n) && n > 0) {
        return sum + n * 500;
      }
      return sum;
    }
    if (d.acres && d.rounds) {
      return sum + calculateTotalAmount(
        parseFloat(d.acres) || 0,
        parseFloat(d.rounds) || 0,
        d.equipment_type as 'Cage Wheel' | 'Rotavator' | 'புழுதி' | 'Mini'
      );
    }
    return sum;
  }, 0) + (!oldBalanceOnly && showOldBalanceSection && formData.old_balance && oldBalanceStatus === 'pending' ? parseFloat(formData.old_balance) || 0 : 0);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'பெயர் அவசியம்';
    }
    if (oldBalanceOnly) {
      if (!formData.old_balance || !formData.old_balance.trim()) {
        newErrors.old_balance = 'பழைய பாக்கி அவசியம்';
      }
    } else {
      formData.details.forEach((d, i) => {
        if (d.equipment_type === 'Dipper') {
          const n = parseInt(String(d.nadai), 10);
          if (!d.nadai || isNaN(n) || n <= 0) {
            newErrors[`nadai_${i}`] = 'சரியான நடை எண்ணை உள்ளிடவும்';
          }
        } else {
          if (!d.acres || parseFloat(d.acres) <= 0) {
            newErrors[`acres_${i}`] = 'சரியான மா எண்ணை உள்ளிடவும்';
          }
          if (!d.rounds || parseFloat(d.rounds) <= 0) {
            newErrors[`rounds_${i}`] = 'சரியான சால் எண்ணை உள்ளிடவும்';
          }
        }
      });
      if (!formData.received_amount || parseFloat(formData.received_amount) < 0) {
        newErrors.received_amount = 'சரியான பெறப்பட்ட தொகையை உள்ளிடவும்';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDetailChange = (index: number, field: keyof RentalDetailDraft, value: string) => {
    setFormData(prev => {
      const details = (prev.details as RentalDetailDraft[]).map((d, i) =>
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
      details: [...(prev.details as RentalDetailDraft[]), { acres: '', equipment_type: 'Cage Wheel', rounds: '', nadai: '' }],
    }));
  };

  const handleRemoveDetail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      details: (prev.details as RentalDetailDraft[]).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      let recordData;
      if (oldBalanceOnly) {
        const oldBalanceValue = parseFloat(formData.old_balance) || 0;
        recordData = {
          name: formData.name.trim(),
          old_balance: formData.old_balance || undefined,
          old_balance_status: oldBalanceStatus,
          old_balance_reason: formData.old_balance_reason || undefined,
          details: [],
          total_amount: oldBalanceValue,
          received_amount: oldBalanceStatus === 'paid' ? oldBalanceValue : 0,
        };
      } else {
        const details: RentalDetail[] = formData.details.map(d => {
          if (d.equipment_type === 'Dipper') {
            return {
              equipment_type: 'Dipper',
              nadai: d.nadai ? parseInt(String(d.nadai), 10) : 0,
              acres: 0,
              rounds: 0,
            };
          } else {
            return {
              acres: parseFloat(d.acres),
              equipment_type: d.equipment_type as any,
              rounds: parseFloat(d.rounds),
            };
          }
        });
        recordData = {
          name: formData.name.trim(),
          details,
          total_amount: totalAmount,
          received_amount: parseFloat(formData.received_amount),
          ...(showOldBalanceSection && formData.old_balance
            ? {
                old_balance: formData.old_balance,
                old_balance_status: oldBalanceStatus,
                old_balance_reason: formData.old_balance_reason || undefined
              }
            : {
                old_balance: undefined,
                old_balance_status: undefined,
                old_balance_reason: undefined
              }
          )
        };
      }
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
    <div data-testid="rental-form-container" className="min-h-screen bg-gray-50 py-8 px-2 sm:px-4">
      <div data-testid="rental-form-wrapper" className="max-w-2xl mx-auto">
        <div data-testid="rental-form-card" className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div data-testid="rental-form-header" className="bg-blue-600 text-white p-4 sm:p-6 rounded-t-lg">
            <div data-testid="header-content" className="flex items-center justify-between">
              <div data-testid="header-text">
                <h2 data-testid="form-title" className="text-lg sm:text-xl font-bold">
                  {initialData ? 
                    (oldBalanceOnly ? 'பழைய பாக்கி திருத்தம்' : 'வாடகை பதிவு திருத்தம்') : 
                    'புதிய வாடகை பதிவு'
                  }
                </h2>
                <p data-testid="form-subtitle" className="text-blue-100 mt-1 text-xs sm:text-sm">KBS Tractors</p>
              </div>
              <button
                data-testid="close-button"
                onClick={onClose}
                className="text-white hover:bg-blue-700 p-2 rounded-lg transition-colors"
              >
                <X data-testid="close-icon" className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form data-testid="rental-form" onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-x-auto">
            {/* Old Balance Only Checkbox */}
            <div data-testid="old-balance-only-container" className="mb-2 sm:mb-4 flex items-center">
              <input
                data-testid="old-balance-only-checkbox"
                type="checkbox"
                id="oldBalanceOnly"
                checked={oldBalanceOnly}
                onChange={e => setOldBalanceOnly(e.target.checked)}
                disabled={!!initialData && oldBalanceOnly} // Disable if editing old balance only
                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label data-testid="old-balance-only-label" htmlFor="oldBalanceOnly" className="text-xs sm:text-sm font-medium text-gray-700 select-none">பழைய பாக்கி மட்டும்</label>
            </div>

            {oldBalanceOnly ? (
              <>
                {/* Name Field */}
                <div data-testid="name-field-container">
                  <label data-testid="name-label" htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">பெயர் *</label>
                  <input
                    data-testid="name-input"
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                    placeholder="வாடகை பெறுபவரின் பெயர்"
                  />
                  {errors.name && <p data-testid="name-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.name}</p>}
                </div>
                {/* Old Balance Field */}
                <div data-testid="old-balance-field-container" className="mt-2 sm:mt-4">
                  <label data-testid="old-balance-label" htmlFor="old_balance" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">பழைய பாக்கி *</label>
                  <input
                    data-testid="old-balance-input"
                    type="text"
                    id="old_balance"
                    value={formData.old_balance || ''}
                    onChange={e => setFormData(prev => ({ ...prev, old_balance: e.target.value }))}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                    placeholder="பழைய பாக்கி"
                    autoComplete="off"
                  />
                </div>
                {/* Old Balance Status Dropdown */}
                <div data-testid="old-balance-status-container" className="mt-2 sm:mt-4">
                  <label data-testid="old-balance-status-label" htmlFor="old_balance_status" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">நிலை *</label>
                  <select
                    data-testid="old-balance-status-select"
                    id="old_balance_status"
                    value={oldBalanceStatus}
                    onChange={e => setOldBalanceStatus(e.target.value as 'paid' | 'pending')}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                  >
                    <option value="pending">நிலுவையில்</option>
                    <option value="paid">முழுமையாக பெறப்பட்டது</option>
                  </select>
                </div>
                {/* Old Balance Reason Field */}
                <div data-testid="old-balance-reason-container" className="mt-2 sm:mt-4">
                  <label data-testid="old-balance-reason-label" htmlFor="old_balance_reason" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">காரணம் (விவரம்)</label>
                  <input
                    data-testid="old-balance-reason-input"
                    type="text"
                    id="old_balance_reason"
                    value={formData.old_balance_reason || ''}
                    onChange={e => setFormData(prev => ({ ...prev, old_balance_reason: e.target.value }))}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                    placeholder="காரணம்"
                    autoComplete="off"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Customer Name */}
                <div data-testid="customer-name-container">
                  <label data-testid="customer-name-label" htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    பெயர் *
                  </label>
                  <input
                    data-testid="customer-name-input"
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                    placeholder="வாடகை பெறுபவரின் பெயர்"
                  />
                  {errors.name && <p data-testid="customer-name-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.name}</p>}
                </div>

                {/* Details Sets */}
                <div data-testid="details-sets-container" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formData.details.map((d, i) => {
                    const isDipper = d.equipment_type === 'Dipper';
                    return (
                      <div key={i} data-testid={`detail-set-${i}`} className="relative border-2 border-blue-200 bg-blue-50 rounded-xl p-4 mb-2 shadow-md hover:shadow-lg transition-shadow">
                        {formData.details.length > 1 && (
                          <span data-testid={`detail-set-number-${i}`} className="absolute -top-3 left-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">{i + 1}</span>
                        )}
                        {/* Action buttons in top right corner */}
                        <div data-testid={`detail-actions-${i}`} className="absolute top-2 right-2 flex gap-1">
                          {formData.details.length > 1 && (
                            <button 
                              data-testid={`remove-detail-button-${i}`} 
                              type="button" 
                              onClick={() => handleRemoveDetail(i)} 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-lg font-bold w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                              title="Remove this item"
                            >
                              ×
                            </button>
                          )}
                          {i === formData.details.length - 1 && (
                            <button 
                              data-testid={`add-detail-button-${i}`} 
                              type="button" 
                              onClick={handleAddDetail} 
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-lg font-bold w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                              title="Add new item"
                            >
                              +
                            </button>
                          )}
                        </div>
                        {/* Always show type dropdown */}
                        <div data-testid={`equipment-type-container-${i}`} className="sm:border-l sm:border-gray-300 sm:pl-4">
                          <label data-testid={`equipment-type-label-${i}`} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">வகை *</label>
                          <select
                            data-testid={`equipment-type-select-${i}`}
                            value={d.equipment_type}
                            onChange={e => handleDetailChange(i, 'equipment_type', e.target.value)}
                            className="w-full px-2 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-base"
                          >
                            <option value="Cage Wheel">Cage Wheel (₹{EQUIPMENT_RATES['Cage Wheel']}/சால்)</option>
                            <option value="புழுதி">புழுதி (₹{EQUIPMENT_RATES['Cage Wheel']}/சால்)</option>
                            <option value="Rotavator">Rotavator (₹{EQUIPMENT_RATES['Rotavator']}/சால்)</option>
                            <option value="Mini">Mini (₹{EQUIPMENT_RATES['Mini']}/சால்)</option>
                            <option value="Dipper">Dipper (₹500)</option>
                          </select>
                        </div>
                        {/* Type-specific fields */}
                        {isDipper ? (
                          <>
                            <div data-testid={`dipper-fields-${i}`} className="sm:col-span-2">
                              <label data-testid={`nadai-label-${i}`} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">நடை *</label>
                              <input
                                data-testid={`nadai-input-${i}`}
                                type="number"
                                value={d.nadai}
                                onChange={e => handleDetailChange(i, 'nadai', e.target.value)}
                                className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`nadai_${i}`] ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                                placeholder="நடை எண்ணிக்கை"
                                min="1"
                                step="1"
                              />
                              {errors[`nadai_${i}`] && <p data-testid={`nadai-error-${i}`} className="text-red-500 text-xs sm:text-sm mt-1">{errors[`nadai_${i}`]}</p>}
                            </div>
                            <div data-testid={`dipper-amount-${i}`} className="sm:col-span-2 mt-2">
                              <label data-testid={`dipper-amount-label-${i}`} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">தொகை</label>
                              <input
                                data-testid={`dipper-amount-input-${i}`}
                                type="number"
                                value={500}
                                readOnly
                                className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg bg-gray-100 text-xs sm:text-base"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div data-testid={`acres-container-${i}`}>
                              <label data-testid={`acres-label-${i}`} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">மா *</label>
                              <input
                                data-testid={`acres-input-${i}`}
                                type="number"
                                value={d.acres}
                                onChange={e => handleDetailChange(i, 'acres', e.target.value)}
                                className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`acres_${i}`] ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                                placeholder="மா எண்ணிக்கை"
                                min="0"
                                step="0.1"
                              />
                              {errors[`acres_${i}`] && <p data-testid={`acres-error-${i}`} className="text-red-500 text-xs sm:text-sm mt-1">{errors[`acres_${i}`]}</p>}
                            </div>
                            <div data-testid={`rounds-container-${i}`} className="col-span-1 sm:col-span-2 mt-2 flex items-center gap-2">
                              <div data-testid={`rounds-field-${i}`} className="flex-1">
                                <label data-testid={`rounds-label-${i}`} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">சால் *</label>
                                <input
                                  data-testid={`rounds-input-${i}`}
                                  type="number"
                                  value={d.rounds}
                                  onChange={e => handleDetailChange(i, 'rounds', e.target.value)}
                                  className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`rounds_${i}`] ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                                  placeholder="சால் எண்ணிக்கை"
                                  min="0"
                                  step="1"
                                />
                                {errors[`rounds_${i}`] && <p data-testid={`rounds-error-${i}`} className="text-red-500 text-xs sm:text-sm mt-1">{errors[`rounds_${i}`]}</p>}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Calculation Display */}
                <div data-testid="calculation-display" className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
                  <div data-testid="calculation-header" className="flex items-center mb-2 sm:mb-3">
                    <Calculator data-testid="calculator-icon" className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mr-2" />
                    <h3 data-testid="calculation-title" className="text-xs sm:text-sm font-medium text-blue-900">தானியங்கி கணக்கீடு</h3>
                  </div>
                  <div data-testid="calculation-items" className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    {formData.details.map((d, i) => {
                      let amount = 0;
                      let summary = '';
                      if (d.equipment_type === 'Dipper') {
                        amount = 500 * (parseInt(String(d.nadai)) || 0);
                        summary = `${String(d.nadai)} நடை . Dipper`;
                      } else {
                        amount = calculateTotalAmount(
                          parseFloat(d.acres) || 0,
                          parseFloat(d.rounds) || 0,
                          d.equipment_type as 'Cage Wheel' | 'Rotavator' | 'புழுதி' | 'Mini'
                        );
                        summary = `${d.acres} மா . ${d.rounds} சால் . ${d.equipment_type}`;
                      }
                      return (
                        <div key={i} data-testid={`calculation-item-${i}`} className="flex items-center gap-2 text-xs sm:text-sm">
                          <span data-testid={`calculation-summary-${i}`}>{summary} - ₹{amount}</span>
                        </div>
                      );
                    })}
                    {!oldBalanceOnly && showOldBalanceSection && formData.old_balance && (
                      <div data-testid="old-balance-calculation" className="flex items-center gap-2 text-xs sm:text-sm">
                        <span data-testid="old-balance-calculation-text">பழைய பாக்கி - ₹{formData.old_balance}</span>
                      </div>
                    )}
                  </div>
                  <div data-testid="total-calculation" className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-blue-200">
                    <p data-testid="total-amount-display" className="text-base sm:text-lg font-bold text-blue-900">
                      மொத்த தொகை: {formatCurrency(totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Received Amount */}
                <div data-testid="received-amount-container" className="mt-2 sm:mt-4">
                  <label data-testid="received-amount-label" htmlFor="received_amount" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    பெறப்பட்ட தொகை (₹) *
                  </label>
                  <input
                    data-testid="received-amount-input"
                    type="number"
                    id="received_amount"
                    value={formData.received_amount}
                    onChange={e => setFormData(prev => ({ ...prev, received_amount: e.target.value }))}
                    className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.received_amount ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                    placeholder="பெறப்பட்ட தொகை"
                    min="0"
                    step="0.01"
                  />
                  {errors.received_amount && <p data-testid="received-amount-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.received_amount}</p>}
                </div>
                {!oldBalanceOnly && (
                  <div data-testid="old-balance-toggle-container" className="flex items-center mt-2">
                    {!showOldBalanceSection ? (
                      <button
                        data-testid="add-old-balance-button"
                        type="button"
                        onClick={() => setShowOldBalanceSection(true)}
                        className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        <span data-testid="add-old-balance-icon" className="text-lg font-bold mr-1">+</span>
                        <span data-testid="add-old-balance-text">பழைய பாக்கி இருந்தால்</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </>
            )}

            {/* Show old balance fields in full form if showOldBalanceSection is true */}
            {!oldBalanceOnly && showOldBalanceSection && (
              <div data-testid="old-balance-section" className="mt-2 sm:mt-4 border p-3 pt-7 rounded-lg bg-gray-50 relative">
                <button
                  data-testid="remove-old-balance-button"
                  type="button"
                  onClick={() => {
                    setShowOldBalanceSection(false);
                    setFormData(prev => ({ ...prev, old_balance: '', old_balance_status: '', old_balance_reason: '' }));
                  }}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl font-bold px-2 py-1 rounded-full z-10"
                  title="பழைய பாக்கி நீக்கு"
                >
                  ×
                </button>
                <label data-testid="full-form-old-balance-label" htmlFor="old_balance" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">பழைய பாக்கி *</label>
                <input
                  data-testid="full-form-old-balance-input"
                  type="text"
                  id="old_balance"
                  value={formData.old_balance || ''}
                  onChange={e => setFormData(prev => ({ ...prev, old_balance: e.target.value }))}
                  className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                  placeholder="பழைய பாக்கி"
                  autoComplete="off"
                />
                <div data-testid="full-form-old-balance-status-container" className="mt-2">
                  <label data-testid="full-form-old-balance-status-label" htmlFor="old_balance_status" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">நிலை *</label>
                  <select
                    data-testid="full-form-old-balance-status-select"
                    id="old_balance_status"
                    value={oldBalanceStatus}
                    onChange={e => setOldBalanceStatus(e.target.value as 'paid' | 'pending')}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                  >
                    <option value="pending">நிலுவையில்</option>
                    <option value="paid">முழுமையாக பெறப்பட்டது</option>
                  </select>
                </div>
                {/* Old Balance Reason Field */}
                <div data-testid="full-form-old-balance-reason-container" className="mt-2 sm:mt-4">
                  <label data-testid="full-form-old-balance-reason-label" htmlFor="old_balance_reason" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">காரணம் (விவரம்)</label>
                  <input
                    data-testid="full-form-old-balance-reason-input"
                    type="text"
                    id="old_balance_reason"
                    value={formData.old_balance_reason || ''}
                    onChange={e => setFormData(prev => ({ ...prev, old_balance_reason: e.target.value }))}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                    placeholder="காரணம்"
                    autoComplete="off"
                  />
                </div>
                {formData.old_balance && (
                  <div data-testid="old-balance-display" className="mt-2 text-sm font-bold" style={{ color: oldBalanceStatus === 'paid' ? 'green' : 'red' }}>
                    <span data-testid="old-balance-display-text">பழைய பாக்கி: ₹{formData.old_balance}</span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div data-testid="submit-error" className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p data-testid="submit-error-message" className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div data-testid="action-buttons" className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                data-testid="save-button"
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div data-testid="save-loading-spinner" className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save data-testid="save-icon" className="w-5 h-5 mr-2" />
                    <span data-testid="save-button-text">சேமிக்கவும்</span>
                  </>
                )}
              </button>
              <button
                data-testid="cancel-button"
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <X data-testid="cancel-icon" className="w-5 h-5 mr-2" />
                <span data-testid="cancel-button-text">ரத்து செய்</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

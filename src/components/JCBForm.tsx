import React, { useState } from 'react';
import { Save, X, Calculator, Phone, Calendar, Building, User } from 'lucide-react';
import { jcbService } from '../lib/jcb-supabase';
import { calculateJCBTotalAmount, formatCurrency, JCB_EQUIPMENT_RATES } from '../utils/jcb-calculations';
import type { JCBRecord, JCBDetail } from '../types/jcb';

interface JCBFormProps {
  onClose: () => void;
  onSave: (record: JCBRecord) => void;
  initialData?: JCBRecord;
}

// Add this type for form state
interface JCBDetailDraft {
  hours: string;
  equipment_type: 'JCB';
}

export function JCBForm({ onClose, onSave, initialData }: JCBFormProps) {
  const [formData, setFormData] = useState({
    company_name: initialData?.company_name || '',
    driver_name: initialData?.driver_name || '',
    mobile_number: initialData?.mobile_number || '',
    work_date: initialData?.work_date || new Date().toISOString().split('T')[0],
    details: initialData?.details?.length
      ? initialData.details.map(d => ({
          hours: String(d.hours ?? ''),
          equipment_type: d.equipment_type as JCBDetailDraft['equipment_type'],
        }))
      : [{ hours: '', equipment_type: 'JCB' }],
    amount_received: initialData ? String(initialData.amount_received || '') : '',
    advance_amount: initialData ? String(initialData.advance_amount || '') : '',
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
    if (d.hours && d.equipment_type) {
      return sum + calculateJCBTotalAmount(
        parseFloat(d.hours) || 0,
        d.equipment_type
      );
    }
    return sum;
  }, 0) + (!oldBalanceOnly && showOldBalanceSection && formData.old_balance && oldBalanceStatus === 'pending' ? parseFloat(formData.old_balance) || 0 : 0);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.company_name.trim()) {
      newErrors.company_name = 'நிறுவனப் பெயர் அவசியம்';
    }
    if (!formData.driver_name.trim()) {
      newErrors.driver_name = 'ஓட்டுநர் பெயர் அவசியம்';
    }
    // Validate mobile number if provided (optional field)
    if (formData.mobile_number.trim() && !validateMobileNumber(formData.mobile_number.trim())) {
      newErrors.mobile_number = 'சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும் (6, 7, 8, 9 தொடங்கும்)';
    }
    if (oldBalanceOnly) {
      if (!formData.old_balance || !formData.old_balance.trim()) {
        newErrors.old_balance = 'பழைய பாக்கி அவசியம்';
      }
    } else {
      formData.details.forEach((d, i) => {
        if (!d.hours || parseFloat(d.hours) <= 0) {
          newErrors[`hours_${i}`] = 'சரியான மணி எண்ணை உள்ளிடவும்';
        }
        // Allow decimal values like 1.03, 1.30, etc.
        const hoursValue = parseFloat(d.hours);
        if (isNaN(hoursValue) || hoursValue <= 0) {
          newErrors[`hours_${i}`] = 'சரியான மணி எண்ணை உள்ளிடவும் (எ.கா: 1.03, 1.30)';
        }
      });
      // Amount validation is not required for JCB
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDetailChange = (index: number, field: keyof JCBDetailDraft, value: string) => {
    setFormData(prev => {
      const details = (prev.details as JCBDetailDraft[]).map((d, i) =>
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
      details: [...(prev.details as JCBDetailDraft[]), { hours: '', equipment_type: 'JCB' }],
    }));
  };

  const handleRemoveDetail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      details: (prev.details as JCBDetailDraft[]).filter((_, i) => i !== index),
    }));
  };

  const handleMobileNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 10) {
      setFormData(prev => ({ ...prev, mobile_number: value }));
      // Clear mobile number errors when user types
      if (errors.mobile_number) {
        setErrors(prev => ({ ...prev, mobile_number: '' }));
      }
    }
  };

  const validateMobileNumber = (mobileNumber: string): boolean => {
    if (!mobileNumber || mobileNumber.trim() === '') {
      return true; // Empty is valid (optional field)
    }
    const trimmed = mobileNumber.trim();
    if (!/^[0-9]{10}$/.test(trimmed)) {
      return false;
    }
    // Check if it starts with valid Indian mobile prefixes (6, 7, 8, 9)
    const firstDigit = parseInt(trimmed.charAt(0));
    return [6, 7, 8, 9].includes(firstDigit);
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
          company_name: formData.company_name.trim(),
          driver_name: formData.driver_name.trim(),
          mobile_number: formData.mobile_number.trim() || null,
          work_date: formData.work_date,
          old_balance: formData.old_balance || undefined,
          old_balance_status: oldBalanceStatus,
          old_balance_reason: formData.old_balance_reason || undefined,
          details: [],
          total_amount: oldBalanceValue,
          amount_received: oldBalanceStatus === 'paid' ? oldBalanceValue : 0,
          advance_amount: 0,
        };
      } else {
        const details: JCBDetail[] = formData.details.map(d => ({
          hours: parseFloat(d.hours),
          equipment_type: d.equipment_type,
        }));
        recordData = {
          company_name: formData.company_name.trim(),
          driver_name: formData.driver_name.trim(),
          mobile_number: formData.mobile_number.trim() || null,
          work_date: formData.work_date,
          details,
          total_amount: totalAmount,
          amount_received: formData.amount_received ? parseFloat(formData.amount_received) : 0,
          advance_amount: formData.advance_amount ? parseFloat(formData.advance_amount) : 0,
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
        newRecord = await jcbService.update(initialData.id, recordData);
      } else {
        newRecord = await jcbService.create(recordData);
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
    <div data-testid="jcb-form-container" className="min-h-screen bg-gray-50 py-8 px-2 sm:px-4">
      <div data-testid="jcb-form-wrapper" className="max-w-2xl mx-auto">
        <div data-testid="jcb-form-card" className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div data-testid="jcb-form-header" className="bg-orange-600 text-white p-4 sm:p-6 rounded-t-lg">
            <div data-testid="header-content" className="flex items-center justify-between">
              <div data-testid="header-text">
                <h2 data-testid="form-title" className="text-lg sm:text-xl font-bold">
                  {initialData ? 
                    (oldBalanceOnly ? 'பழைய பாக்கி திருத்தம்' : 'JCB பதிவு திருத்தம்') : 
                    'புதிய JCB பதிவு'
                  }
                </h2>
                <p data-testid="form-subtitle" className="text-orange-100 mt-1 text-xs sm:text-sm">KBS JCB Services</p>
              </div>
              <button
                data-testid="close-button"
                onClick={onClose}
                className="text-white hover:bg-orange-700 p-2 rounded-lg transition-colors"
              >
                <X data-testid="close-icon" className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form data-testid="jcb-form" onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-x-auto">
            {/* Old Balance Only Checkbox */}
            <div data-testid="old-balance-only-container" className="mb-2 sm:mb-4 flex items-center">
              <input
                data-testid="old-balance-only-checkbox"
                type="checkbox"
                id="oldBalanceOnly"
                checked={oldBalanceOnly}
                onChange={e => setOldBalanceOnly(e.target.checked)}
                disabled={!!initialData && oldBalanceOnly} // Disable if editing old balance only
                className="mr-2 h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <label data-testid="old-balance-only-label" htmlFor="oldBalanceOnly" className="text-xs sm:text-sm font-medium text-gray-700 select-none">பழைய பாக்கி மட்டும்</label>
            </div>

            {oldBalanceOnly ? (
              <>
                {/* Company Name Field */}
                <div data-testid="company-name-field-container">
                  <label data-testid="company-name-label" htmlFor="company_name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">நிறுவனப் பெயர் *</label>
                  <input
                    data-testid="company-name-input"
                    type="text"
                    id="company_name"
                    value={formData.company_name}
                    onChange={e => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.company_name ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                    placeholder="நிறுவனப் பெயர்"
                  />
                  {errors.company_name && <p data-testid="company-name-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.company_name}</p>}
                </div>
                {/* Driver Name Field */}
                <div data-testid="driver-name-field-container" className="mt-2 sm:mt-4">
                  <label data-testid="driver-name-label" htmlFor="driver_name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">ஓட்டுநர் பெயர் *</label>
                  <input
                    data-testid="driver-name-input"
                    type="text"
                    id="driver_name"
                    value={formData.driver_name}
                    onChange={e => setFormData(prev => ({ ...prev, driver_name: e.target.value }))}
                    className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.driver_name ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                    placeholder="ஓட்டுநர் பெயர்"
                  />
                  {errors.driver_name && <p data-testid="driver-name-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.driver_name}</p>}
                </div>
                {/* Mobile Number Field */}
                <div data-testid="mobile-number-field-container" className="mt-2 sm:mt-4">
                  <label data-testid="mobile-number-label" htmlFor="mobile_number" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">மொபைல் எண்</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      data-testid="mobile-number-input"
                      type="tel"
                      id="mobile_number"
                      value={formData.mobile_number}
                      onChange={handleMobileNumberChange}
                      onFocus={() => errors.mobile_number && setErrors(prev => ({ ...prev, mobile_number: '' }))}
                      className={`w-full pl-10 pr-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.mobile_number ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                      placeholder="மொபைல் எண் (10 இலக்கங்கள்)"
                      maxLength={10}
                      pattern="[0-9]{10}"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-xs text-gray-400">{formData.mobile_number.length}/10</span>
                    </div>
                  </div>
                  {errors.mobile_number && <p data-testid="mobile-number-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.mobile_number}</p>}
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
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
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
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
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
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                    placeholder="காரணம்"
                    autoComplete="off"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Company Name */}
                <div data-testid="company-name-container">
                  <label data-testid="company-name-label" htmlFor="company_name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    நிறுவனப் பெயர் *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      data-testid="company-name-input"
                      type="text"
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.company_name ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                      placeholder="நிறுவனப் பெயர்"
                    />
                  </div>
                  {errors.company_name && <p data-testid="company-name-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.company_name}</p>}
                </div>

                {/* Driver Name */}
                <div data-testid="driver-name-container">
                  <label data-testid="driver-name-label" htmlFor="driver_name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    ஓட்டுநர் பெயர் *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      data-testid="driver-name-input"
                      type="text"
                      id="driver_name"
                      value={formData.driver_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, driver_name: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.driver_name ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                      placeholder="ஓட்டுநர் பெயர்"
                    />
                  </div>
                  {errors.driver_name && <p data-testid="driver-name-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.driver_name}</p>}
                </div>

                {/* Customer Mobile Number */}
                <div data-testid="customer-mobile-container">
                  <label data-testid="customer-mobile-label" htmlFor="mobile_number" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    மொபைல் எண்
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className={`h-4 w-4 ${formData.mobile_number.length === 10 && validateMobileNumber(formData.mobile_number) ? 'text-green-500' : 'text-gray-400'}`} />
                    </div>
                    <input
                      data-testid="customer-mobile-input"
                      type="tel"
                      id="mobile_number"
                      value={formData.mobile_number}
                      onChange={handleMobileNumberChange}
                      onFocus={() => errors.mobile_number && setErrors(prev => ({ ...prev, mobile_number: '' }))}
                      className={`w-full pl-10 pr-12 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.mobile_number ? 'border-red-500' : 
                        formData.mobile_number.length === 10 && validateMobileNumber(formData.mobile_number) ? 'border-green-500' : 
                        'border-gray-300'
                      } text-xs sm:text-base`}
                      placeholder="மொபைல் எண் (10 இலக்கங்கள்)"
                      maxLength={10}
                      pattern="[0-9]{10}"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className={`text-xs ${formData.mobile_number.length === 10 && validateMobileNumber(formData.mobile_number) ? 'text-green-500' : 'text-gray-400'}`}>
                        {formData.mobile_number.length}/10
                      </span>
                    </div>
                  </div>
                  {errors.mobile_number && <p data-testid="customer-mobile-error" className="text-red-500 text-xs sm:text-sm mt-1">{errors.mobile_number}</p>}
                </div>

                {/* Work Date */}
                <div data-testid="work-date-container">
                  <label data-testid="work-date-label" htmlFor="work_date" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    வேலை தேதி
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      data-testid="work-date-input"
                      type="date"
                      id="work_date"
                      value={formData.work_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, work_date: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                    />
                  </div>
                </div>

                {/* Details Sets */}
                <div data-testid="details-sets-container" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formData.details.map((d, i) => (
                    <div key={i} data-testid={`detail-set-${i}`} className="relative border-2 border-orange-200 bg-orange-50 rounded-xl p-4 mb-2 shadow-md hover:shadow-lg transition-shadow">
                      {formData.details.length > 1 && (
                        <span data-testid={`detail-set-number-${i}`} className="absolute -top-3 left-3 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">{i + 1}</span>
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
                            className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 text-lg font-bold w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                            title="Add new item"
                          >
                            +
                          </button>
                        )}
                      </div>
                      
                      {/* Equipment Type */}
                      <div data-testid={`equipment-type-container-${i}`} className="sm:border-l sm:border-gray-300 sm:pl-4">
                        <label data-testid={`equipment-type-label-${i}`} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">வகை *</label>
                        <select
                          data-testid={`equipment-type-select-${i}`}
                          value={d.equipment_type}
                          onChange={e => handleDetailChange(i, 'equipment_type', e.target.value)}
                          className="w-full px-2 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-xs sm:text-base"
                        >
                          <option value="JCB">JCB (₹{JCB_EQUIPMENT_RATES['JCB']}/மணி)</option>
                        </select>
                      </div>

                      {/* Hours */}
                      <div data-testid={`hours-container-${i}`}>
                        <label data-testid={`hours-label-${i}`} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">மணி *</label>
                        <input
                          data-testid={`hours-input-${i}`}
                          type="number"
                          value={d.hours}
                          onChange={e => handleDetailChange(i, 'hours', e.target.value)}
                          className={`w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors[`hours_${i}`] ? 'border-red-500' : 'border-gray-300'} text-xs sm:text-base`}
                          placeholder="மணி எண்ணிக்கை (எ.கா: 1.03, 1.30)"
                          min="0"
                          step="0.01"
                        />
                        {errors[`hours_${i}`] && <p data-testid={`hours-error-${i}`} className="text-red-500 text-xs sm:text-sm mt-1">{errors[`hours_${i}`]}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation Display */}
                <div data-testid="calculation-display" className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
                  <div data-testid="calculation-header" className="flex items-center mb-2 sm:mb-3">
                    <Calculator data-testid="calculator-icon" className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 mr-2" />
                    <h3 data-testid="calculation-title" className="text-xs sm:text-sm font-medium text-orange-900">தானியங்கி கணக்கீடு</h3>
                  </div>
                  <div data-testid="calculation-items" className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    {formData.details.map((d, i) => {
                      let amount = 0;
                      let summary = '';
                      if (d.hours && d.equipment_type) {
                        amount = calculateJCBTotalAmount(
                          parseFloat(d.hours) || 0,
                          d.equipment_type
                        );
                        summary = `${d.hours} மணி . ${d.equipment_type}`;
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
                  <div data-testid="total-calculation" className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-orange-200">
                    <p data-testid="total-amount-display" className="text-base sm:text-lg font-bold text-orange-900">
                      மொத்த தொகை: {formatCurrency(totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Amount Received - Not Mandatory */}
                <div data-testid="amount-received-container" className="mt-2 sm:mt-4">
                  <label data-testid="amount-received-label" htmlFor="amount_received" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    பெறப்பட்ட தொகை (₹) (விரும்பினால்)
                  </label>
                  <input
                    data-testid="amount-received-input"
                    type="number"
                    id="amount_received"
                    value={formData.amount_received}
                    onChange={e => setFormData(prev => ({ ...prev, amount_received: e.target.value }))}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                    placeholder="பெறப்பட்ட தொகை (விரும்பினால்)"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Advance Amount - Not Mandatory */}
                <div data-testid="advance-amount-container" className="mt-2 sm:mt-4">
                  <label data-testid="advance-amount-label" htmlFor="advance_amount" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    முன்பணத் தொகை (₹) (விரும்பினால்)
                  </label>
                  <input
                    data-testid="advance-amount-input"
                    type="number"
                    id="advance_amount"
                    value={formData.advance_amount}
                    onChange={e => setFormData(prev => ({ ...prev, advance_amount: e.target.value }))}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
                    placeholder="முன்பணத் தொகை (விரும்பினால்)"
                    min="0"
                    step="0.01"
                  />
                </div>

                {!oldBalanceOnly && (
                  <div data-testid="old-balance-toggle-container" className="flex items-center mt-2">
                    {!showOldBalanceSection ? (
                      <button
                        data-testid="add-old-balance-button"
                        type="button"
                        onClick={() => setShowOldBalanceSection(true)}
                        className="flex items-center text-orange-600 hover:text-orange-800 text-sm font-medium"
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
                  className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
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
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
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
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-xs sm:text-base"
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
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
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

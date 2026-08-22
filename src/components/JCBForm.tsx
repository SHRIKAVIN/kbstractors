import React, { useState } from 'react';
import { Save, X, Calculator, Calendar, Building, User } from 'lucide-react';
// Phone icon was only used by the mobile number field, temporarily commented out below.
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

  // Mobile number field is temporarily commented out below (see JSX), so its
  // change handler is unused for now.
  // const handleMobileNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
  //   if (value.length <= 10) {
  //     setFormData(prev => ({ ...prev, mobile_number: value }));
  //     // Clear mobile number errors when user types
  //     if (errors.mobile_number) {
  //       setErrors(prev => ({ ...prev, mobile_number: '' }));
  //     }
  //   }
  // };

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
    <div data-testid="jcb-form-container" className="min-h-screen bg-gray-50 md:py-8 px-0 sm:px-4">
      <div data-testid="jcb-form-wrapper" className="max-w-2xl mx-auto h-full min-h-screen md:min-h-0">
        <div data-testid="jcb-form-card" className="bg-white rounded-none md:rounded-2xl shadow-none md:shadow-2xl min-h-screen md:min-h-0 flex flex-col">
          {/* Header */}
          <div data-testid="jcb-form-header" className="bg-orange-600 text-white p-4 sm:p-6 rounded-none md:rounded-t-2xl sticky top-0 z-20 shadow-md">
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
                className="text-white hover:bg-orange-700 p-2 rounded-lg transition-colors cursor-pointer"
              >
                <X data-testid="close-icon" className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form data-testid="jcb-form" onSubmit={handleSubmit} className="flex-1 p-4 sm:p-6 space-y-5 pb-24 md:pb-6">
            {/* Old Balance Only Toggle (Segmented Control) */}
            <div data-testid="old-balance-only-container" className="flex bg-gray-150 p-1 rounded-xl w-full max-w-md mx-auto shadow-inner border border-gray-200">
              <input
                data-testid="old-balance-only-checkbox"
                type="checkbox"
                id="oldBalanceOnly"
                checked={oldBalanceOnly}
                onChange={e => setOldBalanceOnly(e.target.checked)}
                disabled={!!initialData && oldBalanceOnly}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => setOldBalanceOnly(false)}
                disabled={!!initialData && oldBalanceOnly}
                className={`flex-1 text-center py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  !oldBalanceOnly
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                JCB பதிவு
              </button>
              <button
                type="button"
                onClick={() => setOldBalanceOnly(true)}
                disabled={!!initialData && !oldBalanceOnly}
                className={`flex-1 text-center py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  oldBalanceOnly
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                பழைய பாக்கி மட்டும்
              </button>
              <label data-testid="old-balance-only-label" htmlFor="oldBalanceOnly" className="hidden">பழைய பாக்கி மட்டும்</label>
            </div>

            {oldBalanceOnly ? (
              <div className="space-y-4">
                {/* Company Name Field */}
                <div data-testid="company-name-field-container" className="space-y-1">
                  <label data-testid="company-name-label" htmlFor="company_name" className="block text-xs sm:text-sm font-semibold text-gray-700">நிறுவனப் பெயர் *</label>
                  <input
                    data-testid="company-name-input"
                    type="text"
                    id="company_name"
                    value={formData.company_name}
                    onChange={e => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.company_name ? 'border-red-500' : 'border-gray-300'} text-sm`}
                    placeholder="நிறுவனப் பெயர்"
                  />
                  {errors.company_name && <p data-testid="company-name-error" className="text-red-500 text-xs mt-1 font-medium">{errors.company_name}</p>}
                </div>
                
                {/* Driver Name Field */}
                <div data-testid="driver-name-field-container" className="space-y-1">
                  <label data-testid="driver-name-label" htmlFor="driver_name" className="block text-xs sm:text-sm font-semibold text-gray-700">ஓட்டுநர் பெயர் *</label>
                  <input
                    data-testid="driver-name-input"
                    type="text"
                    id="driver_name"
                    value={formData.driver_name}
                    onChange={e => setFormData(prev => ({ ...prev, driver_name: e.target.value }))}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.driver_name ? 'border-red-500' : 'border-gray-300'} text-sm`}
                    placeholder="ஓட்டுநர் பெயர்"
                  />
                  {errors.driver_name && <p data-testid="driver-name-error" className="text-red-500 text-xs mt-1 font-medium">{errors.driver_name}</p>}
                </div>

                {/* Mobile Number Field — temporarily commented out
                <div data-testid="mobile-number-field-container" className="space-y-1">
                  <label data-testid="mobile-number-label" htmlFor="mobile_number" className="block text-xs sm:text-sm font-semibold text-gray-700">மொபைல் எண்</label>
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
                      className={`w-full pl-9 pr-12 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.mobile_number ? 'border-red-500' : 'border-gray-300'} text-sm`}
                      placeholder="மொபைல் எண் (10 இலக்கங்கள்)"
                      maxLength={10}
                      pattern="[0-9]{10}"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-xs text-gray-400">{formData.mobile_number.length}/10</span>
                    </div>
                  </div>
                  {errors.mobile_number && <p data-testid="mobile-number-error" className="text-red-500 text-xs mt-1 font-medium">{errors.mobile_number}</p>}
                </div>
                */}

                {/* Old Balance Field */}
                <div data-testid="old-balance-field-container" className="space-y-1">
                  <label data-testid="old-balance-label" htmlFor="old_balance" className="block text-xs sm:text-sm font-semibold text-gray-700">பழைய பாக்கி *</label>
                  <input
                    data-testid="old-balance-input"
                    type="number"
                    id="old_balance"
                    value={formData.old_balance || ''}
                    onChange={e => setFormData(prev => ({ ...prev, old_balance: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-sm"
                    placeholder="பழைய பாக்கி தொகை (₹)"
                    autoComplete="off"
                  />
                </div>

                {/* Old Balance Status Selection */}
                <div data-testid="old-balance-status-container" className="space-y-1.5">
                  <label data-testid="old-balance-status-label" htmlFor="old_balance_status" className="block text-xs sm:text-sm font-semibold text-gray-700">நிலை *</label>
                  <select
                    data-testid="old-balance-status-select"
                    id="old_balance_status"
                    value={oldBalanceStatus}
                    onChange={e => setOldBalanceStatus(e.target.value as 'paid' | 'pending')}
                    className="hidden"
                  >
                    <option value="pending">நிலுவையில்</option>
                    <option value="paid">முழுமையாக பெறப்பட்டது</option>
                  </select>
                  <div className="flex gap-3">
                    {(['pending', 'paid'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setOldBalanceStatus(status)}
                        className={`flex-1 text-center py-2.5 text-xs sm:text-sm font-bold rounded-lg border transition-all cursor-pointer ${
                          oldBalanceStatus === status
                            ? status === 'paid'
                              ? 'bg-green-600 text-white border-green-600 shadow-sm'
                              : 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {status === 'pending' ? 'நிலுவையில்' : 'முழுமையாக பெறப்பட்டது'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Old Balance Reason Field */}
                <div data-testid="old-balance-reason-container" className="space-y-1">
                  <label data-testid="old-balance-reason-label" htmlFor="old_balance_reason" className="block text-xs sm:text-sm font-semibold text-gray-700">காரணம் (விவரம்)</label>
                  <input
                    data-testid="old-balance-reason-input"
                    type="text"
                    id="old_balance_reason"
                    value={formData.old_balance_reason || ''}
                    onChange={e => setFormData(prev => ({ ...prev, old_balance_reason: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-sm"
                    placeholder="காரணம் (எ.கா: ஜூன் உழவு பாக்கி)"
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Company Name */}
                <div data-testid="company-name-container" className="space-y-1">
                  <label data-testid="company-name-label" htmlFor="company_name" className="block text-xs sm:text-sm font-semibold text-gray-700">
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
                      className={`w-full pl-9 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.company_name ? 'border-red-500' : 'border-gray-300'} text-sm`}
                      placeholder="நிறுவனப் பெயர் (Company Name)"
                    />
                  </div>
                  {errors.company_name && <p data-testid="company-name-error" className="text-red-500 text-xs mt-1 font-medium">{errors.company_name}</p>}
                </div>

                {/* Driver Name */}
                <div data-testid="driver-name-container" className="space-y-1">
                  <label data-testid="driver-name-label" htmlFor="driver_name" className="block text-xs sm:text-sm font-semibold text-gray-700">
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
                      className={`w-full pl-9 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.driver_name ? 'border-red-500' : 'border-gray-300'} text-sm`}
                      placeholder="ஓட்டுநர் பெயர் (Driver Name)"
                    />
                  </div>
                  {errors.driver_name && <p data-testid="driver-name-error" className="text-red-500 text-xs mt-1 font-medium">{errors.driver_name}</p>}
                </div>

                {/* Mobile Number — temporarily commented out
                <div data-testid="customer-mobile-container" className="space-y-1">
                  <label data-testid="customer-mobile-label" htmlFor="mobile_number" className="block text-xs sm:text-sm font-semibold text-gray-700">
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
                      className={`w-full pl-9 pr-12 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.mobile_number ? 'border-red-500' :
                        formData.mobile_number.length === 10 && validateMobileNumber(formData.mobile_number) ? 'border-green-500' :
                        'border-gray-300'
                      } text-sm`}
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
                  {errors.mobile_number && <p data-testid="customer-mobile-error" className="text-red-500 text-xs mt-1 font-medium">{errors.mobile_number}</p>}
                </div>
                */}

                {/* Work Date */}
                <div data-testid="work-date-container" className="space-y-1">
                  <label data-testid="work-date-label" htmlFor="work_date" className="block text-xs sm:text-sm font-semibold text-gray-700">
                    வேலை தேதி (Date)
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
                      className="w-full pl-9 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-sm"
                    />
                  </div>
                </div>

                {/* Details Sets */}
                <div data-testid="details-sets-container" className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 border-b pb-1.5 flex justify-between items-center">
                    <span>JCB வேலை விவரங்கள்</span>
                    <button
                      type="button"
                      onClick={handleAddDetail}
                      className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-1.5 rounded-lg hover:bg-orange-100 font-bold transition-colors cursor-pointer"
                    >
                      + வேலை நேரம் சேர்க்க
                    </button>
                  </h3>
                  
                  {formData.details.map((d, i) => (
                    <div key={i} data-testid={`detail-set-${i}`} className="relative border border-orange-100 bg-gradient-to-br from-orange-50/60 to-amber-50/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-all space-y-3">
                      <div className="flex justify-between items-center">
                        <span data-testid={`detail-set-number-${i}`} className="bg-orange-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
                          வேலை {i + 1}
                        </span>
                        <div data-testid={`detail-actions-${i}`} className="flex items-center space-x-1">
                          {formData.details.length > 1 && (
                            <button 
                              data-testid={`remove-detail-button-${i}`} 
                              type="button" 
                              onClick={() => handleRemoveDetail(i)} 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-bold px-2 py-1 rounded-md transition-colors cursor-pointer border border-red-200/50 bg-white"
                              title="Remove item"
                            >
                              நீக்கு
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Equipment Type select dropdown (Hidden but synchronized for testing compatibility) */}
                      <div data-testid={`equipment-type-container-${i}`} className="space-y-1">
                        <label data-testid={`equipment-type-label-${i}`} className="block text-xs font-bold text-gray-600">வகை *</label>
                        <select
                          data-testid={`equipment-type-select-${i}`}
                          value={d.equipment_type}
                          onChange={e => handleDetailChange(i, 'equipment_type', e.target.value as any)}
                          className="hidden"
                        >
                          <option value="JCB">JCB (₹{JCB_EQUIPMENT_RATES['JCB']}/மணி)</option>
                        </select>
                        <div className="px-3 py-2 border rounded-lg bg-orange-50/40 border-orange-200/60 text-xs font-bold text-orange-950 inline-block">
                          🚜 JCB (₹{JCB_EQUIPMENT_RATES['JCB']}/மணி)
                        </div>
                      </div>

                      {/* Hours input */}
                      <div data-testid={`hours-container-${i}`} className="space-y-1">
                        <label data-testid={`hours-label-${i}`} className="block text-xs font-semibold text-gray-700">வேலை நேரம் (மணி) *</label>
                        <input
                          data-testid={`hours-input-${i}`}
                          type="number"
                          value={d.hours}
                          onChange={e => handleDetailChange(i, 'hours', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors[`hours_${i}`] ? 'border-red-500' : 'border-gray-300'} text-sm`}
                          placeholder="மணி எண்ணிக்கை (எ.கா: 1.30, 2.00)"
                          min="0"
                          step="0.01"
                        />
                        {errors[`hours_${i}`] && <p data-testid={`hours-error-${i}`} className="text-red-500 text-xs mt-1 font-medium">{errors[`hours_${i}`]}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation Display */}
                <div data-testid="calculation-display" className="bg-gradient-to-br from-green-50 to-emerald-50/50 border border-green-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-full -mr-4 -mt-4"></div>
                  <div data-testid="calculation-header" className="flex items-center mb-3">
                    <Calculator data-testid="calculator-icon" className="w-5 h-5 text-emerald-600 mr-2" />
                    <h3 data-testid="calculation-title" className="text-sm font-bold text-emerald-950">தானியங்கி கணக்கீடு</h3>
                  </div>

                  <div data-testid="calculation-items" className="space-y-2 text-xs sm:text-sm border-b border-dashed border-green-200 pb-3">
                    {formData.details.map((d, i) => {
                      let amount = 0;
                      let summary = '';
                      if (d.hours && d.equipment_type) {
                        amount = calculateJCBTotalAmount(
                          parseFloat(d.hours) || 0,
                          d.equipment_type
                        );
                        summary = `${d.hours} மணி • JCB`;
                      }
                      return (
                        <div key={i} data-testid={`calculation-item-${i}`} className="flex justify-between items-center text-emerald-900 font-medium">
                          <span data-testid={`calculation-summary-${i}`}>{summary}</span>
                          <span className="font-semibold">{formatCurrency(amount)}</span>
                        </div>
                      );
                    })}
                    {!oldBalanceOnly && showOldBalanceSection && formData.old_balance && (
                      <div data-testid="old-balance-calculation" className="flex justify-between items-center text-emerald-900 font-medium pt-1">
                        <span data-testid="old-balance-calculation-text">பழைய பாக்கி</span>
                        <span className="font-semibold">{formatCurrency(parseFloat(formData.old_balance) || 0)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div data-testid="total-calculation" className="mt-3 flex justify-between items-center">
                    <span className="text-sm font-bold text-emerald-950">மொத்த தொகை:</span>
                    <p data-testid="total-amount-display" className="text-lg sm:text-xl font-extrabold text-emerald-700">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Amount Received */}
                <div data-testid="amount-received-container" className="space-y-1">
                  <label data-testid="amount-received-label" htmlFor="amount_received" className="block text-xs sm:text-sm font-semibold text-gray-700">
                    பெறப்பட்ட தொகை (₹) (விரும்பினால்)
                  </label>
                  <input
                    data-testid="amount-received-input"
                    type="number"
                    id="amount_received"
                    value={formData.amount_received}
                    onChange={e => setFormData(prev => ({ ...prev, amount_received: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-sm"
                    placeholder="பெறப்பட்ட தொகை (எ.கா: 1000)"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Advance Amount */}
                <div data-testid="advance-amount-container" className="space-y-1">
                  <label data-testid="advance-amount-label" htmlFor="advance_amount" className="block text-xs sm:text-sm font-semibold text-gray-700">
                    முன்பணத் தொகை (₹) (விரும்பினால்)
                  </label>
                  <input
                    data-testid="advance-amount-input"
                    type="number"
                    id="advance_amount"
                    value={formData.advance_amount}
                    onChange={e => setFormData(prev => ({ ...prev, advance_amount: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-sm"
                    placeholder="முன்பணத் தொகை (எ.கா: 500)"
                    min="0"
                    step="0.01"
                  />
                </div>

                {!oldBalanceOnly && (
                  <div data-testid="old-balance-toggle-container" className="flex items-center pt-1">
                    {!showOldBalanceSection ? (
                      <button
                        data-testid="add-old-balance-button"
                        type="button"
                        onClick={() => setShowOldBalanceSection(true)}
                        className="flex items-center text-orange-600 hover:text-orange-800 text-xs sm:text-sm font-bold bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-150 transition-colors cursor-pointer"
                      >
                        <span data-testid="add-old-balance-icon" className="text-base mr-1">+</span>
                        <span data-testid="add-old-balance-text">பழைய பாக்கி சேர்க்க</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Show old balance fields in full form if showOldBalanceSection is true */}
            {!oldBalanceOnly && showOldBalanceSection && (
              <div data-testid="old-balance-section" className="mt-4 border border-gray-200 p-4 pt-8 rounded-xl bg-gray-50/50 relative space-y-4 shadow-inner">
                <button
                  data-testid="remove-old-balance-button"
                  type="button"
                  onClick={() => {
                    setShowOldBalanceSection(false);
                    setFormData(prev => ({ ...prev, old_balance: '', old_balance_status: '', old_balance_reason: '' }));
                  }}
                  className="absolute top-2.5 right-2.5 text-red-500 hover:text-red-700 text-sm font-bold border border-red-200 bg-white hover:bg-red-50 rounded-md px-2 py-0.5 shadow-sm transition-colors cursor-pointer"
                  title="Remove old balance"
                >
                  நீக்கு ×
                </button>
                
                <div className="space-y-1">
                  <label data-testid="full-form-old-balance-label" htmlFor="old_balance" className="block text-xs sm:text-sm font-semibold text-gray-700">பழைய பாக்கி *</label>
                  <input
                    data-testid="full-form-old-balance-input"
                    type="number"
                    id="old_balance"
                    value={formData.old_balance || ''}
                    onChange={e => setFormData(prev => ({ ...prev, old_balance: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-sm"
                    placeholder="பழைய பாக்கி தொகை (₹)"
                    autoComplete="off"
                  />
                </div>
                
                <div data-testid="full-form-old-balance-status-container" className="space-y-1.5">
                  <label data-testid="full-form-old-balance-status-label" htmlFor="old_balance_status" className="block text-xs sm:text-sm font-semibold text-gray-700">நிலை *</label>
                  <select
                    data-testid="full-form-old-balance-status-select"
                    id="old_balance_status"
                    value={oldBalanceStatus}
                    onChange={e => setOldBalanceStatus(e.target.value as 'paid' | 'pending')}
                    className="hidden"
                  >
                    <option value="pending">நிலுவையில்</option>
                    <option value="paid">முழுமையாக பெறப்பட்டது</option>
                  </select>
                  <div className="flex gap-3">
                    {(['pending', 'paid'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setOldBalanceStatus(status)}
                        className={`flex-1 text-center py-2.5 text-xs sm:text-sm font-bold rounded-lg border transition-all cursor-pointer ${
                          oldBalanceStatus === status
                            ? status === 'paid'
                              ? 'bg-green-600 text-white border-green-600 shadow-sm'
                              : 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {status === 'pending' ? 'நிலுவையில் (Pending)' : 'பெறப்பட்டது (Paid)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Old Balance Reason Field */}
                <div data-testid="full-form-old-balance-reason-container" className="space-y-1">
                  <label data-testid="full-form-old-balance-reason-label" htmlFor="old_balance_reason" className="block text-xs sm:text-sm font-semibold text-gray-700">காரணம் (விவரம்)</label>
                  <input
                    data-testid="full-form-old-balance-reason-input"
                    type="text"
                    id="old_balance_reason"
                    value={formData.old_balance_reason || ''}
                    onChange={e => setFormData(prev => ({ ...prev, old_balance_reason: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent border-gray-300 text-sm"
                    placeholder="காரணம் (விவரம்)"
                    autoComplete="off"
                  />
                </div>
                {formData.old_balance && (
                  <div data-testid="old-balance-display" className="mt-1 text-xs font-extrabold flex items-center justify-between">
                    <span data-testid="old-balance-display-text">விவரம்: பழைய பாக்கி ₹{formData.old_balance}</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${oldBalanceStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {oldBalanceStatus === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div data-testid="submit-error" className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p data-testid="submit-error-message" className="text-red-600 text-sm font-semibold">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons (Fixed Footer on Mobile) */}
            <div data-testid="action-buttons" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200/80 p-4 flex gap-3 z-30 md:static md:border-none md:p-0 md:mt-8 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:shadow-none">
              <button
                data-testid="cancel-button"
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center cursor-pointer text-sm"
              >
                <X data-testid="cancel-icon" className="w-4 h-4 mr-2" />
                <span data-testid="cancel-button-text">ரத்து செய்</span>
              </button>
              
              <button
                data-testid="save-button"
                type="submit"
                disabled={loading}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-md shadow-orange-500/20 text-sm"
              >
                {loading ? (
                  <div data-testid="save-loading-spinner" className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save data-testid="save-icon" className="w-4 h-4 mr-2" />
                    <span data-testid="save-button-text">சேமிக்கவும்</span>
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

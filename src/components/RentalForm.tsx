import React, { useState } from 'react';
import { Save, X, Calculator } from 'lucide-react';
// Phone icon was only used by the mobile number field, temporarily commented out below.
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
    mobile_number: initialData?.mobile_number || '',
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
          name: formData.name.trim(),
          mobile_number: formData.mobile_number.trim() || null,
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
          mobile_number: formData.mobile_number.trim() || null,
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
    <div data-testid="rental-form-container" className="min-h-screen bg-gray-50 md:py-8 px-0 sm:px-4">
      <div data-testid="rental-form-wrapper" className="max-w-2xl mx-auto h-full min-h-screen md:min-h-0">
        <div data-testid="rental-form-card" className="bg-white rounded-none md:rounded-2xl shadow-none md:shadow-2xl min-h-screen md:min-h-0 flex flex-col">
          {/* Header */}
          <div data-testid="rental-form-header" className="bg-blue-600 text-white px-4 sm:px-6 pb-4 sm:pb-6 pt-[calc(1rem_+_env(safe-area-inset-top))] sm:pt-[calc(1.5rem_+_env(safe-area-inset-top))] rounded-none md:rounded-t-2xl sticky top-0 z-20 shadow-md">
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
                className="text-white hover:bg-blue-700 p-2 rounded-lg transition-colors cursor-pointer"
              >
                <X data-testid="close-icon" className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form data-testid="rental-form" onSubmit={handleSubmit} className="flex-1 p-4 sm:p-6 space-y-5 pb-24 md:pb-6">
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
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                வாடகை பதிவு
              </button>
              <button
                type="button"
                onClick={() => setOldBalanceOnly(true)}
                disabled={!!initialData && !oldBalanceOnly}
                className={`flex-1 text-center py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  oldBalanceOnly
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                பழைய பாக்கி மட்டும்
              </button>
              <label data-testid="old-balance-only-label" htmlFor="oldBalanceOnly" className="hidden">பழைய பாக்கி மட்டும்</label>
            </div>

            {oldBalanceOnly ? (
              <div className="space-y-4">
                {/* Name Field */}
                <div data-testid="name-field-container" className="space-y-1">
                  <label data-testid="name-label" htmlFor="name" className="block text-xs sm:text-sm font-semibold text-gray-700">பெயர் *</label>
                  <input
                    data-testid="name-input"
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'} text-sm`}
                    placeholder="வாடகை பெறுபவரின் பெயர்"
                  />
                  {errors.name && <p data-testid="name-error" className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>}
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
                      className={`w-full pl-9 pr-12 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.mobile_number ? 'border-red-500' : 'border-gray-300'} text-sm`}
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
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-sm"
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
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-sm"
                    placeholder="காரணம் (எ.கா: ஆடி மாதம் உழவு)"
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Customer Name */}
                <div data-testid="customer-name-container" className="space-y-1">
                  <label data-testid="customer-name-label" htmlFor="name" className="block text-xs sm:text-sm font-semibold text-gray-700">
                    பெயர் *
                  </label>
                  <input
                    data-testid="customer-name-input"
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'} text-sm`}
                    placeholder="வாடகை பெறுபவரின் பெயர்"
                  />
                  {errors.name && <p data-testid="customer-name-error" className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>}
                </div>

                {/* Customer Mobile Number — temporarily commented out
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
                      className={`w-full pl-9 pr-12 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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

                {/* Details Sets */}
                <div data-testid="details-sets-container" className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 border-b pb-1.5 flex justify-between items-center">
                    <span>வாடகை விவரங்கள்</span>
                    <button
                      type="button"
                      onClick={handleAddDetail}
                      className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 font-bold transition-colors cursor-pointer"
                    >
                      + உழவு சேர்க்க
                    </button>
                  </h3>
                  
                  {formData.details.map((d, i) => {
                    const isDipper = d.equipment_type === 'Dipper';
                    return (
                      <div key={i} data-testid={`detail-set-${i}`} className="relative border border-blue-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-all space-y-3">
                        <div className="flex justify-between items-center">
                          <span data-testid={`detail-set-number-${i}`} className="bg-blue-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
                            உழவு {i + 1}
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

                        {/* Equipment Type - clickable chips */}
                        <div data-testid={`equipment-type-container-${i}`} className="space-y-1.5">
                          <label data-testid={`equipment-type-label-${i}`} className="block text-xs font-bold text-gray-600">வகை *</label>
                          <select
                            data-testid={`equipment-type-select-${i}`}
                            value={d.equipment_type}
                            onChange={e => handleDetailChange(i, 'equipment_type', e.target.value)}
                            className="hidden"
                          >
                            <option value="Cage Wheel">Cage Wheel</option>
                            <option value="புழுதி">புழுதி</option>
                            <option value="Rotavator">Rotavator</option>
                            <option value="Mini">Mini</option>
                            <option value="Dipper">Dipper</option>
                          </select>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {(['Cage Wheel', 'புழுதி', 'Rotavator', 'Mini', 'Dipper'] as const).map(type => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => handleDetailChange(i, 'equipment_type', type)}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                  d.equipment_type === type
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {type === 'Cage Wheel' && 'Cage Wheel 🚜'}
                                {type === 'புழுதி' && 'புழுதி 🚜'}
                                {type === 'Rotavator' && 'Rotavator 🚜'}
                                {type === 'Mini' && 'Mini 🚜'}
                                {type === 'Dipper' && 'Dipper 🚚'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Type-specific fields */}
                        {isDipper ? (
                          <div data-testid={`dipper-fields-${i}`} className="grid grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <label data-testid={`nadai-label-${i}`} className="block text-xs font-semibold text-gray-700">நடை *</label>
                              <input
                                data-testid={`nadai-input-${i}`}
                                type="number"
                                value={d.nadai}
                                onChange={e => handleDetailChange(i, 'nadai', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`nadai_${i}`] ? 'border-red-500' : 'border-gray-300'} text-sm`}
                                placeholder="நடை எண்ணிக்கை"
                                min="1"
                                step="1"
                              />
                              {errors[`nadai_${i}`] && <p data-testid={`nadai-error-${i}`} className="text-red-500 text-xs mt-1 font-medium">{errors[`nadai_${i}`]}</p>}
                            </div>
                            <div data-testid={`dipper-amount-${i}`} className="space-y-1">
                              <label data-testid={`dipper-amount-label-${i}`} className="block text-xs font-semibold text-gray-700">ஒரு நடை வீதம்</label>
                              <input
                                data-testid={`dipper-amount-input-${i}`}
                                type="text"
                                value="₹500"
                                readOnly
                                className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-sm font-medium text-gray-600"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div data-testid={`acres-container-${i}`} className="space-y-1">
                              <label data-testid={`acres-label-${i}`} className="block text-xs font-semibold text-gray-700">மா (Acres) *</label>
                              <input
                                data-testid={`acres-input-${i}`}
                                type="number"
                                value={d.acres}
                                onChange={e => handleDetailChange(i, 'acres', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`acres_${i}`] ? 'border-red-500' : 'border-gray-300'} text-sm`}
                                placeholder="எ.கா: 1.03"
                                min="0"
                                step="0.01"
                              />
                              {errors[`acres_${i}`] && <p data-testid={`acres-error-${i}`} className="text-red-500 text-xs mt-1 font-medium">{errors[`acres_${i}`]}</p>}
                            </div>
                            <div data-testid={`rounds-container-${i}`} className="space-y-1">
                              <label data-testid={`rounds-label-${i}`} className="block text-xs font-semibold text-gray-700">சால் (Rounds) *</label>
                              <input
                                data-testid={`rounds-input-${i}`}
                                type="number"
                                value={d.rounds}
                                onChange={e => handleDetailChange(i, 'rounds', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`rounds_${i}`] ? 'border-red-500' : 'border-gray-300'} text-sm`}
                                placeholder="சால் எண்ணிக்கை"
                                min="0"
                                step="1"
                              />
                              {errors[`rounds_${i}`] && <p data-testid={`rounds-error-${i}`} className="text-red-500 text-xs mt-1 font-medium">{errors[`rounds_${i}`]}</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Calculation Display (Receipt-style) */}
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
                      if (d.equipment_type === 'Dipper') {
                        amount = 500 * (parseInt(String(d.nadai)) || 0);
                        summary = `${String(d.nadai)} நடை • Dipper`;
                      } else {
                        amount = calculateTotalAmount(
                          parseFloat(d.acres) || 0,
                          parseFloat(d.rounds) || 0,
                          d.equipment_type as any
                        );
                        summary = `${d.acres} மா • ${d.rounds} சால் • ${d.equipment_type}`;
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

                {/* Received Amount */}
                <div data-testid="received-amount-container" className="space-y-1">
                  <label data-testid="received-amount-label" htmlFor="received_amount" className="block text-xs sm:text-sm font-semibold text-gray-700">
                    பெறப்பட்ட தொகை (₹) *
                  </label>
                  <input
                    data-testid="received-amount-input"
                    type="number"
                    id="received_amount"
                    value={formData.received_amount}
                    onChange={e => setFormData(prev => ({ ...prev, received_amount: e.target.value }))}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.received_amount ? 'border-red-500' : 'border-gray-300'} text-sm`}
                    placeholder="பெறப்பட்ட தொகை (எ.கா: 1500.00)"
                    min="0"
                    step="0.01"
                  />
                  {errors.received_amount && <p data-testid="received-amount-error" className="text-red-500 text-xs mt-1 font-medium">{errors.received_amount}</p>}
                </div>

                {!oldBalanceOnly && (
                  <div data-testid="old-balance-toggle-container" className="flex items-center pt-1">
                    {!showOldBalanceSection ? (
                      <button
                        data-testid="add-old-balance-button"
                        type="button"
                        onClick={() => setShowOldBalanceSection(true)}
                        className="flex items-center text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-150 transition-colors cursor-pointer"
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
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-sm"
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
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 text-sm"
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
            <div data-testid="action-buttons" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200/80 px-4 pt-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] flex gap-3 z-30 md:static md:border-none md:px-0 md:pt-0 md:pb-0 md:mt-8 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:shadow-none">
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 text-sm"
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

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Save, Trash2, History, X } from 'lucide-react';
// Phone icon was only used by the mobile number field, temporarily commented out below.
import { rentalService } from '../lib/supabase';
import { calculateTotalAmount, formatCurrency, EQUIPMENT_RATES } from '../utils/calculations';
import type { RentalRecord, RentalDetail } from '../types/rental';

interface RentalFormProps {
  onClose: () => void;
  onSave: (record: RentalRecord) => void;
  initialData?: RentalRecord;
}

interface RentalDetailDraft {
  acres: string;
  equipment_type: 'Cage Wheel' | 'Rotavator' | 'புழுதி' | 'Mini' | 'Dipper';
  rounds: string;
  nadai: string; // input as string, parse as number for calculation
}

const EQUIPMENT_TYPES = ['Cage Wheel', 'புழுதி', 'Rotavator', 'Mini', 'Dipper'] as const;
const DIPPER_RATE = 500;

function draftAmount(d: RentalDetailDraft): number {
  if (d.equipment_type === 'Dipper') {
    const n = parseInt(String(d.nadai), 10);
    return !isNaN(n) && n > 0 ? n * DIPPER_RATE : 0;
  }
  if (!d.acres || !d.rounds) return 0;
  return calculateTotalAmount(parseFloat(d.acres) || 0, parseFloat(d.rounds) || 0, d.equipment_type);
}

function rateLabel(type: RentalDetailDraft['equipment_type']): string {
  return type === 'Dipper' ? `₹${DIPPER_RATE}/நடை` : `₹${EQUIPMENT_RATES[type]}/மா`;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string; activeClass?: string }[];
  onChange: (v: T) => void;
  disabled?: (v: T) => boolean;
}) {
  return (
    <div className="flex rounded-full bg-line/[0.04] p-1 ring-1 ring-inset ring-line/[0.06]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          disabled={disabled?.(o.value)}
          className={`flex-1 rounded-full py-2.5 text-[13.5px] font-medium transition duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
            value === o.value ? o.activeClass ?? 'bg-fog text-night-950 shadow-[0_4px_20px_-4px_rgb(var(--fog)/0.22)]' : 'text-fog/55'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldError({ message, testId }: { message?: string; testId?: string }) {
  if (!message) return null;
  return <p data-testid={testId} className="mt-1.5 text-[12.5px] font-medium text-coral-400">{message}</p>;
}

export function RentalForm({ onClose, onSave, initialData }: RentalFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    mobile_number: initialData?.mobile_number || '',
    details: initialData?.details?.length
      ? initialData.details.map((d) => ({
          acres: d.equipment_type === 'Dipper' ? '' : String(d.acres ?? ''),
          equipment_type: d.equipment_type as RentalDetailDraft['equipment_type'],
          rounds: d.equipment_type === 'Dipper' ? '' : String(d.rounds ?? ''),
          nadai: d.equipment_type === 'Dipper' ? String(d.nadai ?? '') : '',
        }))
      : [{ acres: '', equipment_type: 'Cage Wheel', rounds: '', nadai: '' } as RentalDetailDraft],
    received_amount: initialData ? String(initialData.received_amount) : '',
    old_balance: initialData?.old_balance || '',
    old_balance_reason: initialData?.old_balance_reason || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oldBalanceOnly, setOldBalanceOnly] = useState(
    initialData && (!initialData.details || initialData.details.length === 0) && initialData.old_balance ? true : false,
  );
  const [oldBalanceStatus, setOldBalanceStatus] = useState<'paid' | 'pending'>(
    initialData && initialData.old_balance_status ? initialData.old_balance_status : 'pending',
  );
  const [showOldBalanceSection, setShowOldBalanceSection] = useState(
    !!(initialData && initialData.old_balance && !oldBalanceOnly),
  );

  // Opened from a scrolled list — start the form at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const oldBalanceValue = parseFloat(formData.old_balance) || 0;
  const includeOldBalance = !oldBalanceOnly && showOldBalanceSection && !!formData.old_balance && oldBalanceStatus === 'pending';
  const totalAmount = oldBalanceOnly
    ? oldBalanceValue
    : formData.details.reduce((sum, d) => sum + draftAmount(d), 0) + (includeOldBalance ? oldBalanceValue : 0);

  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

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
    setFormData((prev) => ({
      ...prev,
      details: prev.details.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }));
    clearError(`${field}_${index}`);
  };

  const handleAddDetail = () => {
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, { acres: '', equipment_type: 'Cage Wheel', rounds: '', nadai: '' }],
    }));
  };

  const handleRemoveDetail = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index),
    }));
  };

  // Mobile number field is temporarily commented out below (see JSX), so its
  // change handler is unused for now.
  // const handleMobileNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
  //   if (value.length <= 10) {
  //     setFormData(prev => ({ ...prev, mobile_number: value }));
  //     clearError('mobile_number');
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
        // Keep any amount already collected on a pending old balance.
        const alreadyReceived = Math.min(initialData?.received_amount ?? 0, oldBalanceValue);
        recordData = {
          name: formData.name.trim(),
          mobile_number: formData.mobile_number.trim() || null,
          old_balance: formData.old_balance || undefined,
          old_balance_status: oldBalanceStatus,
          old_balance_reason: formData.old_balance_reason || undefined,
          details: [],
          total_amount: oldBalanceValue,
          received_amount: oldBalanceStatus === 'paid' ? oldBalanceValue : alreadyReceived,
        };
      } else {
        const details: RentalDetail[] = formData.details.map((d) => {
          if (d.equipment_type === 'Dipper') {
            return {
              equipment_type: 'Dipper',
              nadai: d.nadai ? parseInt(String(d.nadai), 10) : 0,
              acres: 0,
              rounds: 0,
            };
          }
          return {
            acres: parseFloat(d.acres),
            equipment_type: d.equipment_type as RentalDetail['equipment_type'],
            rounds: parseFloat(d.rounds),
          };
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
                old_balance_reason: formData.old_balance_reason || undefined,
              }
            : {
                old_balance: undefined,
                old_balance_status: undefined,
                old_balance_reason: undefined,
              }),
        };
      }
      const newRecord = initialData
        ? await rentalService.update(initialData.id, recordData)
        : await rentalService.create(recordData);
      onSave(newRecord);
    } catch (error) {
      console.error('Error saving record:', error);
      setErrors({ submit: 'பதிவு சேமிப்பதில் பிழை ஏற்பட்டது' });
    } finally {
      setLoading(false);
    }
  };

  const title = initialData
    ? oldBalanceOnly ? 'பழைய பாக்கி திருத்தம்' : 'வாடகை பதிவு திருத்தம்'
    : 'புதிய வாடகை பதிவு';

  const oldBalanceFields = (testPrefix: string) => (
    <>
      <div>
        <label htmlFor="old_balance" className="kbs-label">பழைய பாக்கி தொகை *</label>
        <div className={`kbs-field flex items-center gap-1 ${errors.old_balance ? 'kbs-field-error' : ''}`}>
          <span className="text-fog/35">₹</span>
          <input
            data-testid={`${testPrefix}old-balance-input`}
            type="number"
            inputMode="decimal"
            id="old_balance"
            value={formData.old_balance || ''}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, old_balance: e.target.value }));
              clearError('old_balance');
            }}
            className="w-full bg-transparent outline-none"
            placeholder="0"
            autoComplete="off"
          />
        </div>
        <FieldError message={errors.old_balance} />
      </div>
      <div>
        <span className="kbs-label">நிலை *</span>
        <Segmented
          value={oldBalanceStatus}
          onChange={setOldBalanceStatus}
          options={[
            { value: 'pending', label: 'நிலுவையில்', activeClass: 'bg-coral-500 text-white' },
            { value: 'paid', label: 'பெறப்பட்டது', activeClass: 'bg-brand text-brand-fg' },
          ]}
        />
      </div>
      <div>
        <label htmlFor="old_balance_reason" className="kbs-label">காரணம் (விவரம்)</label>
        <input
          data-testid={`${testPrefix}old-balance-reason-input`}
          type="text"
          id="old_balance_reason"
          value={formData.old_balance_reason || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, old_balance_reason: e.target.value }))}
          className="kbs-field"
          placeholder="எ.கா: ஆடி மாதம் உழவு"
          autoComplete="off"
        />
      </div>
    </>
  );

  return (
    <div data-testid="rental-form-container" className="kbs-app kbs-grain relative min-h-screen overflow-x-clip">
      <header data-testid="rental-form-header" className="sticky top-0 z-30 bg-night-950/75 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-3 sm:px-5">
          <button
            type="button"
            data-testid="close-button"
            onClick={onClose}
            className="kbs-press grid h-10 w-10 place-items-center rounded-full bg-line/[0.06] text-fog/80 ring-1 ring-inset ring-line/10 hover:bg-line/10"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <h2 data-testid="form-title" className="truncate text-[16px] font-semibold tracking-tight">{title}</h2>
            <p className="text-[12px] text-fog/50">KBS Tractors</p>
          </div>
        </div>
      </header>

      <form
        data-testid="rental-form"
        onSubmit={handleSubmit}
        className="relative z-10 mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6"
      >
        <Segmented
          value={oldBalanceOnly ? 'old' : 'rental'}
          onChange={(v) => setOldBalanceOnly(v === 'old')}
          disabled={(v) => !!initialData && (v === 'old') !== oldBalanceOnly}
          options={[
            { value: 'rental', label: 'வாடகை பதிவு' },
            { value: 'old', label: 'பழைய பாக்கி மட்டும்' },
          ]}
        />

        <section className="kbs-surface rounded-[26px] p-4">
          <label htmlFor="name" className="kbs-label">பெயர் *</label>
          <input
            data-testid="customer-name-input"
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, name: e.target.value }));
              clearError('name');
            }}
            className={`kbs-field ${errors.name ? 'kbs-field-error' : ''}`}
            placeholder="வாடகை பெறுபவரின் பெயர்"
            autoComplete="off"
          />
          <FieldError message={errors.name} testId="customer-name-error" />

          {/* Mobile Number — temporarily commented out
          <div className="mt-4">
            <label htmlFor="mobile_number" className="kbs-label">மொபைல் எண்</label>
            <div className={`kbs-field flex items-center gap-2 ${errors.mobile_number ? 'kbs-field-error' : ''}`}>
              <Phone className="h-4 w-4 text-fog/35" />
              <input
                data-testid="customer-mobile-input"
                type="tel"
                inputMode="numeric"
                id="mobile_number"
                value={formData.mobile_number}
                onChange={handleMobileNumberChange}
                className="w-full bg-transparent outline-none"
                placeholder="10 இலக்கங்கள்"
                maxLength={10}
                pattern="[0-9]{10}"
              />
              <span className="text-xs text-fog/35">{formData.mobile_number.length}/10</span>
            </div>
            <FieldError message={errors.mobile_number} testId="customer-mobile-error" />
          </div>
          */}
        </section>

        {oldBalanceOnly ? (
          <section className="space-y-4 kbs-surface rounded-[26px] p-4">
            {oldBalanceFields('')}
          </section>
        ) : (
          <>
            <div data-testid="details-sets-container" className="space-y-3">
              <h3 className="flex items-center gap-3 px-1 pt-3 text-[12px] font-medium uppercase tracking-[0.14em] text-fog/40">
                வாடகை விவரங்கள்
                <span className="h-px flex-1 bg-gradient-to-r from-line/10 to-transparent" />
              </h3>

              {formData.details.map((d, i) => {
                const isDipper = d.equipment_type === 'Dipper';
                return (
                  <section
                    key={i}
                    data-testid={`detail-set-${i}`}
                    className="kbs-surface rounded-[26px] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-pos/10 text-[13px] font-semibold text-pos ring-1 ring-inset ring-pos/25">
                          {i + 1}
                        </span>
                        <span className="text-[14px] font-semibold">உழவு</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold tracking-tight text-fog">{formatCurrency(draftAmount(d))}</span>
                        {formData.details.length > 1 && (
                          <button
                            data-testid={`remove-detail-button-${i}`}
                            type="button"
                            onClick={() => handleRemoveDetail(i)}
                            className="kbs-press grid h-8 w-8 place-items-center rounded-full text-fog/35 hover:bg-coral-500/15 hover:text-coral-300"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                      {EQUIPMENT_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          data-testid={`equipment-chip-${i}-${type}`}
                          onClick={() => handleDetailChange(i, 'equipment_type', type)}
                          className={`kbs-press shrink-0 rounded-xl border px-3 py-2 text-left ${
                            d.equipment_type === type
                              ? 'border-brand bg-brand text-brand-fg shadow-[0_8px_24px_-8px_rgb(var(--brand)/0.6)]'
                              : 'border-line/10 bg-line/[0.03] text-fog'
                          }`}
                        >
                          <span className="block text-[13px] font-semibold leading-tight">{type}</span>
                          <span className={`block text-[11px] ${d.equipment_type === type ? 'text-brand-fg/70' : 'text-fog/40'}`}>
                            {rateLabel(type)}
                          </span>
                        </button>
                      ))}
                    </div>

                    {isDipper ? (
                      <div className="mt-3">
                        <label className="kbs-label" htmlFor={`nadai-${i}`}>நடை *</label>
                        <input
                          id={`nadai-${i}`}
                          data-testid={`nadai-input-${i}`}
                          type="number"
                          inputMode="numeric"
                          value={d.nadai}
                          onChange={(e) => handleDetailChange(i, 'nadai', e.target.value)}
                          className={`kbs-field ${errors[`nadai_${i}`] ? 'kbs-field-error' : ''}`}
                          placeholder="நடை எண்ணிக்கை"
                          min="1"
                          step="1"
                        />
                        <FieldError message={errors[`nadai_${i}`]} testId={`nadai-error-${i}`} />
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="kbs-label" htmlFor={`acres-${i}`}>மா (Acres) *</label>
                          <input
                            id={`acres-${i}`}
                            data-testid={`acres-input-${i}`}
                            type="number"
                            inputMode="decimal"
                            value={d.acres}
                            onChange={(e) => handleDetailChange(i, 'acres', e.target.value)}
                            className={`kbs-field ${errors[`acres_${i}`] ? 'kbs-field-error' : ''}`}
                            placeholder="1.03"
                            min="0"
                            step="0.01"
                          />
                          <FieldError message={errors[`acres_${i}`]} testId={`acres-error-${i}`} />
                        </div>
                        <div>
                          <label className="kbs-label" htmlFor={`rounds-${i}`}>சால் (Rounds) *</label>
                          <input
                            id={`rounds-${i}`}
                            data-testid={`rounds-input-${i}`}
                            type="number"
                            inputMode="decimal"
                            value={d.rounds}
                            onChange={(e) => handleDetailChange(i, 'rounds', e.target.value)}
                            className={`kbs-field ${errors[`rounds_${i}`] ? 'kbs-field-error' : ''}`}
                            placeholder="1"
                            min="0"
                            step="1"
                          />
                          <FieldError message={errors[`rounds_${i}`]} testId={`rounds-error-${i}`} />
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}

              <button
                type="button"
                data-testid="add-detail-button"
                onClick={handleAddDetail}
                className="kbs-press flex w-full items-center justify-center gap-2 rounded-[26px] border border-dashed border-pos/40 py-4 text-[14px] font-medium text-pos hover:bg-pos/[0.06]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                உழவு சேர்க்க
              </button>
            </div>

            {showOldBalanceSection ? (
              <section data-testid="old-balance-section" className="space-y-4 kbs-surface rounded-[26px] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-fog/40" />
                    <span className="text-[14px] font-semibold">பழைய பாக்கி</span>
                  </div>
                  <button
                    data-testid="remove-old-balance-button"
                    type="button"
                    onClick={() => {
                      setShowOldBalanceSection(false);
                      setFormData((prev) => ({ ...prev, old_balance: '', old_balance_reason: '' }));
                    }}
                    className="kbs-press grid h-8 w-8 place-items-center rounded-full text-fog/35 hover:bg-coral-500/15 hover:text-coral-300"
                    aria-label="Remove old balance"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {oldBalanceFields('full-form-')}
              </section>
            ) : (
              <button
                data-testid="add-old-balance-button"
                type="button"
                onClick={() => setShowOldBalanceSection(true)}
                className="kbs-press flex w-full items-center justify-center gap-2 rounded-[26px] border border-dashed border-line/15 py-4 text-[14px] font-medium text-fog/55 hover:bg-line/[0.03]"
              >
                <History className="h-4 w-4" />
                பழைய பாக்கி சேர்க்க
              </button>
            )}

            {/* Receipt */}
            <section data-testid="calculation-display" className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-pos/[0.16] via-night-800 to-night-850 ring-1 ring-inset ring-pos/20">
              <div className="space-y-2 px-4 pt-4 text-[13.5px]">
                {formData.details.map((d, i) => (
                  <div key={i} data-testid={`calculation-item-${i}`} className="flex items-center justify-between gap-3">
                    <span className="truncate text-fog/60">
                      {d.equipment_type === 'Dipper'
                        ? `${d.nadai || 0} நடை · Dipper`
                        : `${d.acres || 0} மா × ${d.rounds || 0} சால் · ${d.equipment_type}`}
                    </span>
                    <span className="shrink-0 font-semibold">{formatCurrency(draftAmount(d))}</span>
                  </div>
                ))}
                {showOldBalanceSection && formData.old_balance && (
                  <div data-testid="old-balance-calculation" className="flex items-center justify-between gap-3">
                    <span className="text-fog/60">பழைய பாக்கி {oldBalanceStatus === 'paid' && '(பெறப்பட்டது)'}</span>
                    <span className={`shrink-0 font-semibold ${oldBalanceStatus === 'paid' ? 'text-fog/30 line-through' : ''}`}>
                      {formatCurrency(oldBalanceValue)}
                    </span>
                  </div>
                )}
              </div>
              <div className="relative mt-4 flex items-center justify-between border-t border-dashed border-line/15 px-4 py-4">
                <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-night-950 ring-1 ring-inset ring-pos/20" />
                <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-night-950 ring-1 ring-inset ring-pos/20" />
                <span className="text-[13px] text-fog/55">மொத்த தொகை</span>
                <span data-testid="total-amount-display" className="text-[26px] font-semibold tracking-[-0.03em]">{formatCurrency(totalAmount)}</span>
              </div>
            </section>

            <section className="kbs-surface rounded-[26px] p-4">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="received_amount" className="kbs-label mb-0">பெறப்பட்ட தொகை *</label>
                {totalAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, received_amount: String(totalAmount) }));
                      clearError('received_amount');
                    }}
                    className="kbs-press rounded-full bg-pos/10 px-3 py-1 text-[12px] font-medium text-pos ring-1 ring-inset ring-pos/25"
                  >
                    முழு தொகை
                  </button>
                )}
              </div>
              <div className={`kbs-field flex items-center gap-1 ${errors.received_amount ? 'kbs-field-error' : ''}`}>
                <span className="text-fog/35">₹</span>
                <input
                  data-testid="received-amount-input"
                  type="number"
                  inputMode="decimal"
                  id="received_amount"
                  value={formData.received_amount}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, received_amount: e.target.value }));
                    clearError('received_amount');
                  }}
                  className="w-full bg-transparent outline-none"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <FieldError message={errors.received_amount} testId="received-amount-error" />
            </section>
          </>
        )}

        {errors.submit && (
          <div data-testid="submit-error" className="rounded-2xl bg-coral-500/10 px-4 py-3 text-[13.5px] font-medium text-coral-300 ring-1 ring-inset ring-coral-500/25">
            {errors.submit}
          </div>
        )}

        <div
          data-testid="action-buttons"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line/[0.06] bg-night-950/80 backdrop-blur-2xl"
        >
          <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] text-fog/45">மொத்தம்</p>
              <p className="truncate text-[24px] font-semibold leading-tight tracking-[-0.03em]">{formatCurrency(totalAmount)}</p>
            </div>
            <button
              data-testid="save-button"
              type="submit"
              disabled={loading}
              className="kbs-press flex h-14 min-w-[160px] items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.1),0_14px_36px_-8px_rgb(var(--brand)/0.55)] hover:bg-brand-hover disabled:opacity-60"
            >
              {loading ? (
                <span data-testid="save-loading-spinner" className="h-5 w-5 animate-spin rounded-full border-2 border-brand-fg/30 border-t-brand-fg" />
              ) : (
                <>
                  <Save className="h-[18px] w-[18px]" />
                  சேமிக்கவும்
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

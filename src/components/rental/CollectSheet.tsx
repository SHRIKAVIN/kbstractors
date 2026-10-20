import { useCallback, useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import type { RentalRecord } from '../../types/rental';
import { rentalService } from '../../lib/supabase';
import { formatCurrency } from '../../utils/calculations';
import { BottomSheet } from './BottomSheet';
import { SlideToConfirm } from './SlideToConfirm';
import { ProgressRing, haptic } from './motion';
import { initials, paidPercent, rentalStatus } from './rentalDisplay';

interface CollectSheetProps {
  record: RentalRecord | null;
  onClose: () => void;
  onCollected: (updated: RentalRecord, amount: number) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const;
const MAX_DIGITS = 8;

export function CollectSheet({ record, onClose, onCollected }: CollectSheetProps) {
  // Keep showing the last record while the sheet animates closed.
  const [shown, setShown] = useState<RentalRecord | null>(record);
  const [digits, setDigits] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [success, setSuccess] = useState<number | null>(null);

  useEffect(() => {
    if (!record) return;
    setShown(record);
    setDigits(String(Math.round(rentalStatus(record).pending)));
    setError('');
    setSaving(false);
    setSuccess(null);
    setAttempt((n) => n + 1);
  }, [record]);

  const pending = shown ? Math.round(rentalStatus(shown).pending) : 0;
  const amount = parseInt(digits || '0', 10);
  const over = amount > pending;
  const remaining = Math.max(pending - amount, 0);

  const press = useCallback((key: string) => {
    haptic(6);
    setError('');
    setDigits((prev) => {
      if (key === 'back') return prev.slice(0, -1);
      const next = (prev === '0' ? '' : prev) + key;
      return next.replace(/^0+/, '').slice(0, MAX_DIGITS);
    });
  }, []);

  // Physical keyboard support (desktop / tablets with keyboards).
  useEffect(() => {
    if (!record || success !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record, success, press]);

  const submit = async () => {
    if (!shown || saving) return;
    if (amount <= 0 || over) return;
    setSaving(true);
    try {
      const updated = await rentalService.collect(shown, amount);
      haptic(30);
      setSuccess(amount);
      setShown(updated);
      onCollected(updated, amount);
      window.setTimeout(onClose, 1700);
    } catch (err) {
      console.error('Collect failed:', err);
      setError('சேமிக்க முடியவில்லை — மீண்டும் முயற்சிக்கவும்');
      setSaving(false);
      setAttempt((n) => n + 1);
    }
  };

  const quick = [
    { label: 'முழு', value: Math.round(pending) },
    { label: 'பாதி', value: Math.round(pending / 2) },
    ...[500, 1000, 2000].filter((v) => v < pending).slice(-1).map((v) => ({ label: '', value: v })),
  ].filter((q, i, arr) => q.value > 0 && arr.findIndex((o) => o.value === q.value) === i);

  const header = shown && (
    <div className="flex items-center gap-3">
      <ProgressRing percent={paidPercent(shown)} size={46} stroke={3}>
        <span className="text-[15px] font-semibold">{initials(shown.name)}</span>
      </ProgressRing>
      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-pos/80">வசூல்</p>
        <h2 className="truncate text-[18px] font-semibold tracking-tight">{shown.name}</h2>
      </div>
    </div>
  );

  return (
    <BottomSheet
      open={!!record}
      onClose={onClose}
      header={header}
      footer={
        shown && success === null ? (
          <SlideToConfirm
            label={`${formatCurrency(amount)} · ஸ்லைடு செய்து வசூல்`}
            onConfirm={() => void submit()}
            disabled={amount <= 0 || over}
            busy={saving}
            resetKey={attempt}
          />
        ) : undefined
      }
    >
      {shown && success !== null ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="relative grid h-24 w-24 animate-pop-in place-items-center rounded-full bg-brand text-brand-fg shadow-[0_0_0_10px_rgb(var(--brand)/0.1),0_0_80px_10px_rgb(var(--brand)/0.35)]">
            <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" strokeDashoffset="24" className="animate-draw" />
            </svg>
          </div>
          <p className="mt-7 text-[40px] font-semibold leading-none tracking-tight">{formatCurrency(success)}</p>
          <p className="mt-3 text-[14px] text-fog/55">
            {shown.name} இடமிருந்து வசூலிக்கப்பட்டது
          </p>
          <p className="mt-1 text-[13px] text-fog/40">
            {pending > 0 ? `மீதம் நிலுவை ${formatCurrency(pending)}` : 'முழுமையாக பெறப்பட்டது'}
          </p>
        </div>
      ) : shown && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 divide-x divide-line/[0.06] rounded-2xl bg-line/[0.03] py-3 text-center ring-1 ring-inset ring-line/[0.06]">
            <div>
              <p className="text-[11.5px] text-fog/45">மொத்தம்</p>
              <p className="mt-0.5 text-[15px] font-semibold">{formatCurrency(shown.total_amount)}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-fog/45">பெறப்பட்டது</p>
              <p className="mt-0.5 text-[15px] font-semibold text-pos">{formatCurrency(shown.received_amount || 0)}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-fog/45">நிலுவை</p>
              <p className="mt-0.5 text-[15px] font-semibold text-coral-400">{formatCurrency(pending)}</p>
            </div>
          </div>

          <div className="pt-2 text-center">
            <div className={`inline-flex items-baseline justify-center ${over ? 'text-coral-400' : 'text-fog'}`}>
              <span className="mr-1 text-[30px] font-light text-fog/35">₹</span>
              <span className="text-[56px] font-semibold leading-none tracking-[-0.04em]">
                {amount.toLocaleString('en-IN')}
              </span>
              <span className="ml-1 inline-block h-11 w-[3px] translate-y-1 animate-caret rounded-full bg-brand" />
            </div>
            <p className={`mt-3 text-[13px] ${error || over ? 'font-medium text-coral-400' : 'text-fog/45'}`}>
              {error
                ? error
                : over
                  ? `நிலுவை ${formatCurrency(pending)} மட்டுமே`
                  : remaining > 0
                    ? `வசூலுக்குப் பின் மீதம் ${formatCurrency(remaining)}`
                    : amount > 0
                      ? 'முழு நிலுவையும் தீர்க்கப்படும்'
                      : 'தொகையை உள்ளிடவும்'}
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {quick.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => {
                  haptic(6);
                  setDigits(String(q.value));
                  setError('');
                }}
                className={`kbs-press rounded-full px-3.5 py-2 text-[13px] font-medium ring-1 ring-inset ${
                  amount === q.value
                    ? 'bg-brand text-brand-fg ring-brand'
                    : 'bg-line/[0.04] text-fog/70 ring-line/10'
                }`}
              >
                {q.label ? `${q.label} · ` : ''}
                {formatCurrency(q.value)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className="kbs-press grid h-[54px] place-items-center rounded-2xl bg-line/[0.035] text-[22px] font-medium text-fog hover:bg-line/[0.06] active:bg-line/10"
                aria-label={key === 'back' ? 'Delete digit' : key}
              >
                {key === 'back' ? <Delete className="h-6 w-6 text-fog/60" /> : key}
              </button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

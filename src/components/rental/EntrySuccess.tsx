import { useEffect, useRef } from 'react';
import type { RentalRecord } from '../../types/rental';
import { formatCurrency } from '../../utils/calculations';
import { Burst, haptic, useCountUp } from './motion';
import { rentalStatus } from './rentalDisplay';

interface EntrySuccessProps {
  record: RentalRecord;
  /** Called after the hold time, or straight away on tap. */
  onDone: () => void;
}

const HOLD_MS = 1500;

/**
 * Confirmation shown inside the form sheet right after a NEW entry is saved,
 * before the sheet slides away: a check that pops in and draws itself, the
 * customer, the total counting up, and where the money stands.
 */
export function EntrySuccess({ record, onDone }: EntrySuccessProps) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const { pending } = rentalStatus(record);
  const received = record.received_amount || 0;
  const total = useCountUp(record.total_amount, 700);
  const equipment = [...new Set((record.details ?? []).map((d) => d.equipment_type))];

  useEffect(() => {
    haptic(20);
    const timer = window.setTimeout(() => doneRef.current(), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <button
      type="button"
      data-testid="entry-success"
      onClick={() => doneRef.current()}
      className="absolute inset-0 z-40 flex animate-fade-in cursor-default flex-col items-center justify-center bg-night-950 px-8 pb-[env(safe-area-inset-bottom)] text-center"
      aria-label="New entry saved"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pos/[0.14] blur-[90px]" />

      <div className="relative grid h-24 w-24 animate-pop-in place-items-center rounded-full bg-brand text-brand-fg shadow-[0_0_0_10px_rgb(var(--brand)/0.12),0_0_80px_10px_rgb(var(--brand)/0.35)]">
        <Burst count={12} />
        <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" strokeDashoffset="24" className="animate-draw" />
        </svg>
      </div>

      <p className="kbs-success-line mt-7 text-[13px] font-medium uppercase tracking-[0.14em] text-pos" style={{ animationDelay: '120ms' }}>
        புதிய பதிவு சேர்க்கப்பட்டது
      </p>
      <h2 className="kbs-success-line mt-2 max-w-full truncate text-[22px] font-semibold tracking-tight" style={{ animationDelay: '180ms' }}>
        {record.name}
      </h2>
      <p className="kbs-success-line mt-3 text-[40px] font-semibold leading-none tracking-[-0.04em]" style={{ animationDelay: '240ms' }}>
        {formatCurrency(total)}
      </p>

      <p className="kbs-success-line mt-3 text-[13.5px] text-fog/55" style={{ animationDelay: '300ms' }}>
        {received > 0 && <span className="text-pos">{formatCurrency(received)} பெறப்பட்டது</span>}
        {received > 0 && ' · '}
        {pending > 0 ? <span className="text-coral-300">{formatCurrency(pending)} நிலுவை</span> : <span className="text-pos">முழுமையாக பெறப்பட்டது</span>}
      </p>

      {equipment.length > 0 && (
        <div className="kbs-success-line mt-5 flex flex-wrap justify-center gap-2" style={{ animationDelay: '360ms' }}>
          {equipment.map((name) => (
            <span key={name} className="rounded-full bg-line/[0.06] px-3 py-1 text-[12.5px] font-medium text-fog/75 ring-1 ring-inset ring-line/10">
              {name}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

import { useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, History, Pencil, Trash2 } from 'lucide-react';
import type { RentalRecord } from '../../types/rental';
import { formatCurrency } from '../../utils/calculations';
import { ProgressRing } from './motion';
import { detailAmount, initials, paidPercent, rentalStatus } from './rentalDisplay';

interface RentalRowProps {
  record: RentalRecord;
  index: number;
  /** Omitted when this login isn't allowed to do that action. */
  onCollect?: (record: RentalRecord) => void;
  onEdit?: (record: RentalRecord) => void;
  onDelete?: (record: RentalRecord) => void;
}

function summary(record: RentalRecord): string {
  const details = record.details ?? [];
  if (!details.length) return record.old_balance ? 'பழைய பாக்கி' : '—';
  const types = [...new Set(details.map((d) => d.equipment_type))];
  return `${details.length} உழவு · ${types.join(', ')}`;
}

export function RentalRow({ record, index, onCollect, onEdit, onDelete }: RentalRowProps) {
  const [open, setOpen] = useState(false);
  const { status, pending } = rentalStatus(record);
  const percent = paidPercent(record);
  const details = record.details ?? [];
  const isPaid = status === 'paid';

  return (
    <article
      data-testid={`rental-card-${index}`}
      className={`kbs-surface group relative animate-rise-in overflow-hidden rounded-[26px] transition-colors ${open ? 'bg-night-800' : ''}`}
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left"
      >
        <ProgressRing percent={percent} size={48} stroke={3} tone={isPaid ? 'pos' : 'mixed'}>
          <span className={`text-[16px] font-semibold ${isPaid ? 'text-pos' : 'text-fog'}`}>{initials(record.name)}</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <h3 data-testid={`customer-name-${index}`} className="truncate text-[16px] font-semibold leading-tight tracking-tight">
            {record.name}
          </h3>
          <p className="mt-1 truncate text-[12.5px] text-fog/45">{summary(record)}</p>
        </div>

        <div className="shrink-0 text-right">
          {isPaid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-pos/10 px-2.5 py-1 text-[12px] font-semibold text-pos">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              பெறப்பட்டது
            </span>
          ) : (
            <p data-testid={`pending-cell-${index}`} className="text-[17px] font-semibold leading-tight tracking-tight text-coral-400">
              {formatCurrency(pending)}
            </p>
          )}
          <p className="mt-1 text-[12px] text-fog/35">{formatCurrency(record.total_amount)}</p>
        </div>
      </button>

      {/* Details — CSS grid-rows trick animates height without measuring. */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="mx-4 border-t border-dashed border-line/10 pt-3">
            {details.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-[13.5px]">
                <span className="truncate text-fog/60">
                  <span className="font-medium text-fog/90">{d.equipment_type}</span>
                  <span className="mx-1.5 text-fog/25">·</span>
                  {d.equipment_type === 'Dipper' ? `${d.nadai ?? 0} நடை` : `${d.acres} மா × ${d.rounds} சால்`}
                </span>
                <span className="shrink-0 text-fog/70">{formatCurrency(detailAmount(d))}</span>
              </div>
            ))}
            {record.old_balance && (
              <div className="flex items-center justify-between gap-3 py-1.5 text-[13.5px]">
                <span className="flex min-w-0 items-center gap-1.5 text-fog/60">
                  <History className="h-3.5 w-3.5 shrink-0 text-fog/40" />
                  <span className="font-medium text-fog/90">பழைய பாக்கி</span>
                  {record.old_balance_reason && <span className="truncate text-fog/40">· {record.old_balance_reason}</span>}
                </span>
                <span className={`shrink-0 ${record.old_balance_status === 'paid' ? 'text-pos/80' : 'text-coral-400/90'}`}>
                  {formatCurrency(parseFloat(record.old_balance) || 0)}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between py-1.5 text-[13.5px]">
              <span className="text-fog/45">பெறப்பட்டது</span>
              <span className="font-medium text-pos">{formatCurrency(record.received_amount || 0)}</span>
            </div>
            <p className="pb-1 text-[12px] text-fog/35">
              {new Date(record.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {(onEdit || onDelete) && (
          <div className="flex gap-2 px-4 pb-1 pt-3">
            {onEdit && (
            <button
              type="button"
              data-testid={`edit-button-${index}`}
              onClick={() => onEdit(record)}
              className="kbs-press flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-line/[0.05] text-[13px] font-medium text-fog/80 hover:bg-line/[0.08]"
            >
              <Pencil className="h-4 w-4" />
              திருத்து
            </button>
            )}
            {onDelete && (
            <button
              type="button"
              data-testid={`delete-button-${index}`}
              onClick={() => onDelete(record)}
              className="kbs-press flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-line/[0.05] text-[13px] font-medium text-fog/80 hover:bg-coral-500/15 hover:text-coral-300"
            >
              <Trash2 className="h-4 w-4" />
              நீக்கு
            </button>
            )}
          </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-4 pt-1">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/[0.06]">
          <div
            className={`h-full rounded-full ${isPaid ? 'bg-brand' : 'bg-gradient-to-r from-pos to-coral-400'}`}
            style={{ width: `${percent}%`, transition: 'width 900ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-fog/30 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        {!isPaid && onCollect && (
          <button
            type="button"
            data-testid={`collect-button-${index}`}
            onClick={() => onCollect(record)}
            className="kbs-press -my-1 inline-flex h-9 items-center gap-1 rounded-full bg-brand pl-3.5 pr-3 text-[13px] font-semibold text-brand-fg shadow-[0_6px_20px_-6px_rgb(var(--brand)/0.55)] hover:bg-brand-hover"
          >
            வசூல்
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </article>
  );
}

import { memo, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Check, ChevronDown, History, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { RentalRecord } from '../../types/rental';
import { formatCurrency } from '../../utils/calculations';
import { Burst, ProgressRing, useCountUp } from './motion';
import { detailAmount, initials, paidPercent, rentalStatus } from './rentalDisplay';

interface RentalRowProps {
  record: RentalRecord;
  index: number;
  /** Slide in on mount. Only wanted for the first load, not every time the list re-mounts. */
  animateIn?: boolean;
  /** Omitted when this login isn't allowed to do that action. */
  onCollect?: (record: RentalRecord) => void;
  onEdit?: (record: RentalRecord) => void;
  onDelete?: (record: RentalRecord) => void;
  /** Glow briefly: just saved from the form (after its close transition) or just collected. */
  highlight?: 'saved' | 'created' | 'collected' | null;
  /** Changes on every new highlight, so the same row can glow again. */
  highlightKey?: number;
  /** Just became fully paid — pop the badge with a burst. */
  celebrate?: boolean;
}

function summary(record: RentalRecord): string {
  const details = record.details ?? [];
  if (!details.length) return record.old_balance ? 'பழைய பாக்கி' : '—';
  const types = [...new Set(details.map((d) => d.equipment_type))];
  return `${details.length} உழவு · ${types.join(', ')}`;
}

/**
 * Memoised: the dashboard re-renders on every tap (opening the form, sheets,
 * toasts); rows only redraw when their own record or highlight changes, so
 * transitions start without waiting on the whole list.
 */
export const RentalRow = memo(function RentalRow({ record, index, animateIn = true, onCollect, onEdit, onDelete, highlight = null, highlightKey, celebrate = false }: RentalRowProps) {
  const [open, setOpen] = useState(false);
  // Fixed at mount, so a later re-render can't cut the slide-in short.
  const [slideIn] = useState(animateIn);
  const { status, pending } = rentalStatus(record);
  const percent = paidPercent(record);
  const details = record.details ?? [];
  const isPaid = status === 'paid';
  // Counts down when a collection lands, but doesn't count up on first load.
  const shownPending = useCountUp(pending, 800, false);

  return (
    <article
      data-testid={`rental-card-${index}`}
      data-flip={`row-${record.id}`}
      className={`kbs-surface group relative ${slideIn ? 'animate-rise-in' : ''} cursor-pointer overflow-hidden rounded-[26px] transition-colors ${open ? 'bg-night-800' : ''}`}
      style={slideIn ? { animationDelay: `${Math.min(index, 10) * 45}ms` } : undefined}
      // The whole card toggles; the header button's click bubbles here and keeps it keyboard-reachable.
      onClick={() => setOpen((v) => !v)}
    >
      {highlight && (
        // Separate layer, so the glow never restarts the row's own entrance animation.
        <span
          key={highlightKey}
          aria-hidden="true"
          className="kbs-row-flash pointer-events-none absolute inset-0 z-10 rounded-[26px]"
          style={{ '--flash-delay': highlight === 'saved' ? '480ms' : highlight === 'created' ? '250ms' : '0ms' } as CSSProperties}
        />
      )}
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left"
      >
        <ProgressRing percent={percent} size={48} stroke={3} tone={isPaid ? 'pos' : 'mixed'}>
          <span className={`text-[16px] font-semibold ${isPaid ? 'text-pos' : 'text-fog'}`}>{initials(record.name)}</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 data-testid={`customer-name-${index}`} className="truncate text-[16px] font-semibold leading-tight tracking-tight">
              {record.name}
            </h3>
            {highlight === 'created' && (
              <span
                key={highlightKey}
                data-testid={`new-badge-${index}`}
                className="kbs-pop shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-brand-fg"
              >
                புதியது
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[12.5px] text-fog/45">{summary(record)}</p>
        </div>

        <div className="shrink-0 text-right">
          {isPaid ? (
            <span
              className={`relative inline-flex items-center gap-1 rounded-full bg-pos/10 px-2.5 py-1 text-[12px] font-semibold text-pos ${
                celebrate ? 'kbs-pop' : ''
              }`}
            >
              {celebrate && <Burst key={highlightKey} />}
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              பெறப்பட்டது
            </span>
          ) : (
            <p data-testid={`pending-cell-${index}`} className="text-[17px] font-semibold leading-tight tracking-tight text-coral-400">
              {formatCurrency(shownPending)}
            </p>
          )}
          <p className="mt-1 text-[12px] text-fog/35">{formatCurrency(record.total_amount)}</p>
        </div>
      </button>

      {/* Details — CSS grid-rows trick animates height without measuring. */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="mx-4 border-t border-dashed border-line/10 pt-3">
            {details.length > 0 && (
              // Each job is its own tile, numbered like the form, so jobs read as separate units.
              <div className="space-y-2 pb-1">
                {details.map((d, i) => (
                  <div
                    key={i}
                    data-testid={`job-tile-${index}-${i}`}
                    className="flex items-start gap-3 rounded-2xl bg-line/[0.035] p-3 ring-1 ring-inset ring-line/[0.06]"
                  >
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pos/10 text-[11.5px] font-semibold text-pos ring-1 ring-inset ring-pos/25">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[14.5px] font-semibold tracking-tight">{d.equipment_type}</span>
                        <span className="shrink-0 text-[14px] font-semibold text-fog/85">{formatCurrency(detailAmount(d))}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[12.5px] text-fog/55">
                          {d.equipment_type === 'Dipper' ? `${d.nadai ?? 0} நடை` : `${d.acres} மா × ${d.rounds} சால்`}
                        </span>
                        {d.place && (
                          // Wraps instead of truncating, so a long place is always shown in full.
                          <span className="inline-flex max-w-full items-start gap-1 rounded-xl bg-pos/10 px-2 py-0.5 text-[11.5px] font-medium leading-[1.5] text-pos">
                            <MapPin className="mt-[3px] h-3 w-3 shrink-0" />
                            <span className="min-w-0 [overflow-wrap:anywhere]">{d.place}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              onClick={(e) => {
                e.stopPropagation();
                onEdit(record);
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                onDelete(record);
              }}
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
            onClick={(e) => {
              e.stopPropagation();
              onCollect(record);
            }}
            className="kbs-press -my-1 inline-flex h-9 items-center gap-1 rounded-full bg-brand pl-3.5 pr-3 text-[13px] font-semibold text-brand-fg shadow-[0_6px_20px_-6px_rgb(var(--brand)/0.55)] hover:bg-brand-hover"
          >
            வசூல்
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </article>
  );
});

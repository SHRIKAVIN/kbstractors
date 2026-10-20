import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import type { RentalRecord } from '../../types/rental';
import { BottomSheet } from './BottomSheet';
import { EMPTY_FILTERS, filterRentals, type RentalFilters } from './rentalFilters';

const EQUIPMENT = ['Cage Wheel', 'Rotavator', 'புழுதி', 'Mini', 'Dipper'];

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  /** Currently applied filters — the sheet edits a draft copy of these. */
  filters: RentalFilters;
  onApply: (next: RentalFilters) => void;
  records: RentalRecord[];
  onExportExcel: (records: RentalRecord[]) => void;
  onExportPdf: (records: RentalRecord[]) => void;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`kbs-press rounded-full border px-3.5 py-2 text-[13px] font-medium ${
        active ? 'border-brand bg-brand text-brand-fg' : 'border-line/10 bg-line/[0.04] text-fog/70'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Choices only change a draft; the list behind the sheet updates when the
 * user taps "show N records". Closing any other way discards the draft.
 */
export function FilterSheet({ open, onClose, filters, onApply, records, onExportExcel, onExportPdf }: FilterSheetProps) {
  const [draft, setDraft] = useState<RentalFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
    // Only re-seed when the sheet opens, not while the user is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const matching = useMemo(() => filterRentals(records, draft), [records, draft]);
  const resultCount = matching.length;
  const set = (patch: Partial<RentalFilters>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="வடிகட்டி & ஏற்றுமதி"
      subtitle={`${resultCount} பதிவுகள்`}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY_FILTERS, name: draft.name })}
            className="kbs-press flex-1 rounded-2xl bg-line/[0.06] py-4 text-[14px] font-medium text-fog/70"
          >
            அழி
          </button>
          <button
            type="button"
            data-testid="apply-filters-button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="kbs-press flex-[2] rounded-2xl bg-brand py-4 text-[14px] font-semibold text-brand-fg"
          >
            {resultCount} பதிவுகளைக் காட்டு
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="kbs-label">வகை</h3>
          <div className="flex flex-wrap gap-2">
            <Chip active={!draft.equipment} onClick={() => set({ equipment: '' })}>அனைத்தும்</Chip>
            {EQUIPMENT.map((eq) => (
              <Chip key={eq} active={draft.equipment === eq} onClick={() => set({ equipment: eq })}>{eq}</Chip>
            ))}
          </div>
        </section>

        <section>
          <h3 className="kbs-label">பழைய பாக்கி</h3>
          <div className="flex flex-wrap gap-2">
            <Chip active={!draft.oldBalanceStatus} onClick={() => set({ oldBalanceStatus: '' })}>அனைத்தும்</Chip>
            <Chip active={draft.oldBalanceStatus === 'pending'} onClick={() => set({ oldBalanceStatus: 'pending' })}>நிலுவையில்</Chip>
            <Chip active={draft.oldBalanceStatus === 'paid'} onClick={() => set({ oldBalanceStatus: 'paid' })}>பெறப்பட்டது</Chip>
          </div>
        </section>

        <section>
          <h3 className="kbs-label">ஏற்றுமதி (தற்போதைய பட்டியல்)</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onExportExcel(matching)}
              className="kbs-press flex items-center justify-center gap-2 rounded-2xl bg-line/[0.04] py-4 text-[14px] font-medium text-fog ring-1 ring-inset ring-line/10 hover:bg-line/[0.07]"
            >
              <FileSpreadsheet className="h-5 w-5 text-pos" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => onExportPdf(matching)}
              className="kbs-press flex items-center justify-center gap-2 rounded-2xl bg-line/[0.04] py-4 text-[14px] font-medium text-fog ring-1 ring-inset ring-line/10 hover:bg-line/[0.07]"
            >
              <FileText className="h-5 w-5 text-coral-400" />
              PDF
            </button>
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}

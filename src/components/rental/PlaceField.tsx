import { useMemo, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';

interface PlaceFieldProps {
  id: string;
  testId: string;
  /** This job's place as typed or picked ('' = none). */
  value: string;
  onChange: (place: string) => void;
  /** Places to offer as one-tap chips: this entry's other jobs first, then recent ones. */
  suggestions: string[];
  placeholder: string;
}

const MAX_CHIPS = 8;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * A job's place: a plain field plus a row of one-tap place chips. Chips show
 * while the field is empty or being edited, and narrow down as you type.
 */
export function PlaceField({ id, testId, value, onChange, suggestions, placeholder }: PlaceFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // While typing, filter by what's typed; just focusing a filled field shows everything else.
  const [typed, setTyped] = useState(false);

  const chips = useMemo(() => {
    const current = norm(value);
    const query = typed ? current : '';
    const seen = new Set<string>();
    const out: string[] = [];
    for (const place of suggestions) {
      const key = norm(place);
      if (!key || seen.has(key) || key === current) continue;
      if (query && !key.includes(query)) continue;
      seen.add(key);
      out.push(place.trim());
      if (out.length >= MAX_CHIPS) break;
    }
    return out;
  }, [suggestions, value, typed]);

  const showChips = chips.length > 0 && (focused || !value.trim());

  return (
    <div className="mt-3">
      <div className={`kbs-field flex items-center gap-2 py-3 ${focused ? 'bg-line/[0.06] ring-2 ring-pos/60' : ''}`}>
        <MapPin className={`h-4 w-4 shrink-0 ${value.trim() ? 'text-pos' : 'text-fog/35'}`} />
        <input
          ref={inputRef}
          id={id}
          data-testid={testId}
          type="text"
          value={value}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder}
          onFocus={(e) => {
            setFocused(true);
            setTyped(false);
            e.currentTarget.select();
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setTyped(true);
            onChange(e.target.value);
          }}
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-fog/30"
        />
        {value && (
          <button
            type="button"
            data-testid={`${testId}-clear`}
            // Keep the field focused so the chips stay up after clearing.
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setTyped(false);
            }}
            className="kbs-press grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line/[0.08] text-fog/50"
            aria-label="Clear place"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showChips && (
        <div className="no-scrollbar -mx-4 mt-2 flex animate-fade-in gap-2 overflow-x-auto px-4 pb-0.5" data-testid={`${testId}-chips`}>
          {chips.map((place) => (
            <button
              key={place}
              type="button"
              // Don't let the tap blur the field first (that would hide the chips mid-tap).
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(place);
                setTyped(false);
                inputRef.current?.blur();
              }}
              className="kbs-press flex shrink-0 items-center gap-1.5 rounded-full bg-pos/10 px-3 py-1.5 text-[13px] font-medium text-pos ring-1 ring-inset ring-pos/20"
            >
              <MapPin className="h-3 w-3" />
              {place}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

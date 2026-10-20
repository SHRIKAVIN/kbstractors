import { useEffect, useRef, useState } from 'react';
import { ChevronsRight } from 'lucide-react';
import { haptic } from './motion';

interface SlideToConfirmProps {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Bump to snap the thumb back to the start (e.g. after a failed save). */
  resetKey?: unknown;
}

const PAD = 6;
const THUMB = 56;
const CONFIRM_AT = 0.86;

/** "Slide to pay" control. Enter/Space on the focused thumb also confirms. */
export function SlideToConfirm({ label, onConfirm, disabled, busy, resetKey }: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  const max = () => (trackRef.current ? trackRef.current.clientWidth - THUMB - PAD * 2 : 0);

  useEffect(() => {
    setX(0);
    setDone(false);
  }, [resetKey]);

  const confirm = () => {
    if (disabled || busy || done) return;
    setX(max());
    setDone(true);
    haptic(18);
    onConfirm();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || busy || done) return;
    startX.current = e.clientX - x;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setX(Math.max(0, Math.min(max(), e.clientX - startX.current)));
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    if (x >= max() * CONFIRM_AT) confirm();
    else setX(0);
  };

  const progress = max() ? x / max() : 0;

  return (
    <div
      ref={trackRef}
      className={`relative h-[68px] select-none overflow-hidden rounded-full bg-line/[0.05] ring-1 ring-inset ring-line/10 transition-opacity ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pos/0 via-pos/20 to-pos/40"
        style={{ width: x + THUMB + PAD * 2, transition: dragging ? 'none' : 'width 380ms cubic-bezier(0.22,1,0.36,1)' }}
      />
      <span
        className="kbs-shimmer-text pointer-events-none absolute inset-0 grid place-items-center pl-12 text-[15px] font-semibold"
        style={{ opacity: 1 - progress * 1.4 }}
      >
        {label}
      </span>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            confirm();
          }
        }}
        className="absolute top-[6px] grid touch-none place-items-center rounded-full bg-brand text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.12),0_10px_30px_-6px_rgb(var(--brand)/0.6)] outline-none focus-visible:ring-2 focus-visible:ring-fog"
        style={{
          left: PAD,
          width: THUMB,
          height: THUMB,
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {busy ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-fg/30 border-t-brand-fg" />
        ) : (
          <ChevronsRight className="h-6 w-6" strokeWidth={2.4} />
        )}
      </button>
    </div>
  );
}

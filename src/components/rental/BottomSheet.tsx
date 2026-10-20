import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Replaces the default title row (still gets the close button). */
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

const CLOSE_MS = 260;
const DRAG_DISMISS_PX = 110;

/**
 * Mobile-first bottom sheet (centered dialog from `sm` up). Drag the handle
 * down to dismiss; tap the backdrop or press Escape to close. Keeps itself
 * mounted for a short exit animation after `open` turns false.
 */
export function BottomSheet({ open, onClose, title, subtitle, header, children, footer }: BottomSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDragY(0);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted]);

  if (!mounted) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (dragY > DRAG_DISMISS_PX) onClose();
    else setDragY(0);
  };

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className="kbs-press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-line/[0.06] text-fog/60 hover:bg-line/10 hover:text-fog"
      aria-label="Close"
    >
      <X className="h-[18px] w-[18px]" />
    </button>
  );

  return createPortal(
    <div className="kbs-app fixed inset-0 z-[60] flex items-end justify-center !bg-transparent sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md transition-opacity duration-200 ${closing ? 'opacity-0' : 'animate-fade-in'}`}
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[32px] bg-night-900 shadow-[0_-24px_80px_-12px_rgb(var(--shade)/var(--shade-a))] ring-1 ring-line/[0.08] sm:max-w-[440px] sm:rounded-[32px] ${
          closing ? 'translate-y-full transition-transform duration-[260ms] ease-in sm:translate-y-8 sm:opacity-0' : 'animate-sheet-up'
        }`}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        {/* Sheen along the top edge */}
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-line/25 to-transparent" />

        <div
          className="flex cursor-grab touch-none justify-center pb-1 pt-3 sm:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1 w-10 rounded-full bg-line/20" />
        </div>

        {header ? (
          <div className="flex items-start gap-3 px-5 pb-2 pt-2 sm:pt-5">
            <div className="min-w-0 flex-1">{header}</div>
            {closeButton}
          </div>
        ) : (title || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-2 sm:pt-5">
            <div className="min-w-0">
              {title && <h2 className="truncate text-[19px] font-semibold tracking-tight text-fog">{title}</h2>}
              {subtitle && <p className="mt-0.5 truncate text-[13px] text-fog/45">{subtitle}</p>}
            </div>
            {closeButton}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>

        {footer && (
          <div className="px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

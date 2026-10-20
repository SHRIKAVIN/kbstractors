import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { haptic, prefersReducedMotion } from './motion';

interface FormSheetProps {
  /** Set to true to play the slide-down; `onExited` fires when it's done. */
  closing: boolean;
  onExited: () => void;
  children: ReactNode;
  /** Shown over the form (e.g. the "saved" confirmation); slides away with the sheet. */
  overlay?: ReactNode;
}

// iOS's own sheet curve: quick start, long soft settle.
const SHEET_IN = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SHEET_OUT = 'cubic-bezier(0.32, 0, 0.67, 0)';
const IN_MS = 460;
const OUT_MS = 320;

/**
 * Full-screen sheet the entry form slides up in, over the (still mounted,
 * dimmed) list — and back down on close.
 *
 * Why this is smooth on phones: exactly one layer moves, with transform
 * only, so the GPU does all the work; the form is already rendered before
 * the first frame (nothing mounts mid-animation); and the frosted-glass
 * (backdrop-filter) surfaces inside are switched off while it moves, since
 * re-blurring every frame is what makes iOS drop frames.
 */
export function FormSheet({ closing, onExited, children, overlay }: FormSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;

  // The page underneath must not scroll while the sheet is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const dim = dimRef.current;
    if (!sheet || !dim) return;
    if (prefersReducedMotion()) {
      dim.style.opacity = '1';
      return;
    }
    haptic(8);
    sheet.classList.add('kbs-sheet-moving');
    const slide = sheet.animate([{ transform: 'translate3d(0, 100%, 0)' }, { transform: 'translate3d(0, 0, 0)' }], {
      duration: IN_MS,
      easing: SHEET_IN,
      fill: 'backwards',
    });
    dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: IN_MS, easing: 'ease-out', fill: 'both' });
    slide.onfinish = () => sheet.classList.remove('kbs-sheet-moving');
    return () => {
      slide.onfinish = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!closing) return;
    const sheet = sheetRef.current;
    const dim = dimRef.current;
    if (!sheet || !dim || prefersReducedMotion()) {
      exitedRef.current();
      return;
    }
    sheet.classList.add('kbs-sheet-moving');
    const slide = sheet.animate([{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(0, 100%, 0)' }], {
      duration: OUT_MS,
      easing: SHEET_OUT,
      fill: 'forwards',
    });
    dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: 'ease-in', fill: 'forwards' });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      exitedRef.current();
    };
    slide.onfinish = finish;
    // Never strand the sheet if the animation is interrupted (tab hidden, etc.).
    const safety = window.setTimeout(finish, OUT_MS + 300);
    return () => {
      slide.onfinish = null;
      window.clearTimeout(safety);
    };
  }, [closing]);

  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <div ref={dimRef} className="absolute inset-0 bg-black/45 opacity-0" aria-hidden="true" />
      {/* Two layers on purpose: the outer one moves, the inner one scrolls. A
          moving element captures position:fixed children, so if one element did
          both, the form's fixed save bar would scroll away with the content. */}
      <div ref={sheetRef} data-testid="form-sheet" className="kbs-app absolute inset-0">
        <div className="absolute inset-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">{children}</div>
        {overlay}
      </div>
    </div>,
    document.body,
  );
}

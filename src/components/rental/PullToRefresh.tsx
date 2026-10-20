import { useEffect, useRef } from 'react';
import { haptic } from './motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  /** Off while a sheet / transition is showing. */
  disabled?: boolean;
}

const TRIGGER = 72; // px of (damped) pull needed to refresh
const MAX = 120;
const REST = 64; // where the spinner sits while refreshing

/**
 * Pull-to-refresh for the window-scrolled list. Installed iOS web apps have no
 * native one, and Android's is off in standalone mode, so this is the only way
 * to refresh by gesture.
 *
 * Drives its own DOM from the touch handlers (no React state per move), so
 * the drag stays at full frame rate on phones.
 */
export function PullToRefresh({ onRefresh, disabled = false }: PullToRefreshProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const wrap = wrapRef.current;
    const icon = iconRef.current;
    if (!wrap || !icon) return;

    let startY = 0;
    let pulling = false;
    let pull = 0;
    let armed = false;
    let refreshing = false;

    // The page must not rubber-band or reload underneath our own gesture.
    const root = document.documentElement;
    const prevOverscroll = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'none';

    const paint = (distance: number, animate: boolean) => {
      const progress = Math.min(distance / TRIGGER, 1);
      wrap.style.transition = animate ? 'transform 380ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease' : 'none';
      wrap.style.transform = `translate3d(-50%, ${distance - 56}px, 0) scale(${0.6 + 0.4 * progress})`;
      wrap.style.opacity = String(distance <= 0 ? 0 : Math.min(1, 0.25 + progress));
      if (!refreshing) icon.style.transform = `rotate(${distance * 3}deg)`;
    };

    const blocked = () =>
      disabledRef.current || refreshing || document.body.style.overflow === 'hidden' || window.scrollY > 0;

    const onStart = (e: TouchEvent) => {
      if (blocked() || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      pulling = true;
      pull = 0;
      armed = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) {
        if (pull > 0) paint(0, false);
        pull = 0;
        return;
      }
      // Rubber-band: the further you pull, the harder it gets.
      pull = Math.min(MAX, dy * 0.5 - (dy * dy) / 5000);
      if (pull < 0) pull = 0;
      if (e.cancelable) e.preventDefault();
      paint(pull, false);
      const nowArmed = pull >= TRIGGER;
      if (nowArmed !== armed) {
        armed = nowArmed;
        if (armed) haptic(10);
      }
    };

    const onEnd = async () => {
      if (!pulling) return;
      pulling = false;
      if (!armed) {
        paint(0, true);
        return;
      }
      refreshing = true;
      paint(REST, true);
      icon.classList.add('kbs-ptr-spin');
      try {
        await Promise.all([onRefreshRef.current(), new Promise((r) => setTimeout(r, 600))]);
      } finally {
        icon.classList.remove('kbs-ptr-spin');
        refreshing = false;
        armed = false;
        paint(0, true);
      }
    };

    paint(0, false);
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      root.style.overscrollBehaviorY = prevOverscroll;
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-1/2 top-[env(safe-area-inset-top)] z-[45] grid h-11 w-11 place-items-center rounded-full bg-night-800 opacity-0 shadow-[0_10px_30px_-8px_rgb(var(--shade)/var(--shade-a))] ring-1 ring-line/10 will-change-transform"
    >
      <div ref={iconRef} className="grid h-8 w-8 place-items-center">
        <img src="/icons/kbs-tractors-96.png" alt="" className="h-8 w-8 rounded-full" draggable={false} />
      </div>
    </div>
  );
}

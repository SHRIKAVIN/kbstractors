import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Where the morph grows from / shrinks back into (viewport px). */
export interface MorphOrigin {
  x: number;
  y: number;
  /** Diameter of the circle at rest — roughly the tapped button's height. */
  size: number;
}

/**
 * The four steps of the "button grows into the form" transition, all played
 * on ONE layer that stays mounted across the list ⇄ form swap (Dashboard keeps
 * it at a fixed spot in its tree), so the swap can happen mid-animation —
 * that overlap is what keeps a blank frame from ever showing:
 *
 *   expand   circle grows from the button; the form mounts underneath partway
 *            in, and the circle turns see-through over its last stretch so the
 *            form's content (already sliding in) shows straight through it
 *   conceal  the cover fades in quickly as the form leaves
 *   collapse the cover shrinks back into the + button, revealing the list
 */
export type MorphPhase = 'expand' | 'conceal' | 'collapse';

/** How long into `expand` the form should be mounted underneath the circle. */
export const MORPH_SWAP_MS = 200;

interface FormMorphProps {
  phase: MorphPhase;
  origin: MorphOrigin;
  onDone: () => void;
}

const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function themeColor(name: string): string {
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `rgb(${rgb.split(/\s+/).join(', ')})`;
}

/** Radius that covers the whole screen from (x, y). */
function coverRadius(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y))) + 2;
}

/** Position the layer as a circle centred on (x, y) that covers the screen at scale(1). */
function asCircle(el: HTMLElement, x: number, y: number): number {
  const radius = coverRadius(x, y);
  Object.assign(el.style, {
    inset: 'auto',
    left: `${x - radius}px`,
    top: `${y - radius}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    borderRadius: '50%',
  });
  return radius;
}

export function FormMorph({ phase, origin, onDone }: FormMorphProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const tintAnimRef = useRef<Animation | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const el = layerRef.current;
    const tint = tintRef.current;
    if (!el || !tint) return;
    // Only transform and opacity are ever animated: phones run those on the
    // GPU, off the main thread, so the motion stays smooth even while React
    // mounts the form underneath mid-way. (Animating background-color would
    // force a repaint of this screen-sized layer every frame and drag the
    // whole animation onto the main thread — that's what made it stutter.)
    // The green-to-page colour shift is a green "tint" child fading out.
    el.style.backgroundColor = themeColor('--night-950');
    tint.style.backgroundColor = themeColor('--brand');
    let animation: Animation;
    let tintAnimation: Animation | null = null;

    if (phase === 'expand') {
      const radius = asCircle(el, origin.x, origin.y);
      const small = `scale(${Math.max(origin.size, 8) / (radius * 2)})`;
      // A real circle scaled with transform — composited by the GPU, so it stays
      // smooth on phones (animating clip-path or width/height would not).
      // Easing is per segment: the grow eases out, then the fade is linear.
      animation = el.animate(
        [
          { transform: small, opacity: 1, offset: 0, easing: EASE_OUT },
          { transform: 'scale(0.82)', opacity: 1, offset: 0.5, easing: 'linear' },
          { transform: 'scale(1)', opacity: 0, offset: 1 },
        ],
        { duration: 460, fill: 'both' },
      );
      tintAnimation = tint.animate([{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], {
        duration: 460,
        easing: 'ease-out',
        fill: 'both',
      });
    } else if (phase === 'conceal') {
      Object.assign(el.style, { inset: '0', left: '0', top: '0', width: '100%', height: '100%', borderRadius: '0' });
      animation = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-in', fill: 'both' });
      tintAnimation = tint.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 120, fill: 'both' });
    } else {
      // Land on wherever the + button is now (the list has just re-rendered).
      let { x, y, size } = origin;
      const fab = document.querySelector<HTMLElement>('[data-testid="add-record-button"]');
      if (fab) {
        const r = fab.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
        size = r.height;
      }
      const radius = asCircle(el, x, y);
      const small = `scale(${Math.max(size, 8) / (radius * 2)})`;
      // Fast start so the list shows through straight away, gentle landing on the button.
      animation = el.animate(
        [
          { transform: 'scale(1)', opacity: 1, offset: 0 },
          { transform: small, opacity: 1, offset: 0.88 },
          { transform: small, opacity: 0, offset: 1 },
        ],
        { duration: 420, easing: EASE_OUT, fill: 'both' },
      );
      // Turns green as it lands, so it hands off into the + button.
      tintAnimation = tint.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1, offset: 0.88 }, { opacity: 1 }], {
        duration: 420,
        fill: 'both',
      });
    }

    // Start the new phase before dropping the old one, so there's no gap frame.
    animRef.current?.cancel();
    tintAnimRef.current?.cancel();
    animRef.current = animation;
    tintAnimRef.current = tintAnimation;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      doneRef.current();
    };
    animation.onfinish = finish;
    // Never leave the screen covered if the animation is interrupted (tab hidden, etc.).
    const safety = window.setTimeout(finish, 900);
    return () => {
      window.clearTimeout(safety);
      animation.onfinish = null;
    };
  }, [phase, origin]);

  useLayoutEffect(
    () => () => {
      animRef.current?.cancel();
      tintAnimRef.current?.cancel();
    },
    [],
  );

  return createPortal(
    <>
      {/* Swallow taps for the ~half second the transition runs. */}
      <div className="fixed inset-0 z-[80]" aria-hidden="true" />
      <div
        ref={layerRef}
        className="pointer-events-none fixed z-[81] overflow-hidden will-change-transform [backface-visibility:hidden]"
        aria-hidden="true"
      >
        <div ref={tintRef} className="absolute inset-0 rounded-[inherit] will-change-[opacity]" />
      </div>
    </>,
    document.body,
  );
}

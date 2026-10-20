import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

/**
 * Eases a number from its previous value to `target`. Counts up from 0 on
 * first render unless `fromZero` is false (then it only animates changes).
 */
export function useCountUp(target: number, durationMs = 900, fromZero = true): number {
  const [value, setValue] = useState(fromZero ? 0 : target);
  const fromRef = useRef(fromZero ? 0 : target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 4);
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return Math.round(value);
}

interface ProgressRingProps {
  /** 0–100 */
  percent: number;
  size: number;
  stroke: number;
  tone?: 'pos' | 'coral' | 'mixed';
  children?: React.ReactNode;
}

/** Circular progress with a gradient stroke; content is centered inside. */
export function ProgressRing({ percent, size, stroke, tone = 'mixed', children }: ProgressRingProps) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  // Theme-aware: stops read the CSS colour variables, so the ring follows light/dark mode.
  const stops =
    tone === 'pos' ? ['--pos', '--brand'] : tone === 'coral' ? ['--coral-300', '--coral-500'] : ['--pos', '--coral-400'];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: `rgb(var(${stops[0]}))` }} />
            <stop offset="100%" style={{ stopColor: `rgb(var(${stops[1]}))` }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'rgb(var(--line) / 0.08)' }} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

const BURST_COLORS = ['rgb(var(--pos))', 'rgb(var(--brand))', 'rgb(var(--coral-400))', '#f5c542'];

/** Small celebratory particle burst (e.g. an entry just became fully paid). */
export function Burst({ count = 10 }: { count?: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const distance = 26 + (i % 3) * 8;
        return (
          <span
            key={i}
            className="kbs-burst absolute h-1.5 w-1.5 rounded-full"
            style={
              {
                background: BURST_COLORS[i % BURST_COLORS.length],
                '--bx': `${Math.cos(angle) * distance}px`,
                '--by': `${Math.sin(angle) * distance}px`,
                animationDelay: `${(i % 4) * 18}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}


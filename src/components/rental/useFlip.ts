import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from './FormMorph';

/**
 * FLIP: when the list re-renders, every element marked `data-flip="<key>"`
 * that moved glides from its old spot to its new one instead of jumping —
 * rows closing the gap after a delete, rows re-ordering after a filter or tab
 * change, date headers shifting. Positions are measured relative to the
 * container, so scrolling in between doesn't count as movement.
 *
 * Only transform is animated (GPU-composited — smooth on phones).
 */
export function useFlip(containerRef: RefObject<HTMLElement>, deps: unknown[]) {
  const last = useRef(new Map<string, { x: number; y: number }>());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      last.current = new Map();
      return;
    }
    const origin = container.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    const reduce = prefersReducedMotion();

    container.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const key = el.dataset.flip!;
      const r = el.getBoundingClientRect();
      const pos = { x: r.left - origin.left, y: r.top - origin.top };
      next.set(key, pos);

      const prev = last.current.get(key);
      if (!prev || reduce) return;
      const dx = prev.x - pos.x;
      const dy = prev.y - pos.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 420,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        composite: 'add',
      });
    });

    last.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

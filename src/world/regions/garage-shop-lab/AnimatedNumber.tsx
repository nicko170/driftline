/**
 * AnimatedNumber — the wallet tally. Counts from its previous value to the
 * new one with ease-out timing, so a purchase reads as money leaving a till
 * rather than a field re-rendering. Honors prefers-reduced-motion by
 * snapping (accessibility rule: animation is decoration, never information).
 */
import { useEffect, useRef, useState } from 'react';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function AnimatedNumber({
  value,
  duration = 420,
  format = (n: number) => n.toLocaleString(),
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const shownRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    if (shownRef.current === value) return;
    if (reduceMotion() || duration <= 0) {
      setShown(value);
      shownRef.current = value;
      fromRef.current = value;
      return;
    }
    const from = shownRef.current;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const n = Math.round(from + (value - from) * eased);
      setShown(n);
      shownRef.current = n;
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{format(shown)}</>;
}

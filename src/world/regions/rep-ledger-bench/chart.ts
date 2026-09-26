/**
 * Shared canvas helpers for the Rep Ledger Bench: the bench palette, font
 * stacks, a DPR-aware sizing hook that redraws on resize (and once more when
 * the display font arrives), and small drawing primitives. Static charts —
 * each canvas paints on demand only; nothing runs on requestAnimationFrame.
 */
import { useEffect, useRef, type RefObject } from 'react';

export const C = {
  space: '#14101F',
  ink: '#1B1526',
  violet: '#2A2140',
  salt: '#F3EEE2',
  bone: '#E4D7BE',
  sand: '#D9A45B',
  ochre: '#B07C3A',
  rust: '#B3502E',
  rustDeep: '#7E3320',
  teal: '#2E8C8C',
  tealBright: '#57C4B8',
  amber: '#FFB454',
  amberHot: '#FFC969',
  danger: '#E4572E',
};

export const FONT_D = '"Chakra Petch", ui-sans-serif, system-ui, sans-serif';
export const FONT_B = '"Sora", ui-sans-serif, system-ui, sans-serif';

export const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * Sizes a canvas to its parent width × cssHeight (DPR-aware, capped at 2×)
 * and (re)paints via `draw` on mount, on resize, when fonts settle, and
 * whenever `redrawKey` changes.
 */
export function useChart(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cssHeight: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  redrawKey: unknown,
): void {
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    if (!canvas || !wrap) return;
    let raf = 0;
    let live = true;
    const paint = () => {
      const w = Math.max(320, wrap.clientWidth);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${cssHeight}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, w, cssHeight);
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    });
    ro.observe(wrap);
    paint();
    document.fonts?.ready.then(() => live && paint()).catch(() => {});
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, cssHeight, redrawKey]);
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Cubic bezier point (scalar form — feed x or y components). */
export function bez(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Diagonal hatch fill inside a rect — the "earned on the side board" texture. */
export function hatchRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha = 0.5,
  gap = 5,
): void {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let d = -h; d < w; d += gap) {
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Dashed horizontal rail line across a plot area, labelled at the right. */
export function railLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x0: number,
  x1: number,
  label: string,
): void {
  ctx.save();
  ctx.strokeStyle = rgba(C.sand, 0.45);
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `600 10px ${FONT_D}`;
  ctx.fillStyle = rgba(C.sand, 0.85);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, x0 + 6, y - 3);
  ctx.restore();
}

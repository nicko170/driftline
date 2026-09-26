/**
 * Scope.tsx — cathode-ray line scope on canvas 2D.
 * Phosphor persistence via fade-fill; three-pass glow stroke; a six-frame delay
 * line powers the ghost harmonic's echo trace; a frequency ruler with a tuning
 * diamond runs along the bottom. Choir-teal on ink, per DESIGN.md. No per-frame
 * allocations (module/render-scoped scratch buffers only).
 */
import { useEffect, useRef } from 'react';
import { BAND_HI, BAND_LO, STATIONS, type RadioEngine } from './engine';

export interface ScopeProps {
  engine: RadioEngine | null;
  listening: boolean;
  /** 0..1 tuner lock strength */
  strength: number;
  freq: number;
}

const INK = 'rgba(20,16,31,'; // var(--space)
const TEAL = (a: number) => `rgba(87,196,184,${a})`;
const TEAL_PALE = (a: number) => `rgba(155,232,223,${a})`;
const AMBER = (a: number) => `rgba(255,180,84,${a})`;

const RING = 6;

function buildGrid(w: number, h: number, dpr: number): HTMLCanvasElement {
  const g = document.createElement('canvas');
  g.width = w;
  g.height = h;
  const c = g.getContext('2d');
  if (!c) return g;
  const ruler = 26 * dpr;
  const plotH = h - ruler;
  c.clearRect(0, 0, w, h);

  // graticule
  c.strokeStyle = 'rgba(46,140,140,0.14)';
  c.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const x = (w / 8) * i;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, plotH);
    c.stroke();
  }
  for (let i = 1; i < 6; i++) {
    const y = (plotH / 6) * i;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  // centre axes
  c.strokeStyle = 'rgba(87,196,184,0.30)';
  c.beginPath();
  c.moveTo(0, plotH / 2);
  c.lineTo(w, plotH / 2);
  c.stroke();
  c.strokeStyle = 'rgba(87,196,184,0.18)';
  c.beginPath();
  c.moveTo(w / 2, 0);
  c.lineTo(w / 2, plotH);
  c.stroke();

  // ruler strip
  c.fillStyle = 'rgba(9,7,16,0.55)';
  c.fillRect(0, plotH, w, ruler);
  c.strokeStyle = 'rgba(87,196,184,0.25)';
  c.beginPath();
  c.moveTo(0, plotH + 0.5);
  c.lineTo(w, plotH + 0.5);
  c.stroke();
  c.fillStyle = 'rgba(87,196,184,0.45)';
  c.font = `${9 * dpr}px "Chakra Petch", ui-sans-serif, system-ui, sans-serif`;
  c.textAlign = 'left';
  for (let mhz = BAND_LO; mhz <= BAND_HI; mhz += 4) {
    const x = ((mhz - BAND_LO) / (BAND_HI - BAND_LO)) * w;
    c.fillRect(x, plotH + 3 * dpr, Math.max(1, dpr * 0.5), 4 * dpr);
    c.fillText(String(mhz), x + 3 * dpr, plotH + 12 * dpr);
  }
  // station diamonds
  for (const s of STATIONS) {
    const x = ((s.freq - BAND_LO) / (BAND_HI - BAND_LO)) * w;
    const y = plotH + ruler * 0.62;
    const r = 3.4 * dpr;
    c.fillStyle = s.id === 'mother' ? AMBER(0.75) : TEAL(0.75);
    c.beginPath();
    c.moveTo(x, y - r);
    c.lineTo(x + r, y);
    c.lineTo(x, y + r);
    c.lineTo(x - r, y);
    c.closePath();
    c.fill();
  }
  return g;
}

export function Scope(props: ScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let grid: HTMLCanvasElement | null = null;
    const samples = new Float32Array(2048);
    const ring: Float32Array<ArrayBuffer>[] = [];
    for (let i = 0; i < RING; i++) ring.push(new Float32Array(2048));
    let ringPos = 0;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = cv.clientWidth;
      const ch = cv.clientHeight;
      if (cw === 0 || ch === 0) return;
      w = Math.floor(cw * dpr);
      h = Math.floor(ch * dpr);
      cv.width = w;
      cv.height = h;
      grid = buildGrid(w, h, dpr);
      ctx.fillStyle = INK + '1)';
      ctx.fillRect(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const stroke = (
      c: CanvasRenderingContext2D,
      data: Float32Array,
      scale: number,
      yOff: number,
      width: number,
      color: string,
    ) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const plotH = h - 26 * dpr;
      const mid = plotH / 2 + yOff;
      c.strokeStyle = color;
      c.lineWidth = width;
      c.lineJoin = 'round';
      c.beginPath();
      const n = data.length;
      for (let i = 0; i < n; i += 2) {
        const x = (i / (n - 2)) * w;
        const y = mid + data[i] * scale;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    };

    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      if (!w || !h) return;
      const { engine, listening, strength, freq } = propsRef.current;
      const t = ms / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const plotH = h - 26 * dpr;

      // phosphor fade — stronger signal holds the beam a touch longer
      ctx.fillStyle = INK + (0.22 - 0.1 * (listening ? strength : 0)).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
      if (grid) ctx.drawImage(grid, 0, 0);

      // acquire waveform
      if (engine && listening) {
        engine.read(samples);
      } else {
        for (let i = 0; i < 2048; i++) {
          samples[i] =
            0.05 * Math.sin(i * 0.011 + t * 1.3) +
            0.03 * Math.sin(i * 0.031 - t * 0.7) +
            0.05 * (Math.random() - 0.5);
        }
      }

      // ring-store for the ghost delay line
      ring[ringPos].set(samples);
      const ghostFrame = ring[(ringPos + 1) % RING]; // oldest ≈ 5 frames back
      ringPos = (ringPos + 1) % RING;

      const flicker = 0.93 + Math.random() * 0.07;
      const live = engine && listening;
      const baseScale = plotH * 0.36 * (live ? 0.45 + 0.55 * strength : 1);
      const glow = (live ? 0.55 + 0.45 * strength : 0.35) * flicker;

      // ghost echo trace (slightly compressed, vertically drifting)
      const gl = engine ? engine.ghostLevel : 0;
      if (live && gl > 0.03) {
        stroke(ctx, ghostFrame, baseScale * 0.58, plotH * 0.02 * Math.sin(t * 1.1), 2.2 * dpr, TEAL_PALE(gl * 0.4));
      }

      // main trace: wide halo, mid glow, hot core
      stroke(ctx, samples, baseScale, 0, 6.5 * dpr, TEAL(0.07 * glow));
      stroke(ctx, samples, baseScale, 0, 2.8 * dpr, TEAL(0.28 * glow));
      stroke(ctx, samples, baseScale, 0, 1.3 * dpr, TEAL(0.95 * glow));

      // tuning diamond on the ruler
      const rx = ((freq - BAND_LO) / (BAND_HI - BAND_LO)) * w;
      const ry = h - 26 * dpr + 26 * dpr * 0.62;
      const rr = (3.5 + strength * 2.2) * dpr;
      ctx.fillStyle = AMBER(0.55 + 0.45 * strength);
      ctx.beginPath();
      ctx.moveTo(rx, ry - rr);
      ctx.lineTo(rx + rr, ry);
      ctx.lineTo(rx, ry + rr);
      ctx.lineTo(rx - rr, ry);
      ctx.closePath();
      ctx.fill();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="rsv-canvas" aria-hidden="true" />
      <div className="rsv-scan" aria-hidden="true" />
      <div className="rsv-vignette" aria-hidden="true" />
    </>
  );
}

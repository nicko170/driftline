/**
 * Scope — the scrolling telemetry strip. Reads the shared ring buffer
 * (telemetry.ts) on an animation frame: speed (amber), lateral slip (rust),
 * boost meter (bone) and the drift reward window filling live (teal area,
 * resets when the reward banks). A bottom surface lane paints the ground
 * the bike was on per column — salt bone / sand ochre / glass teal — so the
 * slip spikes line up exactly with the painted zones under the wheels.
 * Canvas 2D, zero allocation per frame.
 */
import { useEffect, useRef } from 'react';
import { ring, RING } from './telemetry';

const AMBER = (a: number) => `rgba(255,180,84,${a})`;
const AMBER_HOT = (a: number) => `rgba(255,201,105,${a})`;
const RUST = (a: number) => `rgba(227,123,86,${a})`;
const BONE = (a: number) => `rgba(228,215,190,${a})`;
const TEAL = (a: number) => `rgba(87,196,184,${a})`;
const SAND = (a: number) => `rgba(217,164,91,${a})`;

const SURF_FILL = [BONE(0.5), SAND(0.75), TEAL(0.85)];

export default function Scope() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = cv.clientWidth;
      const ch = cv.clientHeight;
      if (cw === 0 || ch === 0) return;
      w = Math.floor(cw * dpr);
      h = Math.floor(ch * dpr);
      cv.width = w;
      cv.height = h;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!w || !h) return;

      const lane = 7 * dpr;
      const plotH = h - lane;
      ctx.clearRect(0, 0, w, h);

      const n = ring.len;
      if (n < 2) return;
      const x0 = w - n; // newest sample pinned to the right edge
      const xAt = (i: number) => x0 + (i / RING) * w;

      /* second grid (RING samples = 8 s at 60 fps) */
      ctx.strokeStyle = BONE(0.08);
      ctx.lineWidth = 1;
      for (let s = 1; s < RING / 60; s++) {
        const idx = (ring.head - s * 60 + RING * 2) % RING;
        if (idx >= n && ring.len < RING) continue;
        const order = ring.head - idx <= 0 ? ring.head - idx + n : ring.head - idx;
        const x = x0 + ((n - order) / RING) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotH);
        ctx.stroke();
      }

      /* trace helper — reads the ring oldest→newest into the plot */
      const trace = (
        data: Float32Array,
        max: number,
        color: string,
        width: number,
        fillBelow: string | null,
      ) => {
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const idx = (ring.head + RING - n + k) % RING;
          const x = x0 + (k / RING) * w;
          const y = plotH - Math.min(1, data[idx] / max) * (plotH - 2 * dpr) - dpr;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        if (fillBelow) {
          ctx.save();
          ctx.lineTo(x0 + ((n - 1) / RING) * w, plotH);
          ctx.lineTo(x0, plotH);
          ctx.closePath();
          ctx.fillStyle = fillBelow;
          ctx.fill();
          ctx.restore();
        }
        // replay the spine as a stroke (path was consumed by the fill)
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const idx = (ring.head + RING - n + k) % RING;
          const x = x0 + (k / RING) * w;
          const y = plotH - Math.min(1, data[idx] / max) * (plotH - 2 * dpr) - dpr;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.stroke();
      };

      /* boost meter first (backdrop reference line) */
      trace(ring.boost, 1, BONE(0.55), 1 * dpr, null);
      /* speed — amber master trace */
      trace(ring.speed, 70, AMBER(0.95), 1.8 * dpr, null);
      /* lateral slip — rust, spikes on glass */
      trace(ring.slip, 70, RUST(0.9), 1.3 * dpr, null);
      /* drift reward window — teal area filling 0→100 % */
      trace(ring.reward, 1, TEAL(0.9), 1.2 * dpr, TEAL(0.14));

      /* surface lane — the painted ground under each column */
      for (let k = 0; k < n; k++) {
        const idx = (ring.head + RING - n + k) % RING;
        ctx.fillStyle = SURF_FILL[ring.surf[idx]];
        const x = x0 + (k / RING) * w;
        ctx.fillRect(x, h - lane + dpr, Math.max(1, (w / RING) * dpr) + 0.5, lane - 2 * dpr);
      }
      ctx.strokeStyle = BONE(0.18);
      ctx.beginPath();
      ctx.moveTo(0, h - lane + 0.5);
      ctx.lineTo(w, h - lane + 0.5);
      ctx.stroke();

      /* "now" head mark */
      ctx.fillStyle = AMBER_HOT(0.9);
      ctx.fillRect(w - 2 * dpr, 0, 2 * dpr, plotH);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="hcl-scope-canvas" aria-hidden="true" />;
}

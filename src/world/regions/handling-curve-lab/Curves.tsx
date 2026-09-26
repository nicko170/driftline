/**
 * Ladder curves — the upgrade headroom graphs. Four small canvases redrawn
 * whenever the tuning store changes (sliders move the whole family live):
 *
 *  · engine    — top speed vs ladder level, cruise (amber) + boost ×1.38
 *  · handling  — steer rate (amber) + lateral grip scale (teal), 0→3
 *  · boost     — burst seconds to empty (amber) + refill seconds (teal)
 *  · drift     — exit kick vs drift time; dashed cap ×1.875, reward window
 *
 * Every ladder level 0–3 is a diamond pip; the fitted level is filled amber,
 * so stock-to-maxed headroom reads at a glance. Canvas 2D; no per-frame work
 * (redraws only on store change or resize).
 */
import { useEffect, useRef } from 'react';
import { useTuning, effective, type Ladders, type Tune } from './params';

const AMBER = (a: number) => `rgba(255,180,84,${a})`;
const AMBER_HOT = (a: number) => `rgba(255,201,105,${a})`;
const TEAL = (a: number) => `rgba(87,196,184,${a})`;
const BONE = (a: number) => `rgba(228,215,190,${a})`;
const RUST = (a: number) => `rgba(179,80,46,${a})`;

interface Ctx2 {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
}

function setup(cv: HTMLCanvasElement | null): Ctx2 | null {
  if (!cv) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = cv.clientWidth;
  const ch = cv.clientHeight;
  if (cw === 0 || ch === 0) return null;
  const w = Math.floor(cw * dpr);
  const h = Math.floor(ch * dpr);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, dpr };
}

function font(c: Ctx2, px = 9) {
  c.ctx.font = `${px * c.dpr}px "Chakra Petch", ui-sans-serif, system-ui, sans-serif`;
}

function levelGrid(c: Ctx2, padL: number, padR: number, plotH: number, padT: number) {
  const { ctx, w, dpr } = c;
  ctx.strokeStyle = BONE(0.09);
  ctx.fillStyle = BONE(0.4);
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  font(c, 8);
  for (let l = 0; l <= 3; l++) {
    const x = padL + (l / 3) * (w - padL - padR);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillText(String(l), x, padT + plotH + 9 * dpr);
  }
}

function levelX(c: Ctx2, padL: number, padR: number, lvl: number) {
  return padL + (lvl / 3) * (c.w - padL - padR);
}

interface Series {
  values: [number, number, number, number]; // v at level 0..3
  color: (a: number) => string;
  dashed?: boolean;
  label: (v: number) => string;
}

/** Polyline + pips over ladder levels, min/max-normalised per series. */
function ladderSeries(c: Ctx2, s: Series, active: number, padL: number, padR: number, plotH: number, padT: number) {
  const { ctx, dpr } = c;
  const lo = Math.min(...s.values);
  const hi = Math.max(...s.values);
  const span = hi - lo || 1;
  const y = (v: number) => padT + (1 - (v - lo) / span) * plotH;

  ctx.beginPath();
  for (let l = 0; l <= 3; l++) {
    const x = levelX(c, padL, padR, l);
    if (l === 0) ctx.moveTo(x, y(s.values[l]));
    else ctx.lineTo(x, y(s.values[l]));
  }
  ctx.strokeStyle = s.color(0.85);
  ctx.lineWidth = 1.6 * dpr;
  ctx.setLineDash(s.dashed ? [4 * dpr, 3 * dpr] : []);
  ctx.stroke();
  ctx.setLineDash([]);

  // end labels: stock … maxed
  ctx.textAlign = 'left';
  font(c, 8);
  ctx.fillStyle = s.color(0.75);
  ctx.fillText(s.label(s.values[3]), levelX(c, padL, padR, 3) + 5 * dpr, y(s.values[3]) + 3 * dpr);

  // level pips (diamonds; fitted level filled)
  for (let l = 0; l <= 3; l++) {
    const x = levelX(c, padL, padR, l);
    const py = y(s.values[l]);
    const r = (l === active ? 4 : 3) * dpr;
    ctx.beginPath();
    ctx.moveTo(x, py - r);
    ctx.lineTo(x + r, py);
    ctx.lineTo(x, py + r);
    ctx.lineTo(x - r, py);
    ctx.closePath();
    if (l === active) {
      ctx.fillStyle = AMBER_HOT(0.95);
      ctx.fill();
    } else {
      ctx.strokeStyle = s.color(0.8);
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();
    }
  }
}

/* ------------------------------- the four graphs ------------------------------- */

function drawEngine(cv: HTMLCanvasElement | null, p: Tune, l: Ladders) {
  const c = setup(cv);
  if (!c) return;
  const padL = 10 * c.dpr;
  const padR = 46 * c.dpr;
  const padT = 6 * c.dpr;
  const plotH = c.h - padT - 16 * c.dpr;
  levelGrid(c, padL, padR, plotH, padT);
  const cruise = [0, 1, 2, 3].map((k) => p.vMax + k * 3.5) as Series['values'];
  const boost = cruise.map((v) => v * 1.38) as Series['values'];
  ladderSeries(c, { values: cruise, color: AMBER, label: (v) => `${Math.round(v * 3.6)} km/h` }, l.engine, padL, padR, plotH, padT);
  ladderSeries(c, { values: boost, color: AMBER_HOT, dashed: true, label: (v) => `${Math.round(v * 3.6)}` }, l.engine, padL, padR, plotH, padT);
  c.ctx.textAlign = 'left';
  font(c, 8);
  c.ctx.fillStyle = BONE(0.5);
  c.ctx.fillText('top speed · dashed = boosting', padL, padT + 8 * c.dpr);
}

function drawHandling(cv: HTMLCanvasElement | null, p: Tune, l: Ladders) {
  const c = setup(cv);
  if (!c) return;
  const padL = 10 * c.dpr;
  const padR = 46 * c.dpr;
  const padT = 6 * c.dpr;
  const plotH = c.h - padT - 16 * c.dpr;
  levelGrid(c, padL, padR, plotH, padT);
  void p;
  const steer = [0, 1, 2, 3].map((k) => 1.9 + k * 0.22) as Series['values'];
  const gripS = [0, 1, 2, 3].map((k) => 9 + k * 1.6) as Series['values'];
  ladderSeries(c, { values: steer, color: AMBER, label: (v) => `${v.toFixed(2)} rad/s` }, l.handling, padL, padR, plotH, padT);
  ladderSeries(c, { values: gripS, color: TEAL, label: (v) => `${v.toFixed(1)} grip` }, l.handling, padL, padR, plotH, padT);
  c.ctx.textAlign = 'left';
  font(c, 8);
  c.ctx.fillStyle = BONE(0.5);
  c.ctx.fillText('steer amber · grip scale teal (each self-scaled)', padL, padT + 8 * c.dpr);
}

function drawBoost(cv: HTMLCanvasElement | null, p: Tune, l: Ladders) {
  const c = setup(cv);
  if (!c) return;
  const padL = 10 * c.dpr;
  const padR = 40 * c.dpr;
  const padT = 6 * c.dpr;
  const plotH = c.h - padT - 16 * c.dpr;
  levelGrid(c, padL, padR, plotH, padT);
  const burst = [0, 1, 2, 3].map((k) => 1 / Math.max(0.05, p.boostDrain - k * 0.035)) as Series['values'];
  const refill = [0, 1, 2, 3].map((k) => 1 / (p.boostRegen + k * 0.02)) as Series['values'];
  ladderSeries(c, { values: burst, color: AMBER, label: (v) => `${v.toFixed(1)}s` }, l.boost, padL, padR, plotH, padT);
  ladderSeries(c, { values: refill, color: TEAL, label: (v) => `${v.toFixed(1)}s` }, l.boost, padL, padR, plotH, padT);
  c.ctx.textAlign = 'left';
  font(c, 8);
  c.ctx.fillStyle = BONE(0.5);
  c.ctx.fillText('burst →empty amber · refill →full teal', padL, padT + 8 * c.dpr);
}

function drawDrift(cv: HTMLCanvasElement | null, p: Tune, l: Ladders) {
  const c = setup(cv);
  if (!c) return;
  const { ctx, w, dpr } = c;
  void l;
  const padL = 10 * dpr;
  const padR = 44 * dpr;
  const padT = 6 * dpr;
  const plotH = c.h - padT - 16 * dpr;
  const T_MAX = 4.5;
  const kickMax = Math.max(p.driftKick * 1.9, 2);
  const tx = (t: number) => padL + (t / T_MAX) * (w - padL - padR);
  const ty = (k: number) => padT + (1 - Math.min(1, k / kickMax)) * plotH;

  // axis + seconds grid
  ctx.strokeStyle = BONE(0.09);
  ctx.fillStyle = BONE(0.4);
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  font(c, 8);
  for (let s = 0; s <= 4; s++) {
    ctx.beginPath();
    ctx.moveTo(tx(s), padT);
    ctx.lineTo(tx(s), padT + plotH);
    ctx.stroke();
    ctx.fillText(`${s}s`, tx(s), padT + plotH + 9 * dpr);
  }

  // boost-reward window: 0 → 3.5 s (shipping min(0.35, t·0.1))
  ctx.fillStyle = AMBER(0.07);
  ctx.fillRect(tx(0), padT, tx(3.5) - tx(0), plotH);
  ctx.strokeStyle = AMBER(0.35);
  ctx.setLineDash([3 * dpr, 3 * dpr]);
  ctx.beginPath();
  ctx.moveTo(tx(3.5), padT);
  ctx.lineTo(tx(3.5), padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // kick curve: slope = driftKick, capped at ×1.875
  ctx.beginPath();
  for (let t = 0; t <= T_MAX; t += 0.1) {
    const kick = Math.min(p.driftKick * 1.875, t * p.driftKick);
    if (t === 0) ctx.moveTo(tx(t), ty(kick));
    else ctx.lineTo(tx(t), ty(kick));
  }
  ctx.strokeStyle = AMBER_HOT(0.95);
  ctx.lineWidth = 1.8 * dpr;
  ctx.stroke();

  // cap line
  ctx.strokeStyle = RUST(0.7);
  ctx.setLineDash([5 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(padL, ty(p.driftKick * 1.875));
  ctx.lineTo(w - padR, ty(p.driftKick * 1.875));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'right';
  font(c, 8);
  ctx.fillStyle = RUST(0.85);
  ctx.fillText(`cap ${(p.driftKick * 1.875).toFixed(1)} m/s`, w - 4 * dpr, ty(p.driftKick * 1.875) - 3 * dpr);
  ctx.fillStyle = AMBER(0.55);
  ctx.textAlign = 'left';
  ctx.fillText('shaded = boost-reward window', padL + 3 * dpr, padT + 8 * dpr);
}

/* --------------------------------- component --------------------------------- */

function Graph({ title, draw }: { title: string; draw: (cv: HTMLCanvasElement | null, p: Tune, l: Ladders) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const run = () => {
      const s = useTuning.getState();
      drawRef.current(ref.current, s.params, s.ladders);
    };
    run();
    const unsub = useTuning.subscribe(run);
    const cv = ref.current;
    const ro = new ResizeObserver(run);
    if (cv) ro.observe(cv);
    // redraw once webfonts land so labels use Chakra Petch
    void document.fonts?.ready.then(run);
    return () => {
      unsub();
      ro.disconnect();
    };
  }, []);

  return (
    <figure className="hcl-graph">
      <canvas ref={ref} aria-label={title} role="img" />
      <figcaption>{title}</figcaption>
    </figure>
  );
}

export default function LadderCurves() {
  return (
    <div className="hcl-curves">
      <Graph title="Engine ladder — top speed" draw={drawEngine} />
      <Graph title="Handling ladder — steer · grip" draw={drawHandling} />
      <Graph title="Boost ladder — burst · refill" draw={drawBoost} />
      <Graph title="Drift reward — kick vs time" draw={drawDrift} />
    </div>
  );
}

/* ---------- effective readout line used by the panel header ---------- */

export function effectiveLine(p: Tune, l: Ladders): string {
  const e = effective(p, l);
  return (
    `accel ${e.accel.toFixed(1)} · vmax ${e.vMax.toFixed(1)} · steer ${e.steer.toFixed(2)} · ` +
    `grip ${e.gripScale.toFixed(1)} · drain ${e.drain.toFixed(3)} · regen ${e.regen.toFixed(3)}`
  );
}

/**
 * The ledger figures — Guild ledger-sheet styling: salt paper, ochre rules,
 * amber-hot knees, tabular numerals. Canvas-2D (dpr-aware, redrawn on pip or
 * ladder change via ResizeObserver+effect); every number comes from
 * physics.ts, which mirrors src/game/Bike.tsx.
 */
import React, { useEffect, useRef } from 'react';
import {
  PHYS, STOCK, KMH, TAPE_S, BOOST_ON_T,
  runLaunch, terminalMs, boostHoldS, boostRefillS,
  kickOf, refundOf, levelCost, levelCosts, maxLevel,
  type Ladder, type Pips, type Run,
} from './physics';

/* ------------------------------------------------------------ palette */

const INK = '#241D38';
const INK_SOFT = 'rgba(36,29,56,0.55)';
const INK_GHOST = 'rgba(36,29,56,0.35)';
const GRID = 'rgba(36,29,56,0.10)';
const OCHRE = '#B07C3A';
const OCHRE_TXT = '#8A5F2B';
const RUST = '#B3502E';
const RUST_DEEP = '#7E3320';
const AMBER = '#FFC969';
const AMBER_TXT = '#A8660F';
const TEAL = '#2E8C8C';

const ML = 48;
const MR = 16;
const MT = 16;
const MB = 26;
const bounds = (w: number, h: number) => ({ x0: ML, y0: MT, x1: w - MR, y1: h - MB });
type Bounds = ReturnType<typeof bounds>;

type Ctx = CanvasRenderingContext2D;

function prep(cv: HTMLCanvasElement): { ctx: Ctx; w: number; h: number } | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (w < 8 || h < 8) return null;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (cv.width !== pw || cv.height !== ph) {
    cv.width = pw;
    cv.height = ph;
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/* ------------------------------------------------------------ helpers */

function line(ctx: Ctx, pts: [number, number][], stroke: string, width = 1.5, dash: number[] = []) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

function dot(ctx: Ctx, x: number, y: number, r = 3.4, fill = AMBER) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = RUST_DEEP;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function txt(ctx: Ctx, s: string, x: number, y: number, color = INK, align: CanvasTextAlign = 'left', size = 10) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px "Chakra Petch", ui-sans-serif, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** ochre plot frame + gridlines + tick labels */
function frame(
  ctx: Ctx, b: Bounds,
  xTicks: { v: number; label: string }[], yTicks: { v: number; label: string }[],
  xf: (v: number) => number, yf: (v: number) => number,
) {
  ctx.save();
  for (const t of yTicks) {
    line(ctx, [[b.x0, yf(t.v)], [b.x1, yf(t.v)]], GRID, 1);
    txt(ctx, t.label, b.x0 - 7, yf(t.v), INK_SOFT, 'right', 9.5);
  }
  for (const t of xTicks) {
    line(ctx, [[xf(t.v), b.y1], [xf(t.v), b.y1 + 5]], OCHRE, 1);
    txt(ctx, t.label, xf(t.v), b.y1 + 13, INK_SOFT, 'center', 9.5);
  }
  line(ctx, [[b.x0, b.y0 - 4], [b.x0, b.y1]], OCHRE, 1.2);
  line(ctx, [[b.x0, b.y1], [b.x1, b.y1]], OCHRE, 1.2);
  ctx.restore();
}

/* --------------------------------------------------------- FIG 1 launch */

function drawLaunch(ctx: Ctx, w: number, h: number, pips: Pips) {
  const curB = runLaunch(pips, true);
  const curC = runLaunch(pips, false);
  const gB = runLaunch(STOCK, true);
  const gC = runLaunch(STOCK, false);
  let peak = 0;
  for (const r of [curB, curC, gB, gC]) for (const s of r.samples) peak = Math.max(peak, s.v * KMH);
  const yMax = Math.max(115, Math.ceil((peak * 1.08) / 10) * 10);
  const b = bounds(w, h);
  const X = (t: number) => b.x0 + (t / TAPE_S) * (b.x1 - b.x0);
  const Y = (kmh: number) => b.y1 - (kmh / yMax) * (b.y1 - b.y0);

  // boost window band for the current fit
  const boostOffT = BOOST_ON_T + boostHoldS(pips.boost);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 180, 84, 0.12)';
  ctx.fillRect(X(BOOST_ON_T), b.y0, X(Math.min(boostOffT, TAPE_S)) - X(BOOST_ON_T), b.y1 - b.y0);
  ctx.restore();

  frame(ctx, b, [0, 2, 4, 6, 8].map((t) => ({ v: t, label: `${t}s` })),
    Array.from({ length: Math.floor(yMax / 40) + 1 }, (_, i) => ({ v: i * 40, label: `${i * 40}` })), X, Y);

  // the hundred line
  line(ctx, [[b.x0, Y(100)], [b.x1, Y(100)]], OCHRE_TXT, 1, [5, 4]);
  txt(ctx, '100', b.x1 - 4, Y(100) - 9, OCHRE_TXT, 'right', 9.5);

  const poly = (r: Run) => r.samples.map((s) => [X(s.t), Y(s.v * KMH)] as [number, number]);
  line(ctx, poly(gC), INK_GHOST, 1.2, [3, 4]);
  line(ctx, poly(gB), INK_SOFT, 1.4, [6, 4]);
  line(ctx, poly(curC), INK, 1.7);
  line(ctx, poly(curB), RUST, 2.4);

  if (curB.t100 !== null) {
    dot(ctx, X(curB.t100), Y(100));
    txt(ctx, `0→100 · ${curB.t100.toFixed(2)} s`, Math.min(X(curB.t100) + 8, b.x1 - 86), Y(100) - 12, RUST_DEEP);
  } else {
    txt(ctx, `never — tops out at ${Math.round(terminalMs(pips.engine, false) * KMH)} km/h throttle-only`,
      b.x0 + 10, b.y0 + 10, RUST_DEEP, 'left', 10);
  }
  if (gB.t100 !== null) {
    dot(ctx, X(gB.t100), Y(100), 2.6, '#E4D7BE');
    txt(ctx, `stock ${gB.t100.toFixed(2)} s`, Math.min(X(gB.t100) + 8, b.x1 - 66), Y(100) + 15, INK_SOFT);
  }
}

/* ----------------------------------------------------- FIG 2 boost loop */

function drawBoost(ctx: Ctx, w: number, h: number, pips: Pips, ladder: Ladder) {
  const L = maxLevel(ladder);
  let xMax = 0;
  for (let l = 0; l <= L; l++) xMax = Math.max(xMax, boostHoldS(l) + boostRefillS(l));
  xMax = Math.ceil(xMax * 1.06);
  const b = bounds(w, h);
  const X = (t: number) => b.x0 + (t / xMax) * (b.x1 - b.x0);
  const Y = (m: number) => b.y1 - (m / 100) * (b.y1 - b.y0);

  frame(ctx, b,
    Array.from({ length: Math.floor(xMax / 4) + 1 }, (_, i) => ({ v: i * 4, label: `${i * 4}s` })),
    [0, 25, 50, 75, 100].map((m) => ({ v: m, label: `${m}%` })), X, Y);

  for (let l = 0; l <= L; l++) {
    const hold = boostHoldS(l);
    const refill = boostRefillS(l);
    const pts: [number, number][] = [[X(0), Y(100)], [X(hold), Y(PHYS.boostMin * 100)], [X(hold + refill), Y(100)]];
    if (l === pips.boost) continue;
    line(ctx, pts, l > 3 ? 'rgba(46,140,140,0.5)' : INK_GHOST, 1.1, l > 3 ? [2, 3] : l % 2 ? [] : [3, 4]);
    txt(ctx, `L${l}`, pts[1][0] - 4, pts[1][1] + 12, l > 3 ? TEAL : INK_SOFT, 'right', 9);
  }
  // selected level, bold amber
  const hold = boostHoldS(pips.boost);
  const refill = boostRefillS(pips.boost);
  line(ctx, [[X(0), Y(100)], [X(hold), Y(PHYS.boostMin * 100)], [X(hold + refill), Y(100)]], AMBER_TXT, 2.6);
  dot(ctx, X(hold), Y(PHYS.boostMin * 100));
  dot(ctx, X(hold + refill), Y(100));
  txt(ctx, `dry ${hold.toFixed(1)} s`, X(hold) + 8, Y(PHYS.boostMin * 100) - 2, RUST_DEEP);
  txt(ctx, `full ${refill.toFixed(1)} s`, Math.min(X(hold + refill) - 8, b.x1 - 6), Y(100) - 11, RUST_DEEP, 'right');
  txt(ctx, `duty ${(boostDutyPct(pips.boost)).toFixed(0)}% of any stretch boostable`,
    b.x0 + 8, b.y0 + 10, AMBER_TXT, 'left', 10.5);
}

function boostDutyPct(level: number) {
  const hold = boostHoldS(level);
  return (hold / (hold + boostRefillS(level))) * 100;
}

/* ------------------------------------------------- FIG 3 drift-exit kick */

function drawKick(ctx: Ctx, w: number, h: number) {
  const xMax = 4;
  const b = bounds(w, h);
  const X = (t: number) => b.x0 + (t / xMax) * (b.x1 - b.x0);
  const Y = (k: number) => b.y1 - (k / 5) * (b.y1 - b.y0);
  const Y2 = (m: number) => b.y1 - (m / 0.35) * (b.y1 - b.y0);

  frame(ctx, b,
    [0, 1, 2, 3, 4].map((t) => ({ v: t, label: `${t}s` })),
    [0, 1.25, 2.5, 3.75, 5].map((v) => ({ v, label: v.toFixed(v % 1 ? 2 : 0) })), X, Y);
  txt(ctx, 'kick impulse →', ML - 42, MT - 8, INK_SOFT, 'left', 9);

  ctx.save();
  ctx.fillStyle = 'rgba(46,140,140,0.07)';
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.restore();

  // drift hold curve
  const pts: [number, number][] = [];
  for (let t = 0; t <= xMax; t += 0.05) pts.push([X(t), Y(kickOf(t))]);
  line(ctx, pts, RUST, 2.4);
  line(ctx, [[b.x0, Y(PHYS.kickCap)], [b.x1, Y(PHYS.kickCap)]], OCHRE_TXT, 1, [5, 4]);
  dot(ctx, X(PHYS.kickCap / PHYS.kickPerS), Y(PHYS.kickCap));
  txt(ctx, `caps at ${PHYS.kickCap} · ${(PHYS.kickCap / PHYS.kickPerS).toFixed(2)} s held`, X(2.0), Y(PHYS.kickCap) - 11, RUST_DEEP);

  // meter refund (right axis)
  const pts2: [number, number][] = [];
  for (let t = 0; t <= xMax; t += 0.05) pts2.push([X(t), Y2(refundOf(t))]);
  line(ctx, pts2, TEAL, 1.8, [6, 4]);
  dot(ctx, X(PHYS.refundCap / PHYS.refundPerS), Y2(PHYS.refundCap), 2.8, '#9ADBD4');
  txt(ctx, 'meter refund 0.35 @ 3.5 s', b.x1 - 4, Y2(0.35) - 10, TEAL, 'right', 9.5);

  txt(ctx, 'NOTHING HERE COSTS A CREDIT — kick & refund are pip-independent in the shipped build.',
    (b.x0 + b.x1) / 2, b.y1 - 12, TEAL, 'center', 9.5);
}

/* ---------------------------------------------- FIG 4 top speed / level */

function drawTopSpeed(ctx: Ctx, w: number, h: number, pips: Pips, ladder: Ladder) {
  const L = maxLevel(ladder);
  const vals: { th: number; bo: number }[] = [];
  for (let l = 0; l <= L; l++) vals.push({ th: terminalMs(l, false) * KMH, bo: terminalMs(l, true) * KMH });
  const yMax = Math.ceil((Math.max(...vals.map((v) => v.bo)) * 1.14) / 20) * 20;
  const b = bounds(w, h);
  const Y = (kmh: number) => b.y1 - (kmh / yMax) * (b.y1 - b.y0);
  const groupW = (b.x1 - b.x0) / (L + 1);
  const barW = Math.min(26, groupW * 0.3);

  frame(ctx, b, [], Array.from({ length: Math.floor(yMax / 40) + 1 }, (_, i) => ({ v: i * 40, label: `${i * 40}` })), (v: number) => b.x0 + v, Y);
  line(ctx, [[b.x0, Y(100)], [b.x1, Y(100)]], OCHRE_TXT, 1, [5, 4]);
  txt(ctx, '100', b.x1 - 4, Y(100) - 9, OCHRE_TXT, 'right', 9.5);

  for (let l = 0; l <= L; l++) {
    const cx = b.x0 + groupW * (l + 0.5);
    const dream = l > 3;
    // throttle bar
    ctx.save();
    ctx.globalAlpha = dream ? 0.55 : 1;
    ctx.fillStyle = l === pips.engine ? 'rgba(176,124,58,0.9)' : 'rgba(176,124,58,0.45)';
    ctx.fillRect(cx - barW - 2, Y(vals[l].th), barW, b.y1 - Y(vals[l].th));
    // boosted bar
    ctx.fillStyle = l === pips.engine ? AMBER : 'rgba(255,180,84,0.72)';
    ctx.fillRect(cx + 2, Y(vals[l].bo), barW, b.y1 - Y(vals[l].bo));
    ctx.strokeStyle = RUST_DEEP;
    ctx.lineWidth = 1;
    if (dream) ctx.setLineDash([3, 3]);
    ctx.strokeRect(cx - barW - 2, Y(vals[l].th), barW, b.y1 - Y(vals[l].th));
    ctx.strokeRect(cx + 2, Y(vals[l].bo), barW, b.y1 - Y(vals[l].bo));
    ctx.setLineDash([]);
    // selected ring
    if (l === pips.engine) {
      ctx.strokeStyle = RUST;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(cx - barW - 7, Y(vals[l].bo) - 7, barW * 2 + 14, b.y1 - Y(vals[l].bo) + 7);
      dot(ctx, cx + 2 + barW / 2, Y(vals[l].bo) - 11, 3);
    }
    ctx.restore();
    txt(ctx, `${Math.round(vals[l].bo)}`, cx + 2 + barW / 2, Y(vals[l].bo) - (l === pips.engine ? 22 : 8), INK, 'center', 9.5);
    txt(ctx, `L${l}`, cx, b.y1 + 11, dream ? TEAL : INK, 'center', 9.5);
    txt(ctx, l === 0 ? 'stock' : `${levelCost(ladder, l).toLocaleString()} cr`, cx, b.y1 + 22, INK_SOFT, 'center', 8.5);
  }
  txt(ctx, 'ochre ▮ throttle-only · amber ▮ boost-held terminal', b.x0 + 8, b.y0 + 10, INK_SOFT, 'left', 9.5);
}

/* --------------------------------------------------- FIG 5 cost / level */

function drawCost(ctx: Ctx, w: number, h: number, pips: Pips, ladder: Ladder, avgCr: number) {
  const parts: { key: keyof Pips; name: string }[] = [
    { key: 'engine', name: 'engine coils' },
    { key: 'handling', name: 'gyro cage' },
    { key: 'boost', name: 'boost cell' },
  ];
  const costs = levelCosts(ladder);
  const stackMax = costs.reduce((a, b) => a + b, 0);
  const yMax = stackMax * 1.1;
  const b = bounds(w, h);
  const Y = (cr: number) => b.y1 - (cr / yMax) * (b.y1 - b.y0);
  const groupW = (b.x1 - b.x0) / parts.length;

  frame(ctx, b, [],
    Array.from({ length: 6 }, (_, i) => Math.round((yMax / 5) * i)).map((v) => ({ v, label: v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}` })),
    (v: number) => b.x0 + v, Y);

  parts.forEach((p, gi) => {
    const cx = b.x0 + groupW * (gi + 0.5);
    const wBar = Math.min(64, groupW * 0.52);
    let acc = 0;
    costs.forEach((c, i) => {
      const lvl = i + 1;
      const owned = pips[p.key] >= lvl;
      const dream = lvl > 3;
      const y0 = Y(acc);
      const y1 = Y(acc + c);
      ctx.save();
      if (owned) {
        ctx.fillStyle = dream ? 'rgba(255,180,84,0.55)' : 'rgba(176,124,58,0.88)';
        if (!dream && lvl === costs.length) ctx.fillStyle = 'rgba(179,80,46,0.9)';
      } else {
        ctx.fillStyle = 'rgba(36,29,56,0.05)';
      }
      if (dream) ctx.globalAlpha = owned ? 0.8 : 0.4;
      ctx.fillRect(cx - wBar / 2, y1, wBar, y0 - y1);
      ctx.strokeStyle = dream ? TEAL : RUST_DEEP;
      ctx.lineWidth = 1;
      if (!owned || dream) ctx.setLineDash([3, 3]);
      ctx.strokeRect(cx - wBar / 2, y1, wBar, y0 - y1);
      ctx.setLineDash([]);
      ctx.restore();
      // cost tag inside the segment
      const segH = y0 - y1;
      if (segH > 14) {
        txt(ctx, `${c.toLocaleString()}`, cx - wBar / 2 - 6, (y0 + y1) / 2, owned ? INK : INK_SOFT, 'right', 9);
      }
    });
    const sunk = costs.slice(0, pips[p.key]).reduce((a, c) => a + c, 0);
    txt(ctx, `${p.name}`, cx, b.y1 + 11, INK, 'center', 10);
    txt(ctx, `${sunk.toLocaleString()} sunk`, cx, b.y1 + 22, pips[p.key] > 0 ? OCHRE_TXT : INK_SOFT, 'center', 8.5);
    if (pips[p.key] > 0) dot(ctx, cx + wBar / 2 + 7, Y(sunk), 2.6);
  });
  txt(ctx, `one delivery averages ~${avgCr} cr — level 1 is ~${(400 / avgCr).toFixed(1)} runs, the cap step ${(levelCost(ladder, Math.min(maxLevel(ladder), 5)) / avgCr).toFixed(1)}`,
    b.x0 + 8, b.y0 + 10, INK_SOFT, 'left', 9.5);
}

/* ------------------------------------------------------------ Figure */

interface FigureProps {
  n: string;
  title: string;
  aria: string;
  draw: (ctx: Ctx, w: number, h: number) => void;
  deps: unknown[];
  legend?: React.ReactNode;
  foot?: React.ReactNode;
  wide?: boolean;
  tall?: boolean;
}

export function Figure({ n, title, aria, draw, deps, legend, foot, wide, tall }: FigureProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const render = () => {
      const s = prep(el);
      if (s) draw(s.ctx, s.w, s.h);
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(el);
    return () => ro.disconnect();
    // redraw contract: callers pass every input through deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <figure className={`ucs-fig${wide ? ' ucs-fig-wide' : ''}`}>
      <figcaption className="ucs-fig-head">
        <span className="ucs-fig-no">FIG. {n}</span>
        <h3>{title}</h3>
      </figcaption>
      <canvas ref={cv} className={`ucs-fig-canvas${tall ? ' tall' : ''}`} role="img" aria-label={aria} />
      {legend && <div className="ucs-fig-legend">{legend}</div>}
      {foot && <p className="ucs-fig-foot">{foot}</p>}
    </figure>
  );
}

export function Swatch({ kind, label }: { kind: 'rust' | 'ink' | 'ghost' | 'faint' | 'teal' | 'amber' | 'paperdot'; label: string }) {
  return (
    <span className="ucs-sw">
      <i className={`ucs-sw-${kind}`} aria-hidden />
      {label}
    </span>
  );
}

/* ---------------------------------------------------- figure assembly */

export function LedgerFigures({ pips, ladder, avgCr }: { pips: Pips; ladder: Ladder; avgCr: number }) {
  return (
    <div className="ucs-figs">
      <Figure
        n="01" title="The launch — speed against tape" wide tall
        aria="Speed versus time over a nine second scripted launch, current fit versus stock, with and without boost."
        deps={[pips]}
        legend={<>
          <Swatch kind="rust" label="current · boost tape" />
          <Swatch kind="ink" label="current · throttle only" />
          <Swatch kind="ghost" label="stock · boost tape" />
          <Swatch kind="faint" label="stock · throttle only" />
        </>}
        foot={<>Flat salt pan drag model, throttle pinned, boost held from {BOOST_ON_T}s until the tank runs dry — the amber band. Watch the stock curve sag when its tank empties.</>}
        draw={(ctx, w, h) => drawLaunch(ctx, w, h, pips)}
      />
      <Figure
        n="02" title="Boost cell — tank dry & refill"
        aria="Boost meter over time for each boost-cell level: drain while held, then refill."
        deps={[pips.boost, ladder]}
        legend={<>
          <Swatch kind="amber" label={`level ${pips.boost} (selected)`} />
          <Swatch kind="ghost" label="other shipped levels" />
          {ladder === 'dream' && <Swatch kind="teal" label="dream levels 4–5" />}
        </>}
        foot={<>drain {PHYS.drainBase}−{PHYS.drainPerBoost}×level per s · regen {PHYS.regenBase}+{PHYS.regenPerBoost}×level per s (+{PHYS.regenAirBonus} airborne). Boost lives below {Math.round(PHYS.boostMin * 100)}%.</>}
        draw={(ctx, w, h) => drawBoost(ctx, w, h, pips, ladder)}
      />
      <Figure
        n="03" title="Drift-exit — kick & refund"
        aria="Drift exit impulse and boost-meter refund against drift hold time; identical at every upgrade level."
        deps={[]}
        legend={<>
          <Swatch kind="rust" label="kick impulse" />
          <Swatch kind="teal" label="meter refund" />
        </>}
        foot={<>Skill pays here, not credits. If handling is to matter at the exit, hook the cap (4.5) or the per-second rate (2.4) to a pip.</>}
        draw={(ctx, w, h) => drawKick(ctx, w, h)}
      />
      <Figure
        n="04" title="Top speed per coil level"
        aria="Terminal speed bars per engine level, throttle-only and boost-held, with entry cost per level."
        deps={[pips.engine, ladder]}
        legend={<>
          <Swatch kind="paperdot" label="ochre · throttle terminal" />
          <Swatch kind="amber" label="amber · boost terminal" />
        </>}
        foot={<>Terminal = thrust curve meeting rolling drag (A/(A/V+0.55)). Note who breaks 100 km/h unboosted: nobody on the shipped ladder — dream L4 is the first.</>}
        draw={(ctx, w, h) => drawTopSpeed(ctx, w, h, pips, ladder)}
      />
      <Figure
        n="05" title="What it costs — credit ladder per part"
        aria="Stacked cost of each upgrade level for engine, handling and boost; owned levels filled."
        deps={[pips, ladder]}
        legend={<>
          <Swatch kind="paperdot" label="owned" />
          <Swatch kind="faint" label="not yet bought" />
          {ladder === 'dream' && <Swatch kind="teal" label="dream steps · ×2 cost" />}
        </>}
        foot={<>Shipped ladder [{levelCosts('shipped').join(', ')}] cr per part. A full line is 3,100 cr ≈ {(3100 / avgCr).toFixed(0)} deliveries at the current board average.</>}
        draw={(ctx, w, h) => drawCost(ctx, w, h, pips, ladder, avgCr)}
      />
    </div>
  );
}

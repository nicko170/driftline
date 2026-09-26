/**
 * Rep Ledger Bench — the completionist journey. Four cumulative sparklines,
 * one per faction, walked mission by mission in posted order (story chapters
 * 1→5, then the side board). Tier bands run behind the curves so you can read
 * the exact mission where a standing crosses a rail — chapter-end pips carry
 * the faction glyph, and the right gutter lands the final standings tabular.
 */
import { useRef } from 'react';
import { C, FONT_B, FONT_D, rgba, useChart } from './chart';
import { CHART_MAX, FACTIONS, JOURNEY, ROWS, TIERS, tierFor } from './data';

const H = 288;
const TM = 26;
const BM = 20;
const L_GUTTER = 14;
const R_GUTTER = 150;

export function JourneyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useChart(canvasRef, H, (ctx, w) => {
    const x0 = L_GUTTER;
    const x1 = w - R_GUTTER;
    const n = ROWS.length;
    const X = (i: number) => x0 + (i / Math.max(1, n - 1)) * (x1 - x0);
    const baseY = H - BM;
    const plotH = baseY - TM;
    const Y = (v: number) => baseY - (v / CHART_MAX) * plotH;

    ctx.clearRect(0, 0, w, H);

    // ---- tier bands ---------------------------------------------------------
    const bands = TIERS.filter((t) => t.id !== 'hostile');
    bands.forEach((t, i) => {
      const ya = Y(t.until == null ? CHART_MAX : Math.min(t.until, CHART_MAX));
      const yb = Y(Math.max(0, t.min));
      ctx.fillStyle = rgba(t.color, i % 2 ? 0.05 : 0.085);
      ctx.fillRect(x0, ya, x1 - x0, yb - ya);
      ctx.font = `600 9.5px ${FONT_D}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = rgba(t.color, 0.75);
      ctx.fillText(`${t.glyph} ${t.label}`, x0 + 6, ya + 4);
    });
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = rgba(C.sand, 0.32);
    ctx.lineWidth = 1;
    for (const t of bands) {
      if (t.min <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(x0, Y(t.min));
      ctx.lineTo(x1, Y(t.min));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ---- side-board zone + chapter separators --------------------------------
    const sideStart = ROWS.findIndex((r) => !r.story);
    if (sideStart >= 0) {
      ctx.fillStyle = rgba(C.bone, 0.03);
      ctx.fillRect(X(sideStart), TM, x1 - X(sideStart), plotH);
    }
    ctx.font = `600 9px ${FONT_D}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 1; i < JOURNEY.marks.length; i++) {
      const prevEnd = JOURNEY.marks[i - 1].index;
      const x = X(prevEnd + 1);
      ctx.strokeStyle = rgba(C.bone, 0.22);
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, TM);
      ctx.lineTo(x, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = rgba(C.bone, 0.6);
      ctx.fillText(JOURNEY.marks[i].label, x + 12, baseY + 6);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = rgba(C.bone, 0.6);
    ctx.fillText(JOURNEY.marks[0]?.label ?? '', X(0) + 4, baseY + 6);

    // ---- the four journeys ----------------------------------------------------
    FACTIONS.forEach((f) => {
      const pts = JOURNEY.lines[f.id];
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = X(i);
        const y = Y(pts[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(f.color, 0.9);
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // chapter-end pips: glyph marker at each chapter's last mission
      ctx.font = `400 10.5px ${FONT_B}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const m of JOURNEY.marks) {
        const x = X(m.index);
        const y = Y(pts[m.index]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = rgba(C.space, 0.9);
        ctx.strokeText(f.glyph, x, y);
        ctx.fillStyle = rgba(f.color, 0.95);
        ctx.fillText(f.glyph, x, y);
      }
    });

    // ---- final standings, right gutter -----------------------------------------
    const ends = FACTIONS.map((f) => ({ f, v: JOURNEY.lines[f.id][n - 1] })).sort((a, b) => b.v - a.v);
    ctx.textAlign = 'left';
    // assign label slots top-down with minimum separation
    const slots: number[] = [];
    ends.forEach(({ v }) => {
      let y = Y(v);
      if (slots.length && y < slots[slots.length - 1] + 16) y = slots[slots.length - 1] + 16;
      slots.push(y);
    });
    ends.forEach(({ f, v }, k) => {
      const y = slots[k];
      const tier = tierFor(v);
      // elbow from curve end to label
      const yEnd = Y(v);
      ctx.strokeStyle = rgba(f.color, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1 + 2, yEnd);
      ctx.lineTo(x1 + 10, y);
      ctx.stroke();
      ctx.font = `400 11px ${FONT_B}`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(f.color, 0.95);
      ctx.fillText(f.glyph, x1 + 14, y);
      ctx.font = `700 12px ${FONT_D}`;
      ctx.fillStyle = C.salt;
      ctx.fillText(`${f.short} ${v}`, x1 + 28, y);
      ctx.font = `600 9.5px ${FONT_D}`;
      ctx.fillStyle = rgba(tier.color, 0.9);
      ctx.fillText(tier.label, x1 + 28, y + 12);
    });
  }, 0);

  return (
    <div className="rlb-canvas-wrap">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Completionist journey sparklines: final standings after every mission in order are ${FACTIONS.map((f) => `${f.name} ${JOURNEY.lines[f.id][ROWS.length - 1]}`).join(', ')} — tier bands wary, neutral, friendly and kin run behind the curves.`}
      />
    </div>
  );
}

/**
 * Rep Ledger Bench — the threshold rails. One ruler, banded wary → neutral →
 * friendly → kin, with each faction drawn as a journey in two marks: hollow
 * glyph = story-only end standing, solid glyph = running every posted job,
 * joined by a hatched strip (what the side board contributes). Dashed amber
 * tail = distance still owed to the next rail — the stranded-faction check,
 * drawn instead of merely asserted.
 */
import { useRef } from 'react';
import { C, FONT_B, FONT_D, hatchRect, rgba, roundRect, useChart } from './chart';
import { ALL_END, CHART_MAX, FACTIONS, STORY_END, TIERS, tierFor } from './data';

const H = 300;
const TM = 40;
const BM = 12;
const L_GUTTER = 148;
const R_GUTTER = 24;
const ROW_H = 56;

export function RailsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useChart(canvasRef, H, (ctx, w) => {
    const x0 = L_GUTTER;
    const x1 = w - R_GUTTER;
    const span = x1 - x0;
    const X = (v: number) => x0 + (v / CHART_MAX) * span;

    ctx.clearRect(0, 0, w, H);

    // ---- tier bands (skip hostile — the ledger never goes negative) -------
    const bands = TIERS.filter((t) => t.id !== 'hostile');
    for (let i = 0; i < bands.length; i++) {
      const t = bands[i];
      const xa = X(t.min);
      const xb = t.until == null ? x1 : X(Math.min(t.until, CHART_MAX));
      ctx.fillStyle = rgba(t.color, i % 2 ? 0.05 : 0.085);
      ctx.fillRect(xa, TM - 14, Math.max(0, xb - xa), H - TM - BM + 14);
      // band header: glyph + label + range — sand annotation colour
      ctx.font = `600 10px ${FONT_D}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = rgba(t.color, 0.85);
      const range = t.until == null ? `${t.min}+` : `${t.min}–${t.until - 1}`;
      ctx.fillText(`${t.glyph} ${t.label} ${range}`, xa + 7, TM - 20);
    }
    // rail lines between bands
    ctx.strokeStyle = rgba(C.sand, 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    for (const t of bands) {
      if (t.min <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(X(t.min), TM - 14);
      ctx.lineTo(X(t.min), H - BM);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // baseline
    ctx.strokeStyle = rgba(C.bone, 0.35);
    ctx.beginPath();
    ctx.moveTo(x0, H - BM + 0.5);
    ctx.lineTo(x1, H - BM + 0.5);
    ctx.stroke();

    // ---- faction rows ------------------------------------------------------
    FACTIONS.forEach((f, i) => {
      const my = TM + i * ROW_H + ROW_H / 2;
      const story = STORY_END[f.id] ?? 0;
      const all = ALL_END[f.id] ?? 0;

      // row label: glyph + name + totals
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `400 12px ${FONT_B}`;
      ctx.fillStyle = rgba(f.color, 0.95);
      ctx.fillText(f.glyph, 16, my - 7);
      ctx.font = `700 12.5px ${FONT_D}`;
      ctx.fillStyle = C.bone;
      ctx.fillText(f.short.toUpperCase(), 32, my - 7);
      ctx.font = `600 10.5px ${FONT_D}`;
      ctx.fillStyle = rgba(C.amberHot, 0.9);
      ctx.fillText(`${story} story · ${all} all`, 32, my + 9);

      // story strip (solid) + side contribution (hatched)
      const barH = 10;
      const y = my - barH / 2 + 4;
      // ghost lane
      ctx.fillStyle = rgba(C.bone, 0.05);
      roundRect(ctx, x0, y, X(Math.max(story, all)) - x0, barH, 3);
      ctx.fill();
      ctx.strokeStyle = rgba(C.bone, 0.14);
      ctx.stroke();
      ctx.fillStyle = rgba(f.color, 0.75);
      if (story > 0) {
        roundRect(ctx, x0, y, X(story) - x0, barH, 3);
        ctx.fill();
      }
      if (all > story) hatchRect(ctx, X(story), y, X(all) - X(story), barH, f.color, 0.6);

      // hollow glyph at story-only end
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `400 15px ${FONT_B}`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = rgba(C.space, 0.9);
      const hollowX = Math.max(X(story), x0 + 4);
      ctx.strokeText(f.glyph, hollowX, y - 14);
      ctx.fillStyle = rgba(f.color, 0.95);
      // hollow: draw over with bg to punch the middle out
      ctx.fillText(f.glyph, hollowX, y - 14);
      ctx.font = `400 9px ${FONT_B}`;
      ctx.fillStyle = C.ink;
      ctx.fillText(f.glyph, hollowX, y - 14);

      // solid glyph at completionist end
      const solidX = Math.max(X(all), x0 + 4);
      ctx.font = `400 15px ${FONT_B}`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = rgba(C.space, 0.9);
      ctx.strokeText(f.glyph, solidX, y + barH + 14);
      ctx.fillStyle = f.color;
      ctx.fillText(f.glyph, solidX, y + barH + 14);

      // standing labels next to markers (tabular)
      ctx.font = `600 10px ${FONT_D}`;
      ctx.fillStyle = rgba(C.bone, 0.85);
      ctx.textAlign = 'left';
      ctx.fillText(String(story), hollowX + 10, y - 14);
      ctx.fillStyle = rgba(C.amberHot, 0.95);
      ctx.fillText(String(all), solidX + 10, y + barH + 14);

      // dashed amber tail: distance owed to the next rail above `all`
      const tier = tierFor(all);
      const next = TIERS.find((t) => (t.until ?? Infinity) > all + 0.0001 && t.min > all);
      if (tier.id !== 'kin' && next) {
        const gap = next.min - all;
        ctx.strokeStyle = rgba(C.amber, 0.75);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(X(all), y + barH / 2);
        ctx.lineTo(X(next.min), y + barH / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 10px ${FONT_D}`;
        ctx.fillStyle = C.amberHot;
        ctx.textAlign = 'left';
        ctx.fillText(`${gap} short of ${next.label}`, X(all) + 6, y - 6);
      }
    });

    // legend for the two marker kinds
    ctx.font = `600 10px ${FONT_D}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgba(C.bone, 0.7);
    ctx.fillText('hollow = story only · solid = every job run', x1, H - 2);
  }, 0);

  return (
    <div className="rlb-canvas-wrap">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Standing rails: ${FACTIONS.map((f) => `${f.name} reach ${tierFor(STORY_END[f.id]).label.toLowerCase()} on story missions alone (${STORY_END[f.id]}), ${tierFor(ALL_END[f.id]).label.toLowerCase()} when every job is run (${ALL_END[f.id]})`).join('; ')}.`}
      />
    </div>
  );
}

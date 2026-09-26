/**
 * Rep Ledger Bench — the per-chapter waterfall. One shared scale (0 …
 * CHART_MAX) so the rows stay honest: driftline runs away with the ledger and
 * the reclaimers crawl, and you can see exactly which chapter pays whom.
 * Story columns are solid; the SIDE column is hatched (board work, not plot).
 * Sand annotations mark the silent chapters — a faction nobody paid.
 */
import { useRef } from 'react';
import { C, FONT_D, hatchRect, rgba, roundRect, useChart } from './chart';
import { CHART_MAX, FACTIONS, WATERFALL, tierFor } from './data';

const TM = 30;
const ROW_H = 96;
const L_GUTTER = 148;
const R_GUTTER = 96;
const H = TM + ROW_H * FACTIONS.length + 10;
const RAILS = [15, 40, 80];
const RAIL_LABEL: Record<number, string> = { 15: 'NEUTRAL 15', 40: 'FRIENDLY 40', 80: 'KIN 80' };

export function WaterfallCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useChart(canvasRef, H, (ctx, w) => {
    const x0 = L_GUTTER;
    const x1 = w - R_GUTTER;
    const cols = WATERFALL.length;
    const colW = (x1 - x0) / cols;
    const barW = Math.min(56, colW * 0.52);

    ctx.clearRect(0, 0, w, H);

    FACTIONS.forEach((f, i) => {
      const top = TM + i * ROW_H;
      const baseY = top + ROW_H - 22;
      const plotH = baseY - (top + 8);
      const Y = (v: number) => baseY - (v / CHART_MAX) * plotH;

      // band wash behind the row kin zone
      const kinY = Y(80);
      ctx.fillStyle = rgba(C.amberHot, 0.045);
      ctx.fillRect(x0, top + 8, x1 - x0, Math.max(0, kinY - (top + 8)));

      // rails
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
      for (const r of RAILS) {
        ctx.strokeStyle = rgba(C.sand, 0.3);
        ctx.beginPath();
        ctx.moveTo(x0, Y(r));
        ctx.lineTo(x1, Y(r));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // rail labels at right end of plot
      ctx.font = `600 9px ${FONT_D}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = rgba(C.sand, 0.6);
      for (const r of RAILS) ctx.fillText(RAIL_LABEL[r], x1 - 4, Y(r) - 2);

      // baseline
      ctx.strokeStyle = rgba(C.bone, 0.35);
      ctx.beginPath();
      ctx.moveTo(x0, baseY + 0.5);
      ctx.lineTo(x1, baseY + 0.5);
      ctx.stroke();

      // row label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `400 12px "Sora", ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = rgba(f.color, 0.95);
      ctx.fillText(f.glyph, 16, top + 30);
      ctx.font = `700 12.5px ${FONT_D}`;
      ctx.fillStyle = C.bone;
      ctx.fillText(f.short.toUpperCase(), 32, top + 30);
      const endAll = WATERFALL[cols - 1].bar[f.id].to;
      const endStory = WATERFALL[cols - 2]?.bar[f.id].to ?? endAll;
      ctx.font = `600 10.5px ${FONT_D}`;
      ctx.fillStyle = rgba(C.amberHot, 0.9);
      ctx.fillText(`${endAll} total`, 32, top + 45);
      ctx.fillStyle = rgba(C.bone, 0.6);
      ctx.fillText(`${endStory} story`, 32, top + 58);

      // right-cap: tier reached
      const tier = tierFor(endAll);
      ctx.textAlign = 'right';
      ctx.font = `700 12px ${FONT_D}`;
      ctx.fillStyle = tier.color;
      ctx.fillText(`${tier.glyph} ${tier.label}`, x1 + R_GUTTER - 12, top + 34);

      // bars + cumulative connector
      ctx.textAlign = 'center';
      WATERFALL.forEach((col, ci) => {
        const b = col.bar[f.id];
        const cx = x0 + ci * colW + colW / 2;
        const topY = Y(b.to);
        const botY = Y(b.from);
        if (b.delta > 0) {
          if (col.story) {
            ctx.fillStyle = rgba(f.color, 0.8);
            roundRect(ctx, cx - barW / 2, topY, barW, Math.max(2, botY - topY), 3);
            ctx.fill();
          } else {
            // side board: hatch so the eye separates plot work from board work
            hatchRect(ctx, cx - barW / 2, topY, barW, Math.max(2, botY - topY), f.color, 0.85, 4);
            ctx.strokeStyle = rgba(f.color, 0.9);
            ctx.lineWidth = 1;
            roundRect(ctx, cx - barW / 2, topY, barW, Math.max(2, botY - topY), 3);
            ctx.stroke();
          }
          // delta label
          ctx.font = `600 10px ${FONT_D}`;
          ctx.fillStyle = rgba(f.color === C.amber ? C.amberHot : f.color, 0.95);
          ctx.textBaseline = 'bottom';
          ctx.fillText(`+${b.delta}`, cx, topY - 3);
        } else {
          // silent chapter: the shape channel says nobody paid
          ctx.font = `400 12px "Sora", ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = rgba(C.sand, 0.9);
          ctx.textBaseline = 'middle';
          ctx.fillText('·0', cx, baseY - 7);
        }
        // connector to next column's starting height
        if (ci < cols - 1) {
          const nextCx = x0 + (ci + 1) * colW + colW / 2;
          ctx.strokeStyle = rgba(f.color, 0.45);
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(cx + barW / 2, topY + 0.5);
          ctx.lineTo(nextCx - barW / 2, topY + 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // column label
        ctx.font = `600 9px ${FONT_D}`;
        ctx.fillStyle = col.story ? rgba(C.bone, 0.55) : rgba(C.amber, 0.8);
        ctx.textBaseline = 'top';
        ctx.fillText(col.label, cx, baseY + 5);
      });
    });

    // footnote
    ctx.font = `600 10px ${FONT_D}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgba(C.bone, 0.65);
    ctx.fillText('one shared scale — bars are honest · hatched column = the side board', w - 16, 16);
  }, 0);

  return (
    <div className="rlb-canvas-wrap">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Per-chapter reputation waterfall on one shared scale: ${FACTIONS.map((f) => `${f.name} end at ${WATERFALL[WATERFALL.length - 1].bar[f.id].to} (${tierFor(WATERFALL[WATERFALL.length - 1].bar[f.id].to).label.toLowerCase()})`).join('; ')}.`}
      />
    </div>
  );
}

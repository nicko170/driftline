/**
 * Rep Ledger Bench — the flow sheet. Chapters on the left (CH 1 … CH 5, plus
 * SIDE), factions on the right, canvas2d ribbons carrying every rep point in
 * the ledger. Ribbon width is proportional, colour is faction, and each
 * ribbon carries its faction glyph at mid-span — shape + colour together.
 * Hover isolates a ribbon or a whole node; the DOM tooltip carries the
 * numbers so nothing meaningful lives in canvas alone.
 */
import { useRef, useState } from 'react';
import { C, FONT_B, FONT_D, bez, rgba, roundRect, useChart } from './chart';
import { ALL_END, FACTION_BY_ID, FACTIONS, GRAND_TOTAL, NODES, ROWS, tierFor } from './data';

const ROWS_BY_CHAPTER: Record<string, typeof ROWS> = (() => {
  const m: Record<string, typeof ROWS> = {};
  for (const r of ROWS) {
    const k = String(r.mission.chapter);
    (m[k] = m[k] ?? []).push(r);
  }
  return m;
})();

const FACTION_TOTAL = (id: string): number => ALL_END[id] ?? 0;
const nodeRows = (key: string) => ROWS_BY_CHAPTER[key] ?? [];

const H = 432;
const TM = 20;
const BM = 16;
const GAP = 14;
const BAR_W = 30;
const L_GUTTER = 120; // label column on the left
const R_GUTTER = 132; // label column on the right

interface RibbonGeo {
  key: string;
  chapterKey: string;
  factionId: string;
  amount: number;
  count: number;
  x0: number;
  x1: number;
  y1a: number;
  y1b: number;
  y2a: number;
  y2b: number;
}

interface NodeGeo {
  key: string;
  kind: 'chapter' | 'faction';
  x: number;
  y: number;
  w: number;
  h: number;
}

type Hover =
  | { kind: 'ribbon'; key: string; x: number; y: number }
  | { kind: 'chapter'; key: string; x: number; y: number }
  | { kind: 'faction'; key: string; x: number; y: number }
  | null;

export function FlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoRef = useRef<{ ribbons: RibbonGeo[]; nodes: NodeGeo[]; scale: number }>({
    ribbons: [],
    nodes: [],
    scale: 1,
  });
  const [hover, setHover] = useState<Hover>(null);
  const hoverRef = useRef<Hover>(null);
  hoverRef.current = hover;

  useChart(
    canvasRef,
    H,
    (ctx, w) => {
      const x0 = L_GUTTER + BAR_W;
      const x1 = w - R_GUTTER - BAR_W;
      const d = (x1 - x0) * 0.5;
      const nL = NODES.length;
      const nR = FACTIONS.length;
      const scaleL = (H - TM - BM - (nL - 1) * GAP) / GRAND_TOTAL;
      const scaleR = (H - TM - BM - (nR - 1) * GAP) / GRAND_TOTAL;
      const hv = hoverRef.current;

      ctx.clearRect(0, 0, w, H);

      // survey-field hairlines
      ctx.strokeStyle = rgba(C.bone, 0.05);
      ctx.lineWidth = 1;
      for (let gy = TM; gy <= H - BM + 1; gy += 46) {
        ctx.beginPath();
        ctx.moveTo(x0, gy);
        ctx.lineTo(x1, gy);
        ctx.stroke();
      }

      // ---- lay out right (faction) nodes -----------------------------------
      const fy: Record<string, number> = {};
      const nodes: NodeGeo[] = [];
      let cyR = TM;
      for (const f of FACTIONS) {
        const total = FACTION_TOTAL(f.id);
        const h = Math.max(8, total * scaleR);
        fy[f.id] = cyR;
        nodes.push({ key: f.id, kind: 'faction', x: w - R_GUTTER, y: cyR, w: BAR_W, h });
        cyR += h + GAP;
      }

      // ---- lay out left (chapter) nodes + ribbons ---------------------------
      const ribbons: RibbonGeo[] = [];
      const fCursor: Record<string, number> = { ...fy };
      let cyL = TM;
      for (const node of NODES) {
        const h = Math.max(8, node.sum * scaleL);
        nodes.push({ key: node.key, kind: 'chapter', x: L_GUTTER, y: cyL, w: BAR_W, h });
        let yy = cyL;
        for (const f of FACTIONS) {
          const amount = node.totals[f.id] ?? 0;
          if (!amount) continue;
          let count = 0;
          for (const r of nodeRows(node.key)) if (r.rep[f.id]) count++;
          const rh = Math.max(1.5, amount * scaleL); // source thickness
          const dst = fCursor[f.id];
          const rh2 = Math.max(1.5, amount * scaleR); // destination thickness
          ribbons.push({
            key: `${node.key}:${f.id}`,
            chapterKey: node.key,
            factionId: f.id,
            amount,
            count,
            x0,
            x1,
            y1a: yy,
            y1b: yy + rh,
            y2a: dst,
            y2b: dst + rh2,
          });
          yy += rh;
          fCursor[f.id] = dst + rh2;
        }
        cyL += h + GAP;
      }

      // ---- ribbons -----------------------------------------------------------
      const ribbonActive = (r: RibbonGeo): boolean => {
        if (!hv) return true;
        if (hv.kind === 'ribbon') return hv.key === r.key;
        if (hv.kind === 'chapter') return hv.key === r.chapterKey;
        return hv.key === r.factionId;
      };
      for (const r of ribbons) {
        const f = FACTION_BY_ID[r.factionId];
        const active = ribbonActive(r);
        const isHover = hv?.kind === 'ribbon' && hv.key === r.key;
        ctx.beginPath();
        ctx.moveTo(r.x0, r.y1a);
        ctx.bezierCurveTo(r.x0 + d, r.y1a, r.x1 - d, r.y2a, r.x1, r.y2a);
        ctx.lineTo(r.x1, r.y2b);
        ctx.bezierCurveTo(r.x1 - d, r.y2b, r.x0 + d, r.y1b, r.x0, r.y1b);
        ctx.closePath();
        ctx.fillStyle = rgba(f.color, hv ? (active ? 0.5 : 0.06) : 0.3);
        ctx.fill();
        ctx.strokeStyle = rgba(f.color, isHover ? 0.95 : hv ? (active ? 0.65 : 0.12) : 0.5);
        ctx.lineWidth = isHover ? 1.6 : 1;
        ctx.stroke();
        // glyph at mid-span — the shape channel of the faction code
        if (active) {
          const mx = bez(r.x0, r.x0 + d, r.x1 - d, r.x1, 0.5);
          const my = (bez(r.y1a, r.y1a, r.y2a, r.y2a, 0.5) + bez(r.y1b, r.y1b, r.y2b, r.y2b, 0.5)) / 2;
          ctx.font = `400 11px ${FONT_B}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 3;
          ctx.strokeStyle = rgba(C.space, 0.85);
          ctx.strokeText(f.glyph, mx, my);
          ctx.fillStyle = rgba(f.color, 0.95);
          ctx.fillText(f.glyph, mx, my);
        }
      }

      // ---- nodes + gutter labels ---------------------------------------------
      let ly = TM;
      for (const node of NODES) {
        const h = Math.max(8, node.sum * scaleL);
        const isHover = hv?.kind === 'chapter' && hv.key === node.key;
        ctx.fillStyle = node.story ? rgba(C.sand, isHover ? 0.5 : 0.32) : rgba(C.bone, isHover ? 0.4 : 0.22);
        ctx.strokeStyle = isHover ? C.amberHot : node.story ? rgba(C.ochre, 0.8) : rgba(C.bone, 0.45);
        ctx.lineWidth = 1;
        if (!node.story) ctx.setLineDash([4, 3]);
        roundRect(ctx, L_GUTTER, ly, BAR_W, h, 3);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        // gutter labels (right-aligned, two lines)
        const my = ly + h / 2;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `700 11px ${FONT_D}`;
        ctx.fillStyle = isHover ? C.amberHot : C.bone;
        ctx.fillText(node.label, L_GUTTER - 8, my - (h >= 26 ? 1 : -2));
        ctx.font = `600 11px ${FONT_D}`;
        ctx.fillStyle = rgba(C.amberHot, 0.9);
        ctx.fillText(String(node.sum), L_GUTTER - 8, my + (h >= 26 ? 12 : 11));
        ly += h + GAP;
      }

      let ry = TM;
      for (const f of FACTIONS) {
        const total = FACTION_TOTAL(f.id);
        const h = Math.max(8, total * scaleR);
        const isHover = hv?.kind === 'faction' && hv.key === f.id;
        ctx.fillStyle = rgba(f.color, isHover ? 0.55 : 0.35);
        ctx.strokeStyle = isHover ? C.salt : rgba(f.color, 0.85);
        ctx.lineWidth = 1;
        roundRect(ctx, w - R_GUTTER, ry, BAR_W, h, 3);
        ctx.fill();
        ctx.stroke();
        const my = ry + h / 2;
        const gx = w - R_GUTTER + BAR_W + 8;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `400 11px ${FONT_B}`;
        ctx.fillStyle = rgba(f.color, 0.95);
        ctx.fillText(f.glyph, gx, my - (h >= 26 ? 0 : -2));
        ctx.font = `700 11px ${FONT_D}`;
        ctx.fillStyle = isHover ? C.salt : C.bone;
        ctx.fillText(f.short.toUpperCase(), gx + 14, my);
        ctx.font = `600 10.5px ${FONT_D}`;
        ctx.fillStyle = rgba(C.amberHot, 0.9);
        ctx.fillText(String(total), gx + 14, my + 12);
        ry += h + GAP;
      }

      geoRef.current = { ribbons, nodes, scale: scaleL };
    },
    hover,
  );

  const onMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { ribbons, nodes } = geoRef.current;
    // nodes first (bars are small — give them priority)
    for (const n of nodes) {
      if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
        const key = n.key;
        const kind = n.kind;
        setHover({ kind, key, x: e.clientX - rect.left, y } as Hover);
        return;
      }
    }
    // ribbons: interpolate the S-curve at the pointer's x
    let best: RibbonGeo | null = null;
    let bestD = Infinity;
    for (const r of ribbons) {
      if (x < r.x0 || x > r.x1) continue;
      const t = (x - r.x0) / (r.x1 - r.x0);
      const top = bez(r.y1a, r.y1a, r.y2a, r.y2a, t);
      const bot = bez(r.y1b, r.y1b, r.y2b, r.y2b, t);
      if (y >= top && y <= bot) {
        const dd = Math.abs(y - (top + bot) / 2);
        if (dd < bestD) {
          bestD = dd;
          best = r;
        }
      }
    }
    if (best) setHover({ kind: 'ribbon', key: best.key, x, y });
    else setHover(null);
  };

  const tooltip = (() => {
    if (!hover) return null;
    if (hover.kind === 'ribbon') {
      const r = geoRef.current.ribbons.find((rb) => rb.key === hover.key);
      if (!r) return null;
      const node = NODES.find((n) => n.key === r.chapterKey);
      const f = FACTION_BY_ID[r.factionId];
      return {
        x: hover.x,
        y: hover.y,
        head: `${node?.label ?? r.chapterKey} → ${f.glyph} ${f.short}`,
        body: `${r.amount} rep across ${r.count} mission${r.count === 1 ? '' : 's'}`,
        color: f.color,
      };
    }
    if (hover.kind === 'chapter') {
      const node = NODES.find((n) => n.key === hover.key);
      if (!node) return null;
      return {
        x: hover.x,
        y: hover.y,
        head: `${node.label} — ${node.title}`,
        body: `${node.sum} rep over ${node.missions} mission${node.missions === 1 ? '' : 's'}`,
        color: node.story ? C.sand : C.bone,
      };
    }
    const f = FACTION_BY_ID[hover.key];
    const total = FACTION_TOTAL(f.id);
    const tier = tierFor(total);
    return {
      x: hover.x,
      y: hover.y,
      head: `${f.glyph} ${f.name}`,
      body: `${total} rep total — completionist standing: ${tier.label.toLowerCase()}`,
      color: f.color,
    };
  })();

  return (
    <div className="rlb-canvas-wrap">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Flow chart of reputation rewards: ${GRAND_TOTAL} total rep flows from story chapters and side jobs into four factions — ${FACTIONS.map((f) => `${f.name} ${FACTION_TOTAL(f.id)}`).join(', ')}.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ cursor: hover ? 'pointer' : 'default' }}
      />
      {tooltip && (
        <div
          className="rlb-tip"
          style={{
            left: Math.min(tooltip.x + 14, (canvasRef.current?.clientWidth ?? 600) - 190),
            top: Math.max(8, tooltip.y - 52),
            borderColor: tooltip.color,
          }}
        >
          <strong style={{ color: tooltip.color }}>{tooltip.head}</strong>
          <span>{tooltip.body}</span>
        </div>
      )}
    </div>
  );
}

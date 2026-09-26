/**
 * TacticalCanvas — the top-down storm pan. Minimap-style canvas 2D in the
 * game's danger-red / amber palette on violet-dark. The shelter diamond and
 * storm spawn ring are draggable (sliders in the side panel mirror them for
 * keyboard users). Finished replays come back from the parent as ghost
 * ribbons (teal = sheltered, rust = swallowed).
 */
import { useEffect, useRef } from 'react';
import type { ChoreoParams, TrialResult, TrailPoint } from './sim';

export interface Spectate {
  id: number;
  out: TrialResult['out'];
  trace: TrailPoint[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface Ghost {
  pts: { x: number; z: number }[];
  out: TrialResult['out'];
}

const SIZE = 580;
const PAL = {
  space: '#14101F',
  ink: '#1B1526',
  bone: '#E4D7BE',
  amber: '#FFB454',
  amberHot: '#FFC969',
  rust: '#B3502E',
  teal: '#57C4B8',
  danger: '#E4572E',
};

type DragKind = 'shelter' | 'spawn' | null;
interface Cam { bx: number; bz: number; s: number }

export function computeBounds(trace: TrailPoint[], radius: number) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const q of trace) {
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.z < minZ) minZ = q.z;
    if (q.z > maxZ) maxZ = q.z;
    if (q.sx - radius < minX) minX = q.sx - radius;
    if (q.sx + radius > maxX) maxX = q.sx + radius;
    if (q.sz - radius < minZ) minZ = q.sz - radius;
    if (q.sz + radius > maxZ) maxZ = q.sz + radius;
  }
  return { minX, maxX, minZ, maxZ };
}

export function TacticalCanvas({
  params,
  ghosts,
  onParams,
  spectate,
  speed,
  onSpecEnd,
}: {
  params: ChoreoParams;
  ghosts: Ghost[];
  onParams: (p: ChoreoParams) => void;
  spectate: Spectate | null;
  speed: number;
  onSpecEnd: (out: TrialResult['out'], trace: TrailPoint[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const ghostsRef = useRef(ghosts);
  ghostsRef.current = ghosts;
  const specRef = useRef(spectate);
  specRef.current = spectate;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const endRef = useRef(onSpecEnd);
  endRef.current = onSpecEnd;
  const specIdRef = useRef(0);

  const playT = useRef(0);
  const playIdx = useRef(0);
  const doneFired = useRef(false);
  const drag = useRef<DragKind>(null);
  const hover = useRef<DragKind>(null);
  // deterministic churn speckles
  const speckles = useRef<Float32Array | null>(null);
  if (!speckles.current) {
    const a = new Float32Array(40 * 2);
    let s = 1337;
    for (let i = 0; i < 40; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      a[i * 2] = (s / 4294967296) * 2 - 1;
      s = (s * 1664525 + 1013904223) >>> 0;
      a[i * 2 + 1] = (s / 4294967296) * 2 - 1;
    }
    speckles.current = a;
  }

  /* camera fit from course + spawn + wall radius (+ replay bounds) */
  const fit = (p: ChoreoParams): Cam => {
    const cdA = Math.atan2(p.shelterZ, p.shelterX);
    const spx = -Math.cos(cdA) * p.spawnBack;
    const spz = -Math.sin(cdA) * p.spawnBack;
    let minX = Math.min(0, p.shelterX, spx - p.radius) - 70;
    let maxX = Math.max(0, p.shelterX, spx + p.radius) + 70;
    let minZ = Math.min(0, p.shelterZ, spz - p.radius) - 70;
    let maxZ = Math.max(0, p.shelterZ, spz + p.radius) + 70;
    const live = specRef.current;
    if (live) {
      minX = Math.min(minX, live.bounds.minX - 70);
      maxX = Math.max(maxX, live.bounds.maxX + 70);
      minZ = Math.min(minZ, live.bounds.minZ - 70);
      maxZ = Math.max(maxZ, live.bounds.maxZ + 70);
    }
    const s = Math.min(SIZE / (maxX - minX), SIZE / (maxZ - minZ));
    return { bx: (minX + maxX) / 2, bz: (minZ + maxZ) / 2, s };
  };

  const toPx = (cam: Cam, x: number, z: number) =>
    [SIZE / 2 + (x - cam.bx) * cam.s, SIZE / 2 + (z - cam.bz) * cam.s] as const;

  const toWorld = (cam: Cam, e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * SIZE;
    return [cam.bx + (px - SIZE / 2) / cam.s, cam.bz + (py - SIZE / 2) / cam.s] as const;
  };

  const hitTest = (cam: Cam, e: React.PointerEvent): DragKind => {
    const p = paramsRef.current;
    const [mx, mz] = toWorld(cam, e);
    const thr = 26 / cam.s; // 26 px reach
    if (Math.hypot(mx - p.shelterX, mz - p.shelterZ) < thr) return 'shelter';
    const cdA = Math.atan2(p.shelterZ, p.shelterX);
    if (Math.hypot(mx + Math.cos(cdA) * p.spawnBack, mz + Math.sin(cdA) * p.spawnBack) < thr) return 'spawn';
    return null;
  };

  /* ---------------- paint loop ---------------- */
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dtR = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = paramsRef.current;
      const spec = specRef.current;
      const cam = fit(p);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const px = (x: number, z: number) => toPx(cam, x, z);
      const tSec = now / 1000;

      /* backdrop */
      const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
      bg.addColorStop(0, PAL.ink);
      bg.addColorStop(1, PAL.space);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SIZE, SIZE);

      /* 100 m grid, stronger every 500 m */
      const step = 100;
      const left = cam.bx - SIZE / 2 / cam.s;
      const top = cam.bz - SIZE / 2 / cam.s;
      ctx.lineWidth = 1;
      for (let x = Math.floor(left / step) * step; x < left + SIZE / cam.s; x += step) {
        const [sx0] = px(x, 0);
        ctx.strokeStyle = x % 500 === 0 ? 'rgba(228,215,190,0.12)' : 'rgba(87,196,184,0.055)';
        ctx.beginPath(); ctx.moveTo(sx0, 0); ctx.lineTo(sx0, SIZE); ctx.stroke();
      }
      for (let z = Math.floor(top / step) * step; z < top + SIZE / cam.s; z += step) {
        const [, sy0] = px(0, z);
        ctx.strokeStyle = z % 500 === 0 ? 'rgba(228,215,190,0.12)' : 'rgba(87,196,184,0.055)';
        ctx.beginPath(); ctx.moveTo(0, sy0); ctx.lineTo(SIZE, sy0); ctx.stroke();
      }

      /* course line */
      const [cx0, cz0] = px(0, 0);
      const [hx, hz] = px(p.shelterX, p.shelterZ);
      ctx.strokeStyle = 'rgba(255,180,84,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.moveTo(cx0, cz0); ctx.lineTo(hx, hz); ctx.stroke();
      ctx.setLineDash([]);
      const runM = Math.hypot(p.shelterX, p.shelterZ);
      ctx.fillStyle = 'rgba(255,201,105,0.8)';
      ctx.font = '600 10px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(runM)} M`, (cx0 + hx) / 2, (cz0 + hz) / 2 - 7);

      /* storm spawn ring */
      const cdA = Math.atan2(p.shelterZ, p.shelterX);
      const spx = -Math.cos(cdA) * p.spawnBack;
      const spz = -Math.sin(cdA) * p.spawnBack;
      const [gx, gz] = px(spx, spz);
      ctx.strokeStyle = 'rgba(179,80,46,0.55)';
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(gx, gz); ctx.lineTo(cx0, cz0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(gx, gz, p.radius * cam.s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(228,87,46,0.07)'; ctx.fill();
      ctx.strokeStyle = hover.current === 'spawn' || drag.current === 'spawn' ? PAL.danger : 'rgba(228,87,46,0.5)';
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(gx, gz, 4, 0, Math.PI * 2);
      ctx.fillStyle = PAL.danger; ctx.fill();
      ctx.fillStyle = 'rgba(228,87,46,0.85)';
      ctx.font = '600 9px Sora, sans-serif';
      ctx.fillText(`THE WALL · −${Math.round(p.spawnBack)} M`, gx, gz - Math.max(12, p.radius * cam.s) - 6);

      /* ghost ribbons of finished trials */
      ctx.lineWidth = 1.5;
      for (const g of ghostsRef.current) {
        ctx.strokeStyle = g.out === 'sheltered' ? 'rgba(87,196,184,0.16)' : 'rgba(179,80,46,0.22)';
        ctx.beginPath();
        for (let i = 0; i < g.pts.length; i++) {
          const [gx2, gz2] = px(g.pts[i].x, g.pts[i].z);
          if (i === 0) ctx.moveTo(gx2, gz2); else ctx.lineTo(gx2, gz2);
        }
        ctx.stroke();
      }

      /* live replay */
      let live: TrailPoint | null = null;
      if (spec) {
        if (specIdRef.current !== spec.id) {
          specIdRef.current = spec.id;
          playT.current = 0;
          playIdx.current = 0;
          doneFired.current = false;
        }
        playT.current += dtR * speedRef.current;
        while (playIdx.current < spec.trace.length - 1 && spec.trace[playIdx.current].t < playT.current)
          playIdx.current++;
        playIdx.current = Math.min(playIdx.current, spec.trace.length - 1);
        live = spec.trace[playIdx.current];
        if (playT.current >= spec.trace[spec.trace.length - 1].t && !doneFired.current) {
          doneFired.current = true;
          // downsample for the ghost ribbon; hand it back to the parent
          endRef.current(spec.out, spec.trace.filter((_, i) => i % 4 === 0));
        }
        ctx.strokeStyle = 'rgba(255,201,105,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= playIdx.current; i += 2) {
          const [qx, qz] = px(spec.trace[i].x, spec.trace[i].z);
          if (i === 0) ctx.moveTo(qx, qz); else ctx.lineTo(qx, qz);
        }
        ctx.stroke();
        /* the live wall */
        const [wx, wz] = px(live.sx, live.sz);
        const wr = p.radius * cam.s;
        ctx.beginPath(); ctx.arc(wx, wz, wr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(228,87,46,0.13)'; ctx.fill();
        ctx.strokeStyle = 'rgba(228,87,46,0.6)';
        ctx.lineWidth = 1.5; ctx.stroke();
        const faceA = Math.atan2(live.z - live.sz, live.x - live.sx);
        ctx.beginPath(); ctx.arc(wx, wz, wr, faceA - 1.0, faceA + 1.0);
        ctx.strokeStyle = PAL.danger; ctx.lineWidth = 3.5; ctx.stroke();
        const sp = speckles.current!;
        ctx.fillStyle = 'rgba(228,215,190,0.35)';
        for (let i = 0; i < 40; i++) {
          const ang = Math.atan2(sp[i * 2 + 1], sp[i * 2]) + tSec * 0.4;
          const rad = Math.hypot(sp[i * 2], sp[i * 2 + 1]) * wr;
          ctx.fillRect(wx + Math.cos(ang) * rad, wz + Math.sin(ang) * rad, 1.6, 1.6);
        }
      }

      /* shelter ring + diamond */
      const pulse = 1 + 0.12 * Math.sin(tSec * 4);
      ctx.beginPath(); ctx.arc(hx, hz, Math.max(6, 14.4 * cam.s * pulse), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,180,84,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      const d = hover.current === 'shelter' || drag.current === 'shelter' ? 8 : 6.4;
      ctx.save();
      ctx.translate(hx, hz); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PAL.amber;
      ctx.fillRect(-d / 2, -d / 2, d, d);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,201,105,0.95)';
      ctx.font = '600 9px Sora, sans-serif';
      ctx.fillText('SHELTER ◆', hx, hz - 12);

      /* courier (start chevron or live) */
      let cxr = cx0;
      let czr = cz0;
      let heading = cdA;
      if (live) {
        const [lx2, lz2] = px(live.x, live.z);
        cxr = lx2; czr = lz2;
        heading = Math.atan2(p.shelterZ - live.z, p.shelterX - live.x);
      }
      ctx.save();
      ctx.translate(cxr, czr); ctx.rotate(heading);
      ctx.beginPath();
      ctx.moveTo(7, 0); ctx.lineTo(-4, 4); ctx.lineTo(-1.5, 0); ctx.lineTo(-4, -4);
      ctx.closePath();
      ctx.fillStyle = live ? PAL.amberHot : PAL.rust;
      ctx.fill();
      ctx.restore();
      if (!live) {
        ctx.fillStyle = 'rgba(228,215,190,0.55)';
        ctx.font = '600 9px Sora, sans-serif';
        ctx.fillText('COURIER', cx0, cz0 - 10);
      }

      /* north + scale bar */
      ctx.fillStyle = 'rgba(228,215,190,0.6)';
      ctx.font = '600 9px "Chakra Petch", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('N ↑', 10, 16);
      const scalePx = 500 * cam.s;
      ctx.beginPath(); ctx.moveTo(SIZE - 14 - scalePx, SIZE - 14); ctx.lineTo(SIZE - 14, SIZE - 14);
      ctx.strokeStyle = 'rgba(228,215,190,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText('500 m', SIZE - 16, SIZE - 20);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // refs carry live data; the loop mounts once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- pointer ---------------- */
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const kind = hitTest(fit(paramsRef.current), e);
    if (kind) {
      drag.current = kind;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = paramsRef.current;
    if (!drag.current) {
      hover.current = hitTest(fit(p), e);
      e.currentTarget.style.cursor = hover.current ? 'grab' : 'crosshair';
      return;
    }
    const [wx, wz] = toWorld(fit(p), e);
    if (drag.current === 'shelter') {
      const sx = Math.max(-1400, Math.min(1400, Math.round(wx / 10) * 10));
      const sz = Math.max(-1400, Math.min(1400, Math.round(wz / 10) * 10));
      if (Math.hypot(sx, sz) > 120) onParams({ ...p, shelterX: sx, shelterZ: sz });
    } else if (drag.current === 'spawn') {
      const sb = Math.max(120, Math.min(780, Math.round(Math.hypot(wx, wz) / 10) * 10));
      onParams({ ...p, spawnBack: sb });
    }
  };
  const onUp = () => { drag.current = null; };

  return (
    <canvas
      ref={ref}
      className="sc-pan"
      role="img"
      aria-label={`Top-down storm pan: courier start to shelter ${Math.round(Math.hypot(params.shelterX, params.shelterZ))} metres, storm spawns ${Math.round(params.spawnBack)} metres behind it. Drag the amber shelter diamond or the red spawn ring to restage the run; sliders in the panel do the same for keyboard users.`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}

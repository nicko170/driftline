/**
 * TRAFFIC PLANNER — the survey sheet. One canvas2d surface:
 *   · hillshaded relief underlay sampled from terrainHeight (paper & ink)
 *   · region circles, anchors, the glass road and the ridge
 *   · the shipping manifest as ghost traffic + your plotted routes
 *   · a live dot replay with per-class silhouettes and near-miss pulses
 * Interaction: click to append waypoints (anchor snap), drag to move,
 * right-click a waypoint to lift it, click a line to select its route.
 */
import { useEffect, useRef } from 'react';
import { terrainHeight, surfaceAt } from '../../../lib/terrain';
import {
  GLASSROAD_PATH,
  WINDSPINE_LINE,
  MAP_ANCHORS,
  MAP_REGIONS,
  SHIPPING_MANIFEST,
  WORLD_EXTENT,
  SNAP_RADIUS_M,
  routeLength,
  routeServes,
  nearestAnchor,
  pointAt,
  polylineOf,
  type PlannerRoute,
  type VehicleKind,
} from './data';

interface MapCanvasProps {
  routes: PlannerRoute[];
  selectedId: string | null;
  selectedPoint: number | null;
  drawing: boolean;
  playing: boolean;
  simSpeed: number;
  showManifest: boolean;
  onAddPoint: (routeId: string, x: number, z: number) => void;
  onMovePoint: (routeId: string, index: number, x: number, z: number) => void;
  onRemovePoint: (routeId: string, index: number) => void;
  onSelect: (routeId: string | null, pointIndex: number | null) => void;
}

const INK = '#7E3320'; // rust-deep ruling ink
const INK_SOFT = 'rgba(126,51,32,0.55)';
const PAPER = '#E7DCC4';
const TEAL = '#2E8C8C';
const TEAL_BRIGHT = '#57C4B8';
const AMBER = '#FFB454';
const AMBER_HOT = '#FFC969';
const SPACE = '#14101F';
const DANGER = '#C2401F';

const NEAR_MISS_M = 55;

export function MapCanvas(props: MapCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef(640);
  const dprRef = useRef(1);
  const propsRef = useRef(props);
  propsRef.current = props;

  // sim state: arc-length progress + short trails, keyed by route id
  const simRef = useRef(new Map<string, number>());
  const trailRef = useRef(new Map<string, { x: number; z: number }[]>());
  const cursorRef = useRef<{ x: number; z: number; inside: boolean }>({ x: 0, z: 0, inside: false });
  const dragRef = useRef<{ routeId: string; index: number } | null>(null);
  const underlayRef = useRef<HTMLCanvasElement | null>(null);

  // keep canvas sized to its square box
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const s = Math.max(320, Math.min(wrap.clientWidth, wrap.clientHeight));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = s;
      dprRef.current = dpr;
      canvas.style.width = `${s}px`;
      canvas.style.height = `${s}px`;
      canvas.width = Math.round(s * dpr);
      canvas.height = Math.round(s * dpr);
      underlayRef.current = makeUnderlay(Math.round(s * dpr));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  /* pointer helpers */
  const toWorld = (e: React.PointerEvent): { x: number; z: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const s = sizeRef.current;
    const k = s / (2 * WORLD_EXTENT);
    return {
      x: (e.clientX - rect.left) / k - WORLD_EXTENT,
      z: (e.clientY - rect.top) / k - WORLD_EXTENT,
    };
  };

  const hitWaypoint = (wx: number, wz: number): { routeId: string; index: number } | null => {
    const p = propsRef.current;
    const k = sizeRef.current / (2 * WORLD_EXTENT);
    const tol = 12 / k; // metres
    const tryRoutes = p.selectedId
      ? [...p.routes.filter((r) => r.id === p.selectedId), ...p.routes.filter((r) => r.id !== p.selectedId)]
      : p.routes;
    let best: { routeId: string; index: number } | null = null;
    let bd = tol * tol;
    for (const r of tryRoutes) {
      for (let i = 0; i < r.waypoints.length; i++) {
        const w = r.waypoints[i];
        const d = (w.x - wx) * (w.x - wx) + (w.z - wz) * (w.z - wz);
        if (d < bd) {
          bd = d;
          best = { routeId: r.id, index: i };
        }
      }
    }
    return best;
  };

  const hitLine = (wx: number, wz: number): string | null => {
    const p = propsRef.current;
    const k = sizeRef.current / (2 * WORLD_EXTENT);
    const tol = (9 / k) * (9 / k);
    for (let ri = p.routes.length - 1; ri >= 0; ri--) {
      const pts = polylineOf(p.routes[ri]);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const abx = bx - ax;
        const abz = bz - az;
        const l2 = abx * abx + abz * abz || 1;
        let t = ((wx - ax) * abx + (wz - az) * abz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = wx - (ax + abx * t);
        const dz = wz - (az + abz * t);
        if (dx * dx + dz * dz < tol) return p.routes[ri].id;
      }
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const { x, z } = toWorld(e);
    const p = propsRef.current;
    const hit = hitWaypoint(x, z);
    if (hit) {
      dragRef.current = hit;
      p.onSelect(hit.routeId, hit.index);
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (p.drawing && p.selectedId) {
      p.onAddPoint(p.selectedId, x, z);
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    p.onSelect(hitLine(x, z), null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, z } = toWorld(e);
    cursorRef.current = { x, z, inside: x >= -WORLD_EXTENT && x <= WORLD_EXTENT && z >= -WORLD_EXTENT && z <= WORLD_EXTENT };
    if (dragRef.current) {
      propsRef.current.onMovePoint(dragRef.current.routeId, dragRef.current.index, x, z);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onPointerLeave = () => {
    cursorRef.current.inside = false;
    dragRef.current = null;
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const s = sizeRef.current;
    const k = s / (2 * WORLD_EXTENT);
    const x = (e.clientX - rect.left) / k - WORLD_EXTENT;
    const z = (e.clientY - rect.top) / k - WORLD_EXTENT;
    const hit = hitWaypoint(x, z);
    if (hit) {
      propsRef.current.onRemovePoint(hit.routeId, hit.index);
    }
  };

  /* the draw loop */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const drawDot = (ctx: CanvasRenderingContext2D, kind: VehicleKind, x: number, y: number, hx: number, hz: number, color: string, glow: string, ghost: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(hz, hx));
      ctx.globalAlpha = ghost ? 0.62 : 1;
      // glow puddle
      ctx.fillStyle = glow;
      ctx.globalAlpha = (ghost ? 0.62 : 1) * 0.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = ghost ? 0.62 : 1;
      ctx.fillStyle = color;
      ctx.strokeStyle = SPACE;
      ctx.lineWidth = 1;
      if (kind === 'courier') {
        ctx.beginPath(); // dart
        ctx.moveTo(5.2, 0);
        ctx.lineTo(-3.4, 3.2);
        ctx.lineTo(-1.4, 0);
        ctx.lineTo(-3.4, -3.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (kind === 'hauler') {
        ctx.beginPath(); // deck + cab
        ctx.rect(-4.6, -2.6, 7.8, 5.2);
        ctx.rect(3.2, -1.8, 2.4, 3.6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath(); // skiff: hull + mast tick
        ctx.moveTo(4.6, 0);
        ctx.lineTo(-4, 2.8);
        ctx.lineTo(-2.6, 0);
        ctx.lineTo(-4, -2.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-0.6, 0);
        ctx.lineTo(-0.6, -5.2);
        ctx.stroke();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const p = propsRef.current;
      const s = sizeRef.current;
      const dpr = dprRef.current;
      const k = s / (2 * WORLD_EXTENT); // px per metre
      const W = (x: number) => (x + WORLD_EXTENT) * k;
      const N = (z: number) => (z + WORLD_EXTENT) * k;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);

      // underlay
      if (underlayRef.current) ctx.drawImage(underlayRef.current, 0, 0, s, s);

      // double rule frame + boundary
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(7, 7, s - 14, s - 14);
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 12, s - 24, s - 24);
      ctx.setLineDash([3, 7]);
      ctx.strokeStyle = 'rgba(126,51,32,0.4)';
      ctx.strokeRect(W(-1200), N(-1200), 2400 * k, 2400 * k);
      ctx.setLineDash([]);

      // glass road
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(87,196,184,0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      GLASSROAD_PATH.forEach(([x, z], i) => (i ? ctx.lineTo(W(x), N(z)) : ctx.moveTo(W(x), N(z))));
      ctx.stroke();
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // ridge hatch
      ctx.strokeStyle = 'rgba(126,51,32,0.7)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      WINDSPINE_LINE.forEach(([x, z], i) => (i ? ctx.lineTo(W(x), N(z)) : ctx.moveTo(W(x), N(z))));
      ctx.stroke();
      ctx.setLineDash([]);

      // region circles
      ctx.textBaseline = 'middle';
      const simClock = now / 1000;
      for (const r of MAP_REGIONS) {
        const cx = W(r.center[0]);
        const cy = N(r.center[1]);
        const rr = r.radius * k;
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = INK_SOFT;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // stamped name
        ctx.font = '600 10.5px "Chakra Petch", ui-sans-serif, system-ui';
        const label = r.name.toUpperCase();
        const tw = ctx.measureText(label).width;
        ctx.strokeStyle = 'rgba(231,220,196,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(label, cx - tw / 2, cy - rr - 9);
        ctx.fillStyle = INK;
        ctx.fillText(label, cx - tw / 2, cy - rr - 9);

        // service tally / dead-zone stamp
        const allLines = [
          ...(p.showManifest ? SHIPPING_MANIFEST.map((v) => v.route) : []),
          ...p.routes.map(polylineOf),
        ];
        const served = allLines.filter((line) => routeServes(line, r)).length;
        if (served === 0) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(-0.14);
          ctx.strokeStyle = DANGER;
          ctx.fillStyle = 'rgba(194,64,31,0.9)';
          ctx.lineWidth = 1.6;
          ctx.font = '700 10px "Chakra Petch", ui-sans-serif, system-ui';
          const t = 'DEAD ZONE';
          const dw = ctx.measureText(t).width;
          ctx.strokeRect(-dw / 2 - 6, -9, dw + 12, 18);
          ctx.strokeRect(-dw / 2 - 3.5, -6.5, dw + 7, 13);
          ctx.fillText(t, -dw / 2, 1);
          ctx.restore();
        } else {
          ctx.font = '600 9px "Chakra Petch", ui-sans-serif, system-ui';
          const t = `×${served}`;
          const tw2 = ctx.measureText(t).width;
          ctx.fillStyle = AMBER;
          ctx.fillRect(cx + rr * 0.7 - tw2 / 2 - 4, cy + rr * 0.7 - 6, tw2 + 8, 12);
          ctx.fillStyle = SPACE;
          ctx.fillText(t, cx + rr * 0.7 - tw2 / 2, cy + rr * 0.7 + 0.5);
        }
      }

      // anchors: diamond + label
      ctx.font = '400 8px "Sora", ui-sans-serif, system-ui';
      for (const a of MAP_ANCHORS) {
        const ax = W(a.x);
        const az = N(a.z);
        // cull labels that fall outside the frame edge
        if (ax < 16 || az < 16 || ax > s - 16 || az > s - 16) continue;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(ax, az - 3);
        ctx.lineTo(ax + 3, az);
        ctx.lineTo(ax, az + 3);
        ctx.lineTo(ax - 3, az);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(126,51,32,0.78)';
        ctx.fillText(a.label, ax + 5, az + 0.5);
      }

      // figure-eight labels for the two landmark lines
      ctx.font = '600 9px "Chakra Petch", ui-sans-serif, system-ui';
      ctx.fillStyle = 'rgba(46,140,140,0.95)';
      const grin = GLASSROAD_PATH[2];
      ctx.fillText('THE GLASS ROAD', W(grin[0]) + 8, N(grin[1]) - 8);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText('WINDSPINE RIDGE', W(760), N(-440));

      /* ---- advance + paint the fleet ---- */
      interface RunningDot {
        key: string;
        kind: VehicleKind;
        x: number;
        z: number;
        px: number;
        pz: number;
        hx: number;
        hz: number;
        color: string;
        glow: string;
        ghost: boolean;
      }
      const running: RunningDot[] = [];
      const sim = simRef.current;
      const trails = trailRef.current;

      const allSpecs: { key: string; kind: VehicleKind; pts: [number, number][]; speed: number; phase: number; color: string; glow: string; ghost: boolean }[] = [];
      if (p.showManifest) {
        SHIPPING_MANIFEST.forEach((v, i) =>
          allSpecs.push({ key: `ghost-${i}`, kind: v.kind, pts: v.route, speed: v.speed, phase: v.phase, color: v.color, glow: v.glow, ghost: true }),
        );
      }
      for (const r of p.routes) {
        allSpecs.push({ key: r.id, kind: r.kind, pts: polylineOf(r), speed: r.speed, phase: r.phase, color: r.color, glow: r.glow, ghost: false });
      }
      // drop stale sim entries
      for (const key of [...sim.keys()]) {
        if (!allSpecs.some((a) => a.key === key)) {
          sim.delete(key);
          trails.delete(key);
        }
      }

      for (const spec of allSpecs) {
        if (spec.pts.length < 2) {
          sim.delete(spec.key);
          continue;
        }
        const total = routeLength(spec.pts);
        if (total < 1) continue;
        let sPos = sim.get(spec.key);
        if (sPos === undefined) sPos = spec.phase * total;
        if (p.playing) sPos = (sPos + spec.speed * p.simSpeed * dt) % total;
        sim.set(spec.key, sPos);
        const at = pointAt(spec.pts, sPos);
        const px = W(at.x);
        const pz = N(at.z);
        running.push({ key: spec.key, kind: spec.kind, x: at.x, z: at.z, px, pz, hx: at.hx, hz: at.hz, color: spec.color, glow: spec.glow, ghost: spec.ghost });

        // trail
        const t = trails.get(spec.key) ?? [];
        const lastPt = t[t.length - 1];
        if (!lastPt || lastPt.x !== at.x || lastPt.z !== at.z) {
          t.push({ x: at.x, z: at.z });
          if (t.length > 26) t.shift();
        }
        trails.set(spec.key, t);

        // paint trail
        ctx.strokeStyle = spec.glow;
        for (let i = 1; i < t.length; i++) {
          ctx.globalAlpha = (i / t.length) * (spec.ghost ? 0.16 : 0.3);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(W(t[i - 1].x), N(t[i - 1].z));
          ctx.lineTo(W(t[i].x), N(t[i].z));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // manifest ghost lines
      if (p.showManifest) {
        for (const v of SHIPPING_MANIFEST) {
          ctx.setLineDash([2, 5]);
          ctx.strokeStyle = v.color;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          v.route.forEach(([x, z], i) => (i ? ctx.lineTo(W(x), N(z)) : ctx.moveTo(W(x), N(z))));
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
        }
      }

      // plotted routes
      for (const r of p.routes) {
        const pts = polylineOf(r);
        if (pts.length >= 2) {
          const selected = r.id === p.selectedId;
          ctx.strokeStyle = 'rgba(20,16,31,0.55)';
          ctx.lineWidth = selected ? 4.6 : 3.6;
          ctx.beginPath();
          pts.forEach(([x, z], i) => (i ? ctx.lineTo(W(x), N(z)) : ctx.moveTo(W(x), N(z))));
          ctx.stroke();
          ctx.strokeStyle = r.glow;
          ctx.lineWidth = selected ? 2.4 : 1.6;
          ctx.beginPath();
          pts.forEach(([x, z], i) => (i ? ctx.lineTo(W(x), N(z)) : ctx.moveTo(W(x), N(z))));
          ctx.stroke();
        }
        r.waypoints.forEach((w, i) => {
          const wx = W(w.x);
          const wz = N(w.z);
          const isSel = r.id === p.selectedId && i === p.selectedPoint;
          const isEnd = i === 0 || i === r.waypoints.length - 1;
          ctx.fillStyle = PAPER;
          ctx.strokeStyle = r.glow;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(wx, wz - 5);
          ctx.lineTo(wx + 5, wz);
          ctx.lineTo(wx, wz + 5);
          ctx.lineTo(wx - 5, wz);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (w.anchor) {
            ctx.fillStyle = TEAL_BRIGHT;
            ctx.fillRect(wx - 1.6, wz - 1.6, 3.2, 3.2);
          }
          if (isEnd) {
            ctx.strokeStyle = 'rgba(20,16,31,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(wx, wz, 7.4, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (isSel) {
            ctx.strokeStyle = AMBER_HOT;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(wx + 0.5, wz, 9 + Math.sin(simClock * 5) * 1.2, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      }

      // near-miss pulses
      for (let i = 0; i < running.length; i++) {
        for (let j = i + 1; j < running.length; j++) {
          const a = running[i];
          const b = running[j];
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          if (dx * dx + dz * dz < NEAR_MISS_M * NEAR_MISS_M) {
            const pulse = 9 + 3.5 * Math.sin(simClock * 6);
            ctx.strokeStyle = AMBER_HOT;
            ctx.lineWidth = 1.6;
            for (const d of [a, b]) {
              ctx.beginPath();
              ctx.arc(d.px, d.pz, pulse, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
      }

      // dots on top
      for (const d of running) drawDot(ctx, d.kind, d.px, d.pz, d.hx, d.hz, d.color, d.glow, d.ghost);

      // snap preview + crosshair
      const cur = cursorRef.current;
      if (cur.inside && p.drawing && p.selectedId) {
        const near = nearestAnchor(cur.x, cur.z, SNAP_RADIUS_M);
        ctx.strokeStyle = 'rgba(20,16,31,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(W(cur.x), 14);
        ctx.lineTo(W(cur.x), s - 14);
        ctx.moveTo(14, N(cur.z));
        ctx.lineTo(s - 14, N(cur.z));
        ctx.stroke();
        ctx.setLineDash([]);
        if (near) {
          const ax = W(near.x);
          const az = N(near.z);
          ctx.strokeStyle = TEAL_BRIGHT;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(ax, az, 10 + Math.sin(simClock * 7) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax - 14, az);
          ctx.lineTo(ax - 6, az);
          ctx.moveTo(ax + 6, az);
          ctx.lineTo(ax + 14, az);
          ctx.moveTo(ax, az - 14);
          ctx.lineTo(ax, az - 6);
          ctx.moveTo(ax, az + 6);
          ctx.lineTo(ax, az + 14);
          ctx.stroke();
          ctx.font = '600 9px "Chakra Petch", ui-sans-serif, system-ui';
          const t = `SNAP ${near.key.toUpperCase()}`;
          const tw = ctx.measureText(t).width;
          ctx.fillStyle = SPACE;
          ctx.fillRect(ax + 12, az - 17, tw + 8, 13);
          ctx.fillStyle = TEAL_BRIGHT;
          ctx.fillText(t, ax + 16, az - 10);
        }
      }

      // furniture: compass, scale bar, cursor readout, sheet title
      ctx.font = '700 13px "Chakra Petch", ui-sans-serif, system-ui';
      const compX = s - 38;
      const compY = 40;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(compX, compY, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(compX, compY - 10);
      ctx.lineTo(compX + 4, compY + 4);
      ctx.lineTo(compX, compY + 1);
      ctx.lineTo(compX - 4, compY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.font = '600 8px "Chakra Petch", ui-sans-serif, system-ui';
      ctx.fillText('N', compX - 2.5, compY + 22);

      // scale bar: 500 m
      const sbM = 500;
      const sbW = sbM * k;
      const sbX = 24;
      const sbY = s - 30;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sbX, sbY);
      ctx.lineTo(sbX + sbW, sbY);
      for (let i = 0; i <= 5; i++) {
        ctx.moveTo(sbX + (sbW / 5) * i, sbY);
        ctx.lineTo(sbX + (sbW / 5) * i, sbY - (i % 5 === 0 ? 7 : 4));
      }
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillText('500 m', sbX + sbW + 6, sbY + 0.5);

      if (cur.inside) {
        const t = `E ${String(Math.round(cur.x)).padStart(4, '0')} · S ${String(Math.round(cur.z)).padStart(4, '0')}`;
        ctx.font = '600 9px "Chakra Petch", ui-sans-serif, system-ui';
        const tw = ctx.measureText(t).width;
        ctx.fillStyle = 'rgba(20,16,31,0.82)';
        ctx.fillRect(s - tw - 22, s - 26, tw + 12, 13);
        ctx.fillStyle = AMBER;
        ctx.fillText(t, s - tw - 16, s - 19);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="tp-mapwrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={`tp-map ${props.drawing && props.selectedId ? 'tp-map-draw' : ''}`}
        role="application"
        aria-label="Traffic survey sheet of Kessa-9. Click to append waypoints, drag to move them, right-click a waypoint to lift it."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

/* ---------------- relief underlay ---------------- */

function makeUnderlay(px: number): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = px;
  off.height = px;
  const ctx = off.getContext('2d')!;
  const N = 160; // sample grid
  const img = ctx.createImageData(N, N);
  const heights = new Float32Array(N * N);
  const E = WORLD_EXTENT;
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const x = -E + (gx / (N - 1)) * 2 * E;
      const z = -E + (gy / (N - 1)) * 2 * E;
      heights[gy * N + gx] = terrainHeight(x, z);
    }
  }
  const cellM = (2 * E) / (N - 1);
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const x = -E + (gx / (N - 1)) * 2 * E;
      const z = -E + (gy / (N - 1)) * 2 * E;
      const h = heights[gy * N + gx];
      const hx = heights[gy * N + Math.min(N - 1, gx + 1)] - heights[gy * N + Math.max(0, gx - 1)];
      const hz = heights[Math.min(N - 1, gy + 1) * N + gx] - heights[Math.max(0, gy - 1) * N + gx];
      // hillshade, light from the NW
      let nl = 1 / Math.sqrt(hx * hx + hz * hz + (2 * cellM) * (2 * cellM));
      const dot = (-hx * -0.5 + -hz * -0.6 + 2 * cellM * 0.75) * nl;
      const shade = 0.62 + 0.38 * Math.max(0, dot);
      const surf = surfaceAt(x, z);

      let r = 231, g = 220, b = 196; // paper
      if (surf.kind === 'glass') {
        r = 111; g = 168; b = 163; // muted teal glass
      } else if (surf.kind === 'salt') {
        r = 243; g = 238; b = 226;
      } else {
        const t = Math.min(1, Math.max(0, (h - 2) / 34));
        r = 231 + (196 - 231) * t;
        g = 220 + (147 - 220) * t;
        b = 196 + (88 - 196) * t;
        if (h > 42) {
          const v = Math.min(1, (h - 42) / 40);
          r += (74 - r) * v;
          g += (62 - g) * v;
          b += (94 - b) * v;
        }
      }
      r *= shade;
      g *= shade;
      b *= shade;

      // contours every 6 m — where a band boundary crosses a cell edge
      const band = Math.floor(h / 6);
      const bR = Math.floor(heights[gy * N + Math.min(N - 1, gx + 1)] / 6);
      const bD = Math.floor(heights[Math.min(N - 1, gy + 1) * N + gx] / 6);
      const contour = band !== bR || band !== bD;
      const idx = (gy * N + gx) * 4;
      if (contour) {
        img.data[idx] = 126;
        img.data[idx + 1] = 51;
        img.data[idx + 2] = 32;
        img.data[idx + 3] = 90;
      } else {
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
  }
  // draw small then scale up with smoothing = soft survey print
  const tiny = document.createElement('canvas');
  tiny.width = N;
  tiny.height = N;
  tiny.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tiny, 0, 0, px, px);
  // paper vignette
  const grad = ctx.createRadialGradient(px / 2, px / 2, px * 0.36, px / 2, px / 2, px * 0.74);
  grad.addColorStop(0, 'rgba(20,16,31,0)');
  grad.addColorStop(1, 'rgba(20,16,31,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, px, px);
  // edge soak: outside the drift boundary, deepen the ink
  ctx.fillStyle = 'rgba(20,16,31,0.16)';
  ctx.fillRect(0, 0, px, px);
  return off;
}

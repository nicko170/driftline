/**
 * WorldCanvas — top-down tactical pan of the fake test world. Every marker the
 * HUD can render is a draggable handle; the player's heading knob rotates the
 * bike. Pure canvas 2D, redrawn on state change, DPR-aware.
 */
import { useEffect, useRef } from 'react';
import { LAB_HALF, FAKE_REGIONS, type LabWorld } from './world';
import { PALETTES } from './palettes';

const SIZE = 520; // internal px (square)

type DragTarget = 'player' | 'knob' | 'waypoint' | 'convoy' | 'chase' | 'storm' | null;

const PAL = PALETTES[0];

export function WorldCanvas({
  world,
  onChange,
}: {
  world: LabWorld;
  onChange: (w: LabWorld) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<DragTarget>(null);
  const worldRef = useRef(world);
  worldRef.current = world;

  /* ---------- paint ---------- */
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const scale = SIZE / (LAB_HALF * 2);
    const px = (wx: number) => SIZE / 2 + wx * scale;
    const pz = (wz: number) => SIZE / 2 + wz * scale;
    const w = world;

    // pan
    ctx.clearRect(0, 0, SIZE, SIZE);
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, '#F3EEE2');
    g.addColorStop(0.62, '#E8DCC4');
    g.addColorStop(1, '#D9A45B');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // dune striations
    ctx.strokeStyle = 'rgba(176, 124, 58, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 40 + i * 58);
      ctx.bezierCurveTo(SIZE * 0.3, 20 + i * 60, SIZE * 0.7, 70 + i * 55, SIZE, 44 + i * 58);
      ctx.stroke();
    }

    // kilometre grid
    ctx.strokeStyle = 'rgba(27, 21, 38, 0.08)';
    for (let m = -600; m <= 600; m += 200) {
      ctx.beginPath(); ctx.moveTo(px(m), 0); ctx.lineTo(px(m), SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz(m)); ctx.lineTo(SIZE, pz(m)); ctx.stroke();
    }

    // fake regions
    for (const r of FAKE_REGIONS) {
      ctx.beginPath();
      ctx.arc(px(r.x), pz(r.z), r.r * scale, 0, Math.PI * 2);
      ctx.fillStyle = PAL.regionFill;
      ctx.fill();
      ctx.strokeStyle = 'rgba(126, 51, 32, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(27, 21, 38, 0.5)';
      ctx.font = '600 9px Sora, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name.toUpperCase(), px(r.x), pz(r.z) - r.r * scale - 4);
    }

    // storm
    ctx.beginPath();
    ctx.arc(px(w.storm.x), pz(w.storm.z), w.storm.r * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(228, 87, 46, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(228, 87, 46, 0.8)';
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const handle = (
      x: number, z: number, color: string,
      draw: (c: CanvasRenderingContext2D) => void, label: string, dy: number,
    ) => {
      ctx.save();
      ctx.translate(px(x), pz(z));
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(27, 21, 38, 0.85)';
      ctx.lineWidth = 1.5;
      draw(ctx);
      ctx.restore();
      ctx.fillStyle = 'rgba(27, 21, 38, 0.72)';
      ctx.font = '600 9px Sora, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, px(x), pz(z) + dy);
    };

    handle(w.waypoint.x, w.waypoint.z, PAL.waypoint, (c) => {
      c.beginPath();
      c.moveTo(0, -9); c.lineTo(9, 0); c.lineTo(0, 9); c.lineTo(-9, 0);
      c.closePath(); c.fill(); c.stroke();
    }, 'WAYPOINT', -14);
    handle(w.convoy.x, w.convoy.z, PAL.convoy, (c) => {
      c.fillRect(-6, -6, 12, 12); c.strokeRect(-6, -6, 12, 12);
    }, 'CONVOY', 20);
    handle(w.chase.x, w.chase.z, PAL.chase, (c) => {
      c.beginPath();
      c.moveTo(0, -9); c.lineTo(7.6, 6.6); c.lineTo(-7.6, 6.6);
      c.closePath(); c.fill(); c.stroke();
    }, 'CHASE', 24);
    handle(w.storm.x, w.storm.z, '#E4572E', (c) => {
      c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.moveTo(0, -9); c.lineTo(0, 9); c.stroke();
    }, 'STORM', 20);

    // player: arrow + heading knob
    const dirX = Math.sin(w.heading);
    const dirZ = Math.cos(w.heading);
    const plx = px(w.player.x);
    const plz = pz(w.player.z);
    ctx.strokeStyle = 'rgba(27, 21, 38, 0.35)';
    ctx.beginPath(); ctx.arc(plx, plz, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    // canvas rotation: world fwd (sin h, cos h) ⇒ canvas angle atan2(dirX, -dirZ)
    ctx.translate(plx, plz);
    ctx.rotate(Math.atan2(dirX, -dirZ));
    ctx.fillStyle = '#B3502E';
    ctx.strokeStyle = 'rgba(27, 21, 38, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -13); c_arrow(ctx);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // knob
    ctx.beginPath();
    ctx.arc(plx + dirX * 30, plz + dirZ * 30, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#14101F';
    ctx.fill();
    ctx.strokeStyle = '#FFB454';
    ctx.stroke();
    ctx.fillStyle = 'rgba(27, 21, 38, 0.72)';
    ctx.font = '600 9px Sora, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', plx, plz + 26);

    function c_arrow(c: CanvasRenderingContext2D) {
      c.lineTo(8, 10); c.lineTo(0, 5); c.lineTo(-8, 10); c.closePath();
    }
  }, [world]);

  /* ---------- drag ---------- */
  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * SIZE;
    const sz = ((e.clientY - rect.top) / rect.height) * SIZE;
    const scale = SIZE / (LAB_HALF * 2);
    return { x: (sx - SIZE / 2) / scale, z: (sz - SIZE / 2) / scale };
  };

  const hitTest = (x: number, z: number): DragTarget => {
    const w = worldRef.current;
    const near = (hx: number, hz: number, r: number) => Math.hypot(x - hx, z - hz) < r;
    const knobX = w.player.x + Math.sin(w.heading) * 69; // 30px ≈ 69m at scale
    const knobZ = w.player.z + Math.cos(w.heading) * 69;
    if (near(knobX, knobZ, 42)) return 'knob';
    if (near(w.player.x, w.player.z, 46)) return 'player';
    if (near(w.waypoint.x, w.waypoint.z, 46)) return 'waypoint';
    if (near(w.convoy.x, w.convoy.z, 46)) return 'convoy';
    if (near(w.chase.x, w.chase.z, 46)) return 'chase';
    if (near(w.storm.x, w.storm.z, 60)) return 'storm';
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, z } = toWorld(e);
    drag.current = hitTest(x, z);
    if (drag.current) {
      ref.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = drag.current;
    if (!t) return;
    const { x, z } = toWorld(e);
    const w = worldRef.current;
    const cl = (v: number) => Math.max(-LAB_HALF, Math.min(LAB_HALF, v));
    const cx = cl(x);
    const cz = cl(z);
    if (t === 'knob') {
      const heading = Math.atan2(cx - w.player.x, cz - w.player.z);
      onChange({ ...w, heading });
    } else if (t === 'storm') {
      onChange({ ...w, storm: { ...w.storm, x: cx, z: cz } });
    } else {
      onChange({ ...w, [t]: { x: cx, z: cz } });
    }
  };

  const endDrag = () => { drag.current = null; };

  return (
    <figure className="cml-world">
      <canvas
        ref={ref}
        className="cml-world-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label="Fake test world. Drag the waypoint, convoy, chase and storm markers; drag the dark knob to turn the player."
      />
      <figcaption className="cml-figcap">
        drag markers · drag the amber-ringed knob to steer · {LAB_HALF * 2} m across
      </figcaption>
    </figure>
  );
}

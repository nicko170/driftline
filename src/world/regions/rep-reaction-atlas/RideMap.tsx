/**
 * RideMap — the survey map wall. Canvas2d: every on-world band as its radius
 * disc with the dashed +260 m band skirt, the closed Saltmouth survey loop as
 * a dashed amber wayline, stop diamonds, and the courier dot riding it.
 * Clicking anywhere scrubs the courier to the nearest point on the loop;
 * a DOM readout under the canvas says the band, so nothing lives in canvas
 * alone.
 */
import { useEffect, useMemo, useRef } from 'react';
import { ONWORLD, STOPS, pointAt, BAND_SKIRT as BAND_SKIRT_PX } from './data';
import type { RegionMeta } from '../../registry';

const H = 460;

interface View {
  scale: number;
  ox: number; // world→screen: sx = ox + x*scale
  oz: number; //            sz = oz + z*scale   (+z south = down = north up top)
}

function computeView(w: number, h: number): View {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const m of ONWORLD) {
    const r = m.radius + BAND_SKIRT_PX;
    minX = Math.min(minX, m.center[0] - r);
    maxX = Math.max(maxX, m.center[0] + r);
    minZ = Math.min(minZ, m.center[1] - r);
    maxZ = Math.max(maxZ, m.center[1] + r);
  }
  const M = 26;
  const scale = Math.min((w - M * 2) / (maxX - minX), (h - M * 2) / (maxZ - minZ));
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return { scale, ox: w / 2 - cx * scale, oz: h / 2 - cz * scale };
}

export default function RideMap({
  t,
  band,
  onScrub,
}: {
  t: number;
  band: RegionMeta | null;
  onScrub: (t: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  const pos = useMemo(() => pointAt(t), [t]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 800;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view = computeView(w, H);
    viewRef.current = view;
    const sx = (x: number) => view.ox + x * view.scale;
    const sz = (z: number) => view.oz + z * view.scale;

    // ground
    ctx.fillStyle = '#14101F';
    ctx.fillRect(0, 0, w, H);

    // survey grid every 400 m
    ctx.strokeStyle = 'rgba(228,215,190,0.05)';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil((-1200 - view.ox / view.scale) / 400) * 400; gx < 1300; gx += 400) {
      ctx.beginPath();
      ctx.moveTo(sx(gx), 0);
      ctx.lineTo(sx(gx), H);
      ctx.stroke();
    }
    for (let gz = Math.ceil((-1200 - view.oz / view.scale) / 400) * 400; gz < 1300; gz += 400) {
      ctx.beginPath();
      ctx.moveTo(0, sz(gz));
      ctx.lineTo(w, sz(gz));
      ctx.stroke();
    }

    // band skirts (dashed) then band discs
    for (const m of ONWORLD) {
      const active = band?.slug === m.slug;
      ctx.beginPath();
      ctx.arc(sx(m.center[0]), sz(m.center[1]), (m.radius + BAND_SKIRT_PX) * view.scale, 0, Math.PI * 2);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = active ? 'rgba(255,180,84,0.55)' : 'rgba(228,215,190,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const m of ONWORLD) {
      const active = band?.slug === m.slug;
      ctx.beginPath();
      ctx.arc(sx(m.center[0]), sz(m.center[1]), m.radius * view.scale, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(255,180,84,0.13)' : 'rgba(228,215,190,0.045)';
      ctx.fill();
      ctx.strokeStyle = active ? '#FFB454' : 'rgba(228,215,190,0.3)';
      ctx.lineWidth = active ? 1.8 : 1;
      ctx.stroke();
      // label
      ctx.font = '600 10px "Chakra Petch", ui-sans-serif, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? '#FFC969' : 'rgba(228,215,190,0.6)';
      ctx.fillText(
        m.name.toUpperCase(),
        sx(m.center[0]),
        sz(m.center[1]) - (m.radius + BAND_SKIRT_PX) * view.scale - 7,
      );
    }

    // survey loop (dashed wayline) with direction ticks
    if (STOPS.length > 1) {
      ctx.beginPath();
      STOPS.forEach((s, i) => {
        if (i === 0) ctx.moveTo(sx(s.x), sz(s.z));
        else ctx.lineTo(sx(s.x), sz(s.z));
      });
      ctx.closePath();
      ctx.setLineDash([7, 7]);
      ctx.strokeStyle = 'rgba(255,180,84,0.7)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);

      // stops: diamond + leg number
      STOPS.forEach((s, i) => {
        const x = sx(s.x);
        const y = sz(s.z);
        ctx.beginPath();
        ctx.moveTo(x, y - 4.5);
        ctx.lineTo(x + 4.5, y);
        ctx.lineTo(x, y + 4.5);
        ctx.lineTo(x - 4.5, y);
        ctx.closePath();
        ctx.fillStyle = '#FFC969';
        ctx.fill();
        ctx.strokeStyle = '#14101F';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.font = '600 9px "Chakra Petch", ui-sans-serif, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(228,215,190,0.75)';
        ctx.fillText(String(i + 1), x + 7, y - 6);
      });
    }

    // courier: short motion tail + glowing dot
    const tail = pointAt(t - 0.006);
    ctx.beginPath();
    ctx.moveTo(sx(tail.x), sz(tail.z));
    ctx.lineTo(sx(pos.x), sz(pos.z));
    ctx.strokeStyle = 'rgba(255,201,105,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx(pos.x), sz(pos.z), 4.6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFC969';
    ctx.shadowColor = 'rgba(255,180,84,0.9)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#14101F';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // compass rose anchor (north = -z = up)
    ctx.font = '600 10px "Chakra Petch", ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(228,215,190,0.55)';
    ctx.fillText('N ▲', w - 26, 20);
    ctx.fillText('−z', w - 26, 33);
  }, [t, band, pos]);

  /** Scrub: click → nearest sampled point on the loop. */
  const scrubTo = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    const view = viewRef.current;
    if (!canvas || !view) return;
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left - view.ox) / view.scale;
    const wz = (e.clientY - rect.top - view.oz) / view.scale;
    let bestT = 0;
    let bestD = Infinity;
    const SAMPLES = 720;
    for (let i = 0; i < SAMPLES; i++) {
      const p = pointAt(i / SAMPLES);
      const d = (p.x - wx) * (p.x - wx) + (p.z - wz) * (p.z - wz);
      if (d < bestD) {
        bestD = d;
        bestT = i / SAMPLES;
      }
    }
    onScrub(bestT);
  };

  return (
    <canvas
      ref={ref}
      className="rra-map"
      height={H}
      onClick={scrubTo}
      role="img"
      aria-label={`Survey map of every on-world radio band; the courier is ${band ? `inside the ${band.name} band` : 'in long static'}. Click to scrub the ride.`}
    />
  );
}

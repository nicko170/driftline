/**
 * BeamScanline — canvas-2D overlay charting relative ground illuminance
 * across the headlight footprint, using the exact three.js spotlight model
 * (beam.ts). Two strips: the forward centreline throw (with the teal 20–30 m
 * read band and the red pool-clip zone) and the lateral spread at 25 m.
 * Colour-blind-safe: strips are glyph-labelled, zones are shaded + ruled.
 */
import { useEffect, useRef } from 'react';
import { beam, groundLux, evaluateBeam, READ_OK, beamOn } from './beam';

const FW_MAX = 62; // forward plot metres
const LAT_MAX = 14; // lateral half-width metres at z=LAT_Z
const LAT_Z = 25;

function draw(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth;
  const H = cv.clientHeight;
  if (cv.width !== W * dpr) cv.width = W * dpr;
  if (cv.height !== H * dpr) cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // layout: header strip, forward plot, lateral plot
  const padL = 30;
  const padR = 8;
  const fwdY = 6;
  const fwdH = (H - 24) * 0.58;
  const latY = fwdY + fwdH + 12;
  const latH = H - latY - 14;
  const plotW = W - padL - padR;

  const v = evaluateBeam();
  const on = beamOn(beam.t);

  // sample both curves; find a shared ymax (log-ish soft cap)
  let ymax = READ_OK * 2.5;
  const fwd: number[] = [];
  const lat: number[] = [];
  for (let i = 0; i <= 120; i++) {
    const z = 1 + (i / 120) * FW_MAX;
    const e = groundLux(0, z);
    fwd.push(e);
    if (e > ymax) ymax = e;
  }
  for (let i = 0; i <= 120; i++) {
    const x = -LAT_MAX + (i / 120) * LAT_MAX * 2;
    const e = groundLux(x, LAT_Z);
    lat.push(e);
    if (e > ymax) ymax = e;
  }
  ymax *= 1.06;
  const yOf = (e: number, y0: number, h: number) => y0 + h - (Math.min(e, ymax) / ymax) * h;

  const jsx = (z: number) => padL + (z / FW_MAX) * plotW;
  const jsxLat = (x: number) => padL + ((x + LAT_MAX) / (LAT_MAX * 2)) * plotW;

  /* ----- forward strip ----- */
  // read band + pool zone (shaded + ruled, shape-coded by label not colour alone)
  ctx.fillStyle = 'rgba(87, 196, 184, 0.10)';
  ctx.fillRect(jsx(20), fwdY, jsx(30) - jsx(20), fwdH);
  ctx.fillStyle = 'rgba(228, 87, 46, 0.10)';
  ctx.fillRect(jsx(0), fwdY, jsx(8) - jsx(0), fwdH);
  // grid + threshold
  ctx.strokeStyle = 'rgba(228, 215, 190, 0.14)';
  ctx.lineWidth = 1;
  for (const g of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(padL, fwdY + fwdH * g);
    ctx.lineTo(padL + plotW, fwdY + fwdH * g);
    ctx.stroke();
  }
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = 'rgba(255, 201, 105, 0.55)';
  ctx.beginPath();
  ctx.moveTo(padL, yOf(READ_OK, fwdY, fwdH));
  ctx.lineTo(padL + plotW, yOf(READ_OK, fwdY, fwdH));
  ctx.stroke();
  ctx.setLineDash([]);
  // read-die marker
  if (v.read > 0 && on > 0) {
    ctx.strokeStyle = 'rgba(255, 180, 84, 0.8)';
    ctx.beginPath();
    ctx.moveTo(jsx(v.read), fwdY);
    ctx.lineTo(jsx(v.read), fwdY + fwdH);
    ctx.stroke();
    ctx.fillStyle = '#FFC969';
    ctx.beginPath();
    ctx.moveTo(jsx(v.read), fwdY);
    ctx.lineTo(jsx(v.read) - 4, fwdY + 5);
    ctx.lineTo(jsx(v.read) + 4, fwdY + 5);
    ctx.closePath();
    ctx.fill();
  }
  // forward curve (amber)
  ctx.strokeStyle = '#FFB454';
  ctx.lineWidth = 2;
  ctx.beginPath();
  fwd.forEach((e, i) => {
    const x = jsx(1 + (i / 120) * FW_MAX);
    const y = yOf(e, fwdY, fwdH);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineWidth = 1;
  // x ticks
  ctx.fillStyle = 'rgba(228, 215, 190, 0.75)';
  ctx.font = '600 9px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  for (const m of [0, 10, 20, 30, 40, 60]) ctx.fillText(`${m}`, jsx(m), fwdY + fwdH + 9);
  ctx.textAlign = 'left';
  ctx.fillText('THROW ▲ m·lux fwd', padL, fwdY + 3 + 8);
  ctx.fillStyle = v.tone === 'bad' ? '#E4572E' : v.tone === 'warn' ? '#FFB454' : '#57C4B8';
  ctx.textAlign = 'right';
  ctx.fillText(`reads ${Math.round(v.read)} m`, padL + plotW, fwdY + 11);

  /* ----- lateral strip ----- */
  ctx.strokeStyle = 'rgba(228, 215, 190, 0.14)';
  ctx.beginPath();
  ctx.moveTo(padL, latY + latH / 2);
  ctx.lineTo(padL + plotW, latY + latH / 2);
  ctx.stroke();
  // read band width hint: ±half-road
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = 'rgba(87, 196, 184, 0.5)';
  for (const m of [-3, 3]) {
    ctx.beginPath();
    ctx.moveTo(jsxLat(m), latY);
    ctx.lineTo(jsxLat(m), latY + latH);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = '#57C4B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  lat.forEach((e, i) => {
    const x = jsxLat(-LAT_MAX + (i / 120) * LAT_MAX * 2);
    const y = yOf(e, latY, latH);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(228, 215, 190, 0.75)';
  ctx.textAlign = 'center';
  for (const m of [-12, 0, 12]) ctx.fillText(`${m}`, jsxLat(m), latY + latH + 9);
  ctx.textAlign = 'left';
  ctx.fillText(`SPREAD ◈ m·lux @ ${LAT_Z} m`, padL, latY + 8);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#57C4B8';
  ctx.fillText(`pool ×${v.glare.toFixed(1)}`, padL + plotW, latY + 8);

  if (on <= 0.02) {
    ctx.fillStyle = 'rgba(20, 16, 31, 0.55)';
    ctx.fillRect(padL, fwdY, plotW, latY + latH - fwdY);
    ctx.fillStyle = '#E4D7BE';
    ctx.textAlign = 'center';
    ctx.font = '600 11px "Chakra Petch", sans-serif';
    ctx.fillText('LAMP OFF — scrub the clock toward night', padL + plotW / 2, (fwdY + latY + latH) / 2);
  }
}

export function BeamScanline() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 90) return; // ~11 Hz — the chart doesn't need more
      last = now;
      if (ref.current) draw(ref.current);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="nbt-scan" aria-label="Beam footprint illuminance chart">
      <div className="nbt-scan-head">
        <span className="nbt-glyph amber">◉</span> ground illuminance <span className="nbt-scan-sub">scanline · analytic spot model</span>
      </div>
      <canvas ref={ref} />
    </div>
  );
}

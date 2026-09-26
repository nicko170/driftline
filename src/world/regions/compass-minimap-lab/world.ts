/**
 * world — the fake 1200×1200 m test pan the lab moves around, plus the shared
 * minimap painter. drawLabMinimap() mirrors the structure of HUD.tsx's
 * drawMinimap() (bg disc → regions → storm wedge → markers → player arrow)
 * but takes a palette, so all four candidate palettes render the same scene.
 */
import type { MinimapPalette } from './palettes';

export interface LabWorld {
  player: { x: number; z: number };
  /** game convention: forward = (sin h, 0, cos h) */
  heading: number;
  /** m/s — drives chase-cam distance / height / FOV in the marker test */
  speed: number;
  boosting: boolean;
  waypoint: { x: number; z: number };
  convoy: { x: number; z: number };
  chase: { x: number; z: number };
  storm: { x: number; z: number; r: number };
}

export const LAB_HALF = 600;

export const INITIAL_WORLD: LabWorld = {
  player: { x: -60, z: 120 },
  heading: -0.6,
  speed: 14,
  boosting: false,
  waypoint: { x: 260, z: -180 },
  convoy: { x: -260, z: -60 },
  chase: { x: 120, z: 320 },
  storm: { x: -420, z: 380, r: 210 },
};

/** Fake settlements so the minimap has region discs to sit on. */
export const FAKE_REGIONS = [
  { x: -350, z: -300, r: 170, name: 'Pan' },
  { x: 300, z: -120, r: 210, name: 'Ridge' },
  { x: -80, z: 330, r: 150, name: 'Flats' },
  { x: 420, z: 380, r: 120, name: 'Dock' },
];

export function drawLabMinimap(
  ctx: CanvasRenderingContext2D,
  size: number,
  world: LabWorld,
  pal: MinimapPalette,
): void {
  const S = size;
  const scale = S / (LAB_HALF * 2);
  const px = (wx: number) => S / 2 + wx * scale;
  const pz = (wz: number) => S / 2 + wz * scale;

  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = pal.bg;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  ctx.fill();

  // clip to the disc so off-map markers never bleed past the ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  ctx.clip();

  // faint range rings
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  for (const rr of [200, 400, 600]) {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, rr * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // regions (game HUD.tsx: ochre discs)
  for (const r of FAKE_REGIONS) {
    ctx.beginPath();
    ctx.arc(px(r.x), pz(r.z), Math.max(3, r.r * scale), 0, Math.PI * 2);
    ctx.fillStyle = pal.regionFill;
    ctx.fill();
    ctx.strokeStyle = pal.regionRing;
    ctx.stroke();
  }

  // storm wall wedge (danger)
  ctx.beginPath();
  ctx.arc(px(world.storm.x), pz(world.storm.z), world.storm.r * scale, 0, Math.PI * 2);
  ctx.fillStyle = pal.stormFill;
  ctx.fill();
  ctx.strokeStyle = pal.stormEdge;
  ctx.stroke();

  // waypoint (diamond — game draws a rotated rect; we trace a true diamond)
  ctx.fillStyle = pal.waypoint;
  ctx.save();
  ctx.translate(px(world.waypoint.x), pz(world.waypoint.z));
  ctx.beginPath();
  ctx.moveTo(0, -4.8);
  ctx.lineTo(4.8, 0);
  ctx.lineTo(0, 4.8);
  ctx.lineTo(-4.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // escort convoy (square)
  ctx.fillStyle = pal.convoy;
  ctx.fillRect(px(world.convoy.x) - 2.9, pz(world.convoy.z) - 2.9, 5.8, 5.8);

  // chase target (triangle)
  ctx.fillStyle = pal.chase;
  ctx.save();
  ctx.translate(px(world.chase.x), pz(world.chase.z));
  ctx.beginPath();
  ctx.moveTo(0, -4.8);
  ctx.lineTo(4.0, 3.5);
  ctx.lineTo(-4.0, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // player arrow (rotates with heading — game uses -heading, north-up map)
  ctx.save();
  ctx.translate(px(world.player.x), pz(world.player.z));
  ctx.rotate(-world.heading);
  ctx.fillStyle = pal.player;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

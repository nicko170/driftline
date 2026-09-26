/**
 * Bespoke playground heightfield — deliberately NOT the main world.
 * A flat salt pan (baked teal grid lines), a slick glass lane, three
 * analytic kicker mounds for hops, a bowl to carve, dunes beyond and a
 * rising berm at the boundary. Geometry and physics both read this module.
 */
import { fbm2, ridge2, smooth01, lerp, clamp01 } from '../../../lib/noise';

export const PLAY_RADIUS = 300;
export const PAN_RADIUS = 140;
export const SPAWN = { x: 0, z: 70, yaw: Math.PI };

/** Smooth dome bump: (1 - d²)² inside radius r. */
function bump(x: number, z: number, cx: number, cz: number, r: number, amp: number): number {
  const dx = x - cx;
  const dz = z - cz;
  const d2 = (dx * dx + dz * dz) / (r * r);
  if (d2 >= 1) return 0;
  const s = 1 - d2;
  return s * s * amp;
}

/** The glass lane: a slick diagonal strip across the pan (x ≈ z). */
export function laneMask(x: number, z: number): number {
  if (Math.abs(x) > 130 || Math.abs(z) > 130) return 0;
  const d = Math.abs(x - z) / Math.SQRT2;
  return smooth01(1 - d / 12);
}

export function ground(x: number, z: number): number {
  // gentle dunes
  let h = fbm2(x * 0.004 + 3.1, z * 0.004 - 1.7, 3) * 3.4;
  h += ridge2(x * 0.009 + 11.7, z * 0.009 + 5.2, 2) * 1.5;

  // flatten the central salt pan
  const d = Math.sqrt(x * x + z * z);
  h = lerp(h, 0.6 + fbm2(x * 0.03 + 8, z * 0.03 - 4, 2) * 0.18, smooth01(1 - d / PAN_RADIUS));

  // glass lane sits flush
  h = lerp(h, 0.55, laneMask(x, z) * 0.9);

  // kickers — smooth hop mounds ON the pan
  h += bump(x, z, -46, -30, 16, 2.6);
  h += bump(x, z, 54, 26, 13, 2.1);
  h += bump(x, z, 22, -66, 18, 3.0);

  // a shallow bowl out east to carve
  {
    const dx = x - 185;
    const dz = z + 35;
    h -= smooth01(1 - Math.sqrt(dx * dx + dz * dz) / 60) * 5;
  }

  // boundary berm — soft wall, keeps riders in
  const r = Math.max(Math.abs(x), Math.abs(z));
  h += smooth01((r - (PLAY_RADIUS + 10)) / 70) * 36;

  return h;
}

/** Finite-difference normal written into out. */
export function groundNormal(x: number, z: number, out: { x: number; y: number; z: number }): void {
  const e = 1.2;
  const nx = ground(x - e, z) - ground(x + e, z);
  const nz = ground(x, z - e) - ground(x, z + e);
  const ny = 2 * e;
  const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
  out.x = nx * inv;
  out.y = ny * inv;
  out.z = nz * inv;
}

export type SandSurface = 'salt' | 'sand' | 'glass';

export function surfaceAt(x: number, z: number): { kind: SandSurface; grip: number } {
  if (laneMask(x, z) > 0.4) return { kind: 'glass', grip: 0.45 };
  if (x * x + z * z < PAN_RADIUS * PAN_RADIUS) return { kind: 'salt', grip: 1.05 };
  return { kind: 'sand', grip: 1.0 };
}

/* ---------------- vertex colours ---------------- */

const SALT = [0.953, 0.933, 0.886];
const SALT_D = [0.88, 0.83, 0.72];
const SAND = [0.851, 0.643, 0.357];
const SAND_R = [0.62, 0.44, 0.26];
const TEAL = [0.18, 0.55, 0.55];
const TEAL_HI = [0.341, 0.769, 0.722];

export function vertexColor(x: number, z: number, h: number, out: number[] | Float32Array, i: number): void {
  const noise = fbm2(x * 0.02, z * 0.02, 2) * 0.5 + 0.5;
  const d = Math.sqrt(x * x + z * z);
  const panT = smooth01(1 - d / PAN_RADIUS);
  const laneT = laneMask(x, z);

  let r: number, g: number, b: number;
  if (laneT > 0.25 && panT > 0.4) {
    // slick lane — teal glass streak
    const vein = clamp01(ridge2(x * 0.05, z * 0.05, 2) * 0.5 + 0.5);
    r = lerp(TEAL[0], TEAL_HI[0], vein * 0.7);
    g = lerp(TEAL[1], TEAL_HI[1], vein * 0.7);
    b = lerp(TEAL[2], TEAL_HI[2], vein * 0.7);
  } else {
    // salt → sand blend
    const t = clamp01((1 - panT) * 0.9 + Math.max(0, h - 2) * 0.05);
    r = lerp(SALT[0], SAND[0], t);
    g = lerp(SALT[1], SAND[1], t);
    b = lerp(SALT[2], SAND[2], t);
    const v = 0.88 + noise * 0.22;
    r *= v; g *= v; b *= v;
    const mottle = 0.55 + noise * 0.45 * panT;
    r = lerp(SALT_D[0], r, mottle);
    g = lerp(SALT_D[1], g, mottle);
    b = lerp(SALT_D[2], b, mottle);
    // darker, rusty far dunes
    const far = clamp01((d - 220) / 140);
    r = lerp(r, SAND_R[0], far * 0.7);
    g = lerp(g, SAND_R[1], far * 0.7);
    b = lerp(b, SAND_R[2], far * 0.7);
  }

  // baked teal grid lines on the pan (the "lab" look)
  if (panT > 0.55 && laneT < 0.3) {
    const CELL = 20;
    const mx = Math.abs(x % CELL);
    const mz = Math.abs(z % CELL);
    const dd = Math.min(Math.min(mx, CELL - mx), Math.min(mz, CELL - mz));
    if (dd < 0.45) {
      const k = 0.34 * panT;
      r = lerp(r, TEAL_HI[0], k);
      g = lerp(g, TEAL_HI[1], k);
      b = lerp(b, TEAL_HI[2], k);
    }
  }
  // kicker crest shading
  if (h > 2.2) {
    const k = clamp01((h - 2.2) / 4) * 0.25;
    r *= 1 - k; g *= 1 - k * 0.6; b *= 1 - k * 0.3;
  }
  out[i] = r; out[i + 1] = g; out[i + 2] = b;
}

/**
 * The one shared world heightfield. Terrain height, normals, surface info and
 * vertex colours all derive from this module so visuals and gameplay never disagree.
 * Pure math — safe to call from physics hot paths (no allocations).
 */
import { fbm2, ridge2, smooth01, lerp, clamp01 } from './noise';
import { distToPolyline, GLASSROAD_PATH, WINDSPINE_LINE, WORLD_HALF, placement } from '../world/layout';

const saltmouth = placement('saltmouth')!;
const skydocks = placement('skydocks')!;
const choirhollow = placement('choirhollow')!;
const drowned = placement('drowned-array')!;
const mothersgate = placement('mothersgate')!;

export function terrainHeight(x: number, z: number): number {
  // Rolling base + ridged dunes
  let h = fbm2(x * 0.0016, z * 0.0016, 4) * 9;
  h += ridge2(x * 0.0052 + 7.3, z * 0.0052 - 2.1, 3) * 4.2;

  // Glassroad canyon carve (deepens toward the far end)
  const dCanyon = distToPolyline(x, z, GLASSROAD_PATH);
  const carve = smooth01(1 - dCanyon / 110);
  h -= carve * 20;
  // jagged canyon walls: extra lift just outside the carve
  const rim = smooth01(1 - Math.abs(dCanyon - 130) / 60);
  h += rim * 6;

  // Windspine ridge
  const dRidge = distToPolyline(x, z, WINDSPINE_LINE);
  h += smooth01(1 - dRidge / 190) * 26;

  // Skydock mesa — steep-sided flat top
  {
    const dx = x - skydocks.center[0];
    const dz = z - skydocks.center[1];
    const d = Math.sqrt(dx * dx + dz * dz);
    const top = smooth01(1 - d / 240);
    const mesa = Math.pow(top, 0.22) * 34;
    h += mesa;
  }

  // Choir crater dip
  {
    const dx = x - choirhollow.center[0];
    const dz = z - choirhollow.center[1];
    const d = Math.sqrt(dx * dx + dz * dz);
    h -= smooth01(1 - d / 200) * 7;
    h += smooth01(1 - Math.abs(d - 210) / 55) * 4; // crater rim
  }

  // Mother's gate — raised glass hills far SE
  {
    const dx = x - mothersgate.center[0];
    const dz = z - mothersgate.center[1];
    const d = Math.sqrt(dx * dx + dz * dz);
    h += smooth01(1 - d / 320) * 22;
  }

  // Salt flats flatten (Saltmouth + the drowned array pan)
  {
    const dx = x - saltmouth.center[0];
    const dz = z - saltmouth.center[1];
    const d = Math.sqrt(dx * dx + dz * dz);
    h = lerp(h, 1.6 + fbm2(x * 0.02, z * 0.02, 2) * 0.35, smooth01(1 - d / 300));
  }
  {
    const dx = x - drowned.center[0];
    const dz = z - drowned.center[1];
    const d = Math.sqrt(dx * dx + dz * dz);
    h = lerp(h, 1.1 + fbm2(x * 0.03 + 9, z * 0.03, 2) * 0.25, smooth01(1 - d / 260));
  }

  // Boundary mountains — keep the player inside
  const r = Math.max(Math.abs(x), Math.abs(z));
  h += smooth01((r - (WORLD_HALF - 160)) / 170) * 90;

  return h;
}

/** Finite-difference ground normal written into out = {x,y,z}. */
export function terrainNormal(x: number, z: number, out: { x: number; y: number; z: number }): void {
  const e = 1.35;
  const hl = terrainHeight(x - e, z);
  const hr = terrainHeight(x + e, z);
  const hd = terrainHeight(x, z - e);
  const hu = terrainHeight(x, z + e);
  const nx = hl - hr;
  const nz = hd - hu;
  const ny = 2 * e;
  const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
  out.x = nx * inv;
  out.y = ny * inv;
  out.z = nz * inv;
}

export type SurfaceKind = 'salt' | 'sand' | 'glass' | 'rock';

/** Surface classification for grip, dust colour and footstep-ish feedback. */
export function surfaceAt(x: number, z: number): { kind: SurfaceKind; grip: number } {
  const dCanyon = distToPolyline(x, z, GLASSROAD_PATH);
  if (dCanyon < 70) return { kind: 'glass', grip: 0.5 }; // slick fused glass!
  const dx = x - saltmouth.center[0];
  const dz = z - saltmouth.center[1];
  if (dx * dx + dz * dz < 300 * 300) return { kind: 'salt', grip: 1.05 };
  const ax = x - drowned.center[0];
  const az = z - drowned.center[1];
  if (ax * ax + az * az < 260 * 260) return { kind: 'salt', grip: 1.0 };
  return { kind: 'sand', grip: 1 };
}

/* ---------------- vertex colours (used by Terrain.tsx) ---------------- */

const C = {
  salt: [0.953, 0.933, 0.886],
  saltShadow: [0.894, 0.843, 0.745],
  sand: [0.851, 0.643, 0.357],
  sandDark: [0.627, 0.416, 0.224],
  rustRock: [0.58, 0.36, 0.24],
  rockDark: [0.42, 0.26, 0.18],
  glass: [0.207, 0.55, 0.55],
  glassBright: [0.341, 0.769, 0.722],
  violetStone: [0.33, 0.27, 0.42],
};

/** Writes an rgb triplet into out (length-3 array) for terrain vertex colours. */
export function vertexColor(x: number, z: number, h: number, slope: number, out: number[] | Float32Array, i: number): void {
  const dCanyon = distToPolyline(x, z, GLASSROAD_PATH);
  const noise = fbm2(x * 0.02, z * 0.02, 2) * 0.5 + 0.5;

  let r: number, g: number, b: number;

  if (dCanyon < 95) {
    // fused glass canyon — teal streaked with bright veins
    const vein = clamp01(ridge2(x * 0.03, z * 0.03, 2) * 0.5 + 0.5);
    r = lerp(C.glass[0], C.glassBright[0], vein * 0.8);
    g = lerp(C.glass[1], C.glassBright[1], vein * 0.8);
    b = lerp(C.glass[2], C.glassBright[2], vein * 0.8);
  } else if (h < 3.2 && Math.abs(slope) < 0.3) {
    const m = noise * 0.5;
    r = lerp(C.saltShadow[0], C.salt[0], m + 0.4);
    g = lerp(C.saltShadow[1], C.salt[1], m + 0.4);
    b = lerp(C.saltShadow[2], C.salt[2], m + 0.4);
  } else {
    const t = clamp01((h - 2) / 30);
    r = lerp(C.sand[0], C.rustRock[0], t);
    g = lerp(C.sand[1], C.rustRock[1], t);
    b = lerp(C.sand[2], C.rustRock[2], t);
    if (h > 40) {
      const s = clamp01((h - 40) / 45);
      r = lerp(r, C.violetStone[0], s);
      g = lerp(g, C.violetStone[1], s);
      b = lerp(b, C.violetStone[2], s);
    }
    // dune shading variation
    const v = 0.9 + noise * 0.2;
    r *= v; g *= v; b *= v;
    // steep faces darken
    const dark = 1 - clamp01(slope * 0.65);
    r *= dark; g *= dark; b *= dark;
  }
  out[i] = r; out[i + 1] = g; out[i + 2] = b;
}

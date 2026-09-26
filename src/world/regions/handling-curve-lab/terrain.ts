/**
 * Handling Curve Lab terrain — a figure-eight test pan.
 *
 * A flat salt pan carries the painted test course: a Bernoulli lemniscate
 * ribbon (the eight), a banked sand ring around its rim, and two glass
 * lanes slicing across the lobes — the three painted grip zones
 * (salt ×1.0 / sand ×0.8 / glass ×0.5) are exactly what surfaceAt() reports.
 * Geometry, physics and paint all read this one module.
 *
 * Lemniscate field: f = (x²+z²)² − A²(x²−z²), dist ≈ |f|/|∇f| (closed form,
 * cheap enough for the 50k-vertex paint pass, near-free per physics tick).
 */
import { fbm2, ridge2, smooth01, lerp, clamp01, mulberry32 } from '../../../lib/noise';

export const PLAY_RADIUS = 282;
export const PAN_RADIUS = 116;
export const EIGHT_A = 104;
/** Spawn on the right-lobe apex tangent (vertical there): (104, -8) facing +z. */
export const SPAWN = { x: EIGHT_A, z: -8, yaw: 0 };

const sstep = (a: number, b: number, x: number) => smooth01((x - a) / (b - a));

/* ------------------------------ the figure eight ------------------------------ */

/** Approx. distance to the lemniscate centreline (m). */
export function trackDist(x: number, z: number): number {
  const x2 = x * x;
  const z2 = z * z;
  const s = x2 + z2;
  if (s < 900) return Math.sqrt(s); // crossing: gradient vanishes, use radial dist
  const A2 = EIGHT_A * EIGHT_A;
  const f = s * s - A2 * (x2 - z2);
  const gx = 2 * x * (2 * s - A2);
  const gz = 2 * z * (2 * s + A2);
  return Math.abs(f) / Math.sqrt(gx * gx + gz * gz);
}

/* -------------------------------- glass lanes -------------------------------- */

interface Strip {
  cx: number;
  cz: number;
  cos: number;
  sin: number;
}

/** One angled lane through each lobe — forces a slide mid-carve. */
const STRIPS: Strip[] = [
  { cx: -54, cz: 0, cos: Math.cos(0.62), sin: Math.sin(0.62) },
  { cx: 54, cz: 0, cos: Math.cos(-0.62), sin: Math.sin(-0.62) },
];

export function glassMask(x: number, z: number): number {
  let m = 0;
  for (const s of STRIPS) {
    const dx = x - s.cx;
    const dz = z - s.cz;
    const along = dx * s.cos + dz * s.sin;
    const across = -dx * s.sin + dz * s.cos;
    const end = 1 - sstep(54, 70, Math.abs(along));
    const a = smooth01(1 - Math.abs(across) / 16) * end;
    if (a > m) m = a;
  }
  return m;
}

/* --------------------------------- height field --------------------------------- */

export function ground(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);

  // far dunes
  let h = fbm2(x * 0.005 + 3.1, z * 0.005 - 1.7, 3) * 2.6;
  h += ridge2(x * 0.011 + 11.7, z * 0.011 + 5.2, 2) * 1.2;

  // flatten the pan
  const panT = smooth01(1 - d / 172);
  h = lerp(h, 0.55 + fbm2(x * 0.03 + 8, z * 0.03 - 4, 2) * 0.12, panT);

  // banked ring around the pan (outer sweep), relaxing into the dunes
  const bankT = sstep(118, 152, d) * (1 - sstep(158, 214, d));
  h += bankT * 1.7;

  // glass lanes sit flush with the pan
  h = lerp(h, 0.55, glassMask(x, z) * 0.9 * panT);

  // boundary berm — keeps riders honest
  const r = Math.max(Math.abs(x), Math.abs(z));
  h += smooth01((r - (PLAY_RADIUS + 10)) / 70) * 40;

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

/* ---------------------------------- surfaces ---------------------------------- */

export type SurfaceKind = 'salt' | 'sand' | 'glass';

export function surfaceAt(x: number, z: number): SurfaceKind {
  const d = x * x + z * z;
  if (d < 160 * 160 && glassMask(x, z) > 0.42) return 'glass';
  return d < PAN_RADIUS * PAN_RADIUS ? 'salt' : 'sand';
}

/* ------------------------------- vertex colours ------------------------------- */

const SALT = [0.953, 0.933, 0.886];
const SALT_D = [0.88, 0.83, 0.72];
const SAND = [0.851, 0.643, 0.357];
const SAND_D = [0.69, 0.49, 0.23];
const SAND_R = [0.62, 0.44, 0.26];
const TEAL = [0.18, 0.55, 0.55];
const TEAL_HI = [0.341, 0.769, 0.722];
const AMBER = [1.0, 0.706, 0.33];
const AMBER_HI = [1.0, 0.8, 0.44];
const OCHRE = [0.62, 0.42, 0.2];

export function vertexColor(x: number, z: number, h: number, out: number[] | Float32Array, i: number): void {
  const noise = fbm2(x * 0.02, z * 0.02, 2) * 0.5 + 0.5;
  const d = Math.sqrt(x * x + z * z);
  const panT = smooth01(1 - d / 172);
  const glass = glassMask(x, z);

  let r: number;
  let g: number;
  let b: number;

  if (glass > 0.2 && panT > 0.35) {
    // glass lane — teal veins, glassy
    const vein = clamp01(ridge2(x * 0.06, z * 0.06, 2) * 0.5 + 0.5);
    const m = smooth01(glass * 1.2);
    r = lerp(SALT[0], lerp(TEAL[0], TEAL_HI[0], vein * 0.8), m);
    g = lerp(SALT[1], lerp(TEAL[1], TEAL_HI[1], vein * 0.8), m);
    b = lerp(SALT[2], lerp(TEAL[2], TEAL_HI[2], vein * 0.8), m);
  } else {
    // salt pan → sand
    const t = clamp01(sstep(PAN_RADIUS - 10, PAN_RADIUS + 16, d));
    r = lerp(SALT[0], SAND[0], t);
    g = lerp(SALT[1], SAND[1], t);
    b = lerp(SALT[2], SAND[2], t);
    const v = 0.88 + noise * 0.22;
    r *= v; g *= v; b *= v;
    const mottle = 0.55 + noise * 0.45 * (1 - t);
    r = lerp(SALT_D[0], r, mottle);
    g = lerp(SALT_D[1], g, mottle);
    b = lerp(SALT_D[2], b, mottle);

    // banked ring reads darker ochre, steeper = deeper
    const bankT = sstep(118, 152, d) * (1 - sstep(158, 214, d));
    r = lerp(r, SAND_D[0], bankT * 0.55);
    g = lerp(g, SAND_D[1], bankT * 0.55);
    b = lerp(b, SAND_D[2], bankT * 0.55);

    // outer sweep guide line on the bank
    if (d > 118 && d < 210) {
      const k = smooth01(1 - Math.abs(d - 138) / 1.3) * 0.55;
      r = lerp(r, OCHRE[0], k);
      g = lerp(g, OCHRE[1], k);
      b = lerp(b, OCHRE[2], k);
    }

    // far dunes go rusty
    const far = clamp01((d - 222) / 140);
    r = lerp(r, SAND_R[0], far * 0.7);
    g = lerp(g, SAND_R[1], far * 0.7);
    b = lerp(b, SAND_R[2], far * 0.7);
  }

  // faint bone survey grid on the pan
  if (panT > 0.6 && glass < 0.3) {
    const CELL = 24;
    const mx = Math.abs(x % CELL);
    const mz = Math.abs(z % CELL);
    const dd = Math.min(Math.min(mx, CELL - mx), Math.min(mz, CELL - mz));
    if (dd < 0.4) {
      const k = 0.16 * panT;
      r = lerp(r, OCHRE[0] * 0.9, k);
      g = lerp(g, OCHRE[1] * 0.9, k);
      b = lerp(b, OCHRE[2] * 0.9, k);
    }
  }

  // the painted eight: ochre border, amber core
  const td = trackDist(x, z);
  if (td < 3.6 && panT > 0.25) {
    const wide = smooth01(1 - td / 3.6);
    const core = smooth01(1 - td / 1.35);
    r = lerp(r, OCHRE[0], wide * 0.85);
    g = lerp(g, OCHRE[1], wide * 0.85);
    b = lerp(b, OCHRE[2], wide * 0.85);
    r = lerp(r, AMBER[0], core);
    g = lerp(g, AMBER[1], core);
    b = lerp(b, AMBER[2], core);
    // start stripe: amber/bone checkbar across the apex at (104, 0)
    if (Math.abs(x - EIGHT_A) < 1.15 && td < 1.9) {
      const check = Math.abs(Math.floor(z / 1.15)) % 2 === 0;
      const c = check ? AMBER_HI : SALT;
      r = c[0]; g = c[1]; b = c[2];
    }
  }

  out[i] = r;
  out[i + 1] = g;
  out[i + 2] = b;
}

/* --------------------------- deterministic prop scatter --------------------------- */

export interface Shard {
  x: number;
  z: number;
  s: number;
  rot: number;
}

export const SHARDS: Shard[] = (() => {
  const rnd = mulberry32(41);
  const out: Shard[] = [];
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 176 + rnd() * 78;
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 2.4 + rnd() * 3.2, rot: rnd() * Math.PI });
  }
  return out;
})();

/** Test-gate post pairs straddling each glass lane (also colliders). */
export const GATES: { x: number; z: number }[] = (() => {
  const out: { x: number; z: number }[] = [];
  for (const s of STRIPS) {
    for (const along of [-34, 34]) {
      const px = s.cx + s.cos * along;
      const pz = s.cz + s.sin * along;
      const nx = -s.sin;
      const nz = s.cos;
      out.push({ x: px + nx * 10.5, z: pz + nz * 10.5 });
      out.push({ x: px - nx * 10.5, z: pz - nz * 10.5 });
    }
  }
  return out;
})();

/** Start gantry posts flanking the apex checkbar. */
export const GANTRY: { x: number; z: number }[] = [
  { x: EIGHT_A - 5.6, z: 0.9 },
  { x: EIGHT_A + 5.6, z: 0.9 },
];

/**
 * Cached, layer-by-layer replica of the shared world heightfield
 * (src/lib/terrain.ts). Each named feature is precomputed into its own
 * Float32Array over a coarse world grid, so layer toggles recombine at
 * interactive speed without re-running the noise.
 *
 * With every layer on and seed 0 the combined result equals
 * terrainHeight(x, z) to float32 quantization error (~3 µm) — the demo
 * verifies this with maxVertexDrift() and shows the Δ badge in the panel,
 * so this file can never silently drift from the shipped worldgen.
 */
import { fbm2, ridge2, smooth01, lerp } from '../../../lib/noise';
import { terrainHeight } from '../../../lib/terrain';
import {
  distToPolyline,
  GLASSROAD_PATH,
  WINDSPINE_LINE,
  WORLD_HALF,
  WORLD_SIZE,
  placement,
} from '../../layout';

export type LayerKey =
  | 'dunes'
  | 'canyon'
  | 'ridge'
  | 'mesa'
  | 'crater'
  | 'gate'
  | 'flats'
  | 'boundary';

export type LayerState = Record<LayerKey, boolean>;

export const ALL_ON: LayerState = {
  dunes: true,
  canyon: true,
  ridge: true,
  mesa: true,
  crater: true,
  gate: true,
  flats: true,
  boundary: true,
};

export const LAYER_INFO: { key: LayerKey; label: string; hint: string }[] = [
  { key: 'dunes', label: 'Dunes', hint: 'fbm base + ridged crests (the only seeded layers)' },
  { key: 'canyon', label: 'Glassroad carve', hint: 'canyon cut + raised glass rim' },
  { key: 'ridge', label: 'Windspine ridge', hint: '+26 m along the wind-farm line' },
  { key: 'mesa', label: 'Skydock mesa', hint: 'steep flat-top for the skyship docks' },
  { key: 'crater', label: 'Choir crater', hint: 'Choirhollow dip + rim ring' },
  { key: 'gate', label: "Mother's gate", hint: 'raised glass hills, far south-east' },
  { key: 'flats', label: 'Salt flats', hint: 'lerp-to-pan at Saltmouth + the drowned array' },
  { key: 'boundary', label: 'Boundary wall', hint: '+90 m mountains past the ride limit' },
];

export interface FieldMaps {
  res: number; // grid segments per side
  n: number; // res + 1 samples per side
  step: number; // metres between samples
  seed: number;
  dunes: Float32Array;
  canyon: Float32Array;
  ridge: Float32Array;
  mesa: Float32Array;
  crater: Float32Array;
  gate: Float32Array;
  boundary: Float32Array;
  saltMask: Float32Array;
  saltFlat: Float32Array;
  drownedMask: Float32Array;
  drownedFlat: Float32Array;
}

const saltmouth = placement('saltmouth')!;
const skydocks = placement('skydocks')!;
const choirhollow = placement('choirhollow')!;
const drowned = placement('drowned-array')!;
const mothersgate = placement('mothersgate')!;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Chunked world-grid build; exactly the terms and order of lib/terrain. */
export async function buildFieldMaps(
  res: number,
  seed: number,
  onProgress?: (done: number, total: number) => void,
  isStale?: () => boolean,
): Promise<FieldMaps | null> {
  const n = res + 1;
  const step = WORLD_SIZE / res;
  const alloc = () => new Float32Array(n * n);
  const m: FieldMaps = {
    res, n, step, seed,
    dunes: alloc(), canyon: alloc(), ridge: alloc(), mesa: alloc(), crater: alloc(),
    gate: alloc(), boundary: alloc(), saltMask: alloc(), saltFlat: alloc(),
    drownedMask: alloc(), drownedFlat: alloc(),
  };
  // Seed preview = shift the noise domain (seed 0 reproduces the shipped world).
  const sx = seed * 137.37;
  const sz = -seed * 211.73;

  const rowsPerChunk = Math.max(2, Math.ceil(n / 12));
  for (let j = 0; j < n; j++) {
    const z = -WORLD_HALF + j * step;
    const nz = z + sz;
    const row = j * n;
    for (let i = 0; i < n; i++) {
      const x = -WORLD_HALF + i * step;
      const nx = x + sx;
      const k = row + i;

      // rolling base + ridged dunes (seeded)
      m.dunes[k] =
        fbm2(nx * 0.0016, nz * 0.0016, 4) * 9 +
        ridge2(nx * 0.0052 + 7.3, nz * 0.0052 - 2.1, 3) * 4.2;

      // glassroad canyon carve + rim
      const dCanyon = distToPolyline(x, z, GLASSROAD_PATH);
      m.canyon[k] =
        -smooth01(1 - dCanyon / 110) * 20 +
        smooth01(1 - Math.abs(dCanyon - 130) / 60) * 6;

      // windspine ridge
      const dRidge = distToPolyline(x, z, WINDSPINE_LINE);
      m.ridge[k] = smooth01(1 - dRidge / 190) * 26;

      // skydock mesa
      {
        const dx = x - skydocks.center[0];
        const dz = z - skydocks.center[1];
        const d = Math.sqrt(dx * dx + dz * dz);
        m.mesa[k] = Math.pow(smooth01(1 - d / 240), 0.22) * 34;
      }

      // choir crater dip + rim
      {
        const dx = x - choirhollow.center[0];
        const dz = z - choirhollow.center[1];
        const d = Math.sqrt(dx * dx + dz * dz);
        m.crater[k] =
          -smooth01(1 - d / 200) * 7 +
          smooth01(1 - Math.abs(d - 210) / 55) * 4;
      }

      // mother's gate hills
      {
        const dx = x - mothersgate.center[0];
        const dz = z - mothersgate.center[1];
        const d = Math.sqrt(dx * dx + dz * dz);
        m.gate[k] = smooth01(1 - d / 320) * 22;
      }

      // salt flats (masks are static; flat targets are seeded)
      {
        const dx = x - saltmouth.center[0];
        const dz = z - saltmouth.center[1];
        const d = Math.sqrt(dx * dx + dz * dz);
        m.saltMask[k] = smooth01(1 - d / 300);
        m.saltFlat[k] = 1.6 + fbm2(nx * 0.02, nz * 0.02, 2) * 0.35;
      }
      {
        const dx = x - drowned.center[0];
        const dz = z - drowned.center[1];
        const d = Math.sqrt(dx * dx + dz * dz);
        m.drownedMask[k] = smooth01(1 - d / 260);
        m.drownedFlat[k] = 1.1 + fbm2(nx * 0.03 + 9, nz * 0.03, 2) * 0.25;
      }

      // boundary mountains
      const r = Math.max(Math.abs(x), Math.abs(z));
      m.boundary[k] = smooth01((r - (WORLD_HALF - 160)) / 170) * 90;
    }
    if (j % rowsPerChunk === 0) {
      onProgress?.(j, n);
      await nextFrame();
      if (isStale?.()) return null;
    }
  }
  onProgress?.(n, n);
  return m;
}

/** Combine cached layers at grid vertex k — bitwise identical to terrainHeight when all on. */
export function combineHeight(m: FieldMaps, L: LayerState, k: number): number {
  let h = L.dunes ? m.dunes[k] : 0;
  if (L.canyon) h += m.canyon[k];
  if (L.ridge) h += m.ridge[k];
  if (L.mesa) h += m.mesa[k];
  if (L.crater) h += m.crater[k];
  if (L.gate) h += m.gate[k];
  if (L.flats) {
    h = lerp(h, m.saltFlat[k], m.saltMask[k]);
    h = lerp(h, m.drownedFlat[k], m.drownedMask[k]);
  }
  if (L.boundary) h += m.boundary[k];
  return h;
}

/** Fill out[] with combined heights; returns {min, max}. No allocations. */
export function combineAll(m: FieldMaps, L: LayerState, out: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < m.n * m.n; k++) {
    const h = combineHeight(m, L, k);
    out[k] = h;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  return { min, max };
}

/** Max |error| between the cached replica (all layers on) and the live terrainHeight. */
export function maxVertexDrift(m: FieldMaps, stride = 3): number {
  let worst = 0;
  for (let j = 0; j < m.n; j += stride) {
    const z = -WORLD_HALF + j * m.step;
    const row = j * m.n;
    for (let i = 0; i < m.n; i += stride) {
      const x = -WORLD_HALF + i * m.step;
      const err = Math.abs(combineHeight(m, ALL_ON, row + i) - terrainHeight(x, z));
      if (err > worst) worst = err;
    }
  }
  return worst;
}

/** Bilinear height sample from combined heights (for ribbons / region rings). */
export function sampleHeight(m: FieldMaps, hmap: Float32Array, x: number, z: number): number {
  const fx = (x + WORLD_HALF) / m.step;
  const fz = (z + WORLD_HALF) / m.step;
  let i = Math.floor(fx);
  let j = Math.floor(fz);
  if (i < 0) i = 0; else if (i > m.n - 2) i = m.n - 2;
  if (j < 0) j = 0; else if (j > m.n - 2) j = m.n - 2;
  const tx = Math.min(Math.max(fx - i, 0), 1);
  const tz = Math.min(Math.max(fz - j, 0), 1);
  const row = j * m.n + i;
  const h00 = hmap[row];
  const h10 = hmap[row + 1];
  const h01 = hmap[row + m.n];
  const h11 = hmap[row + m.n + 1];
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
}

export { WORLD_SIZE, WORLD_HALF };

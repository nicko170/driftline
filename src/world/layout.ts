/**
 * Canonical world coordinates (x east, z south; north = -z).
 * Region meta.json files mirror the centers/radii below — keep in sync when editing.
 * The shared heightfield in src/lib/terrain.ts carves/raises terrain using these.
 */
export const WORLD_SIZE = 2400; // meters, world spans [-1200, 1200] on x and z
export const WORLD_HALF = WORLD_SIZE / 2;

export interface RegionPlacement {
  slug: string;
  center: [number, number];
  radius: number;
}

export const PLACEMENTS: RegionPlacement[] = [
  { slug: 'saltmouth', center: [0, 300], radius: 260 },
  { slug: 'windspine', center: [820, -420], radius: 320 },
  { slug: 'glassroad', center: [380, -260], radius: 420 }, // canyon runs SW→NE through this
  { slug: 'skydocks', center: [-780, -380], radius: 260 },
  { slug: 'cinderflats', center: [-520, 720], radius: 280 },
  { slug: 'choirhollow', center: [480, 620], radius: 240 },
  { slug: 'drowned-array', center: [-120, -980], radius: 280 },
  { slug: 'mothersgate', center: [980, 880], radius: 280 },
];

export const placement = (slug: string) => PLACEMENTS.find((p) => p.slug === slug);

/** The glassroad canyon polyline (x,z) — carved into the terrain. */
export const GLASSROAD_PATH: [number, number][] = [
  [140, 380],
  [260, 120],
  [360, -180],
  [520, -520],
  [760, -800],
  [1010, -1010],
];

/** Windspine ridge line (x,z). */
export const WINDSPINE_LINE: [number, number][] = [
  [560, -60],
  [760, -340],
  [980, -620],
  [1120, -880],
];

export function distToPolyline(x: number, z: number, line: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz || 1;
    let t = ((x - ax) * abx + (z - az) * abz) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (ax + abx * t);
    const dz = z - (az + abz * t);
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

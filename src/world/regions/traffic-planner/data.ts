/**
 * TRAFFIC PLANNER — data & route math for the surveyor's table.
 *
 * Reads the same meta.json / anchors.json files the region registry streams,
 * but statically via glob (importing the registry itself would cycle: the
 * registry eager-imports this folder's index.tsx). Mirrors the shipping
 * VEHICLES manifest from src/game/AmbientTraffic.tsx as ghost reference
 * traffic, and exports the exact VehicleSpec format that file consumes.
 */
import { GLASSROAD_PATH, WINDSPINE_LINE, distToPolyline } from '../../layout';

export { GLASSROAD_PATH, WINDSPINE_LINE };

export type VehicleKind = 'courier' | 'hauler' | 'skiff';

/** Exact mirror of the interface in src/game/AmbientTraffic.tsx. */
export interface VehicleSpec {
  kind: VehicleKind;
  route: [number, number][];
  speed: number;
  phase: number;
  color: string;
  glow: string;
  hover: number;
}

export interface Waypoint {
  x: number;
  z: number;
  /** "region:anchor" when the point is snapped to a named anchor. */
  anchor?: string;
}

export interface PlannerRoute {
  id: string;
  kind: VehicleKind;
  waypoints: Waypoint[];
  speed: number;
  phase: number;
  color: string;
  glow: string;
  hover: number;
}

/* ---------------- world chart (static, from the region JSON files) ---------------- */

interface MetaJson {
  slug: string;
  name: string;
  center: [number, number];
  radius: number;
}
interface AnchorJson {
  pos: [number, number];
  label: string;
  elev?: number;
}

const metaMods = import.meta.glob<{ default: MetaJson }>('../*/meta.json', { eager: true });
const anchorMods = import.meta.glob<{ default: Record<string, AnchorJson> }>(
  '../*/anchors.json',
  { eager: true },
);

export interface MapRegion {
  slug: string;
  name: string;
  center: [number, number];
  radius: number;
}

export interface MapAnchor {
  key: string; // "slug:anchorId"
  region: string;
  label: string;
  x: number;
  z: number;
}

/** Playable world = on-map centre (labs bench far off-world) + a real radius
 *  (lab benches stamp radius 4; the hover playground is a 60m pocket bench). */
function isPlayable(m: MetaJson): boolean {
  return Math.max(Math.abs(m.center[0]), Math.abs(m.center[1])) <= 1500 && m.radius >= 120;
}

export const MAP_REGIONS: MapRegion[] = Object.values(metaMods)
  .map((m) => m.default)
  .filter(isPlayable)
  .map((m) => ({ slug: m.slug, name: m.name, center: m.center, radius: m.radius }))
  .sort((a, b) => a.name.localeCompare(b.name));

const playableSlugs = new Set(MAP_REGIONS.map((r) => r.slug));

export const MAP_ANCHORS: MapAnchor[] = Object.entries(anchorMods)
  .flatMap(([path, mod]) => {
    const slug = path.split('/')[2];
    if (!playableSlugs.has(slug)) return [];
    return Object.entries(mod.default).map(([aid, a]) => ({
      key: `${slug}:${aid}`,
      region: slug,
      label: a.label,
      x: a.pos[0],
      z: a.pos[1],
    }));
  })
  .sort((a, b) => a.key.localeCompare(b.key));

export function findAnchor(key: string): MapAnchor | undefined {
  return MAP_ANCHORS.find((a) => a.key === key);
}

export const WORLD_EXTENT = 1300; // chart spans ±1300 m of the 2400×2400 world

/* ---------------- class presets (match the game's fleet language) ---------------- */

export interface ClassPreset {
  label: string;
  glyph: string;
  blurb: string;
  speedMin: number;
  speedDef: number;
  speedMax: number;
  hover: number;
  glow: string;
  hulls: string[];
}

export const CLASS_PRESETS: Record<VehicleKind, ClassPreset> = {
  courier: {
    label: 'Courier',
    glyph: '◆',
    blurb: 'Driftline bike. Fast legs, amber under-glow, rust hulls.',
    speedMin: 20,
    speedDef: 28,
    speedMax: 36,
    hover: 1.3,
    glow: '#FFB454',
    hulls: ['#B3502E', '#7E3320'],
  },
  hauler: {
    label: 'Hauler',
    glyph: '▣',
    blurb: 'Guild deck wagon. Slow, heavy, ochre and grey.',
    speedMin: 10,
    speedDef: 14,
    speedMax: 18,
    hover: 1.6,
    glow: '#FFB454',
    hulls: ['#B07C3A', '#8A8578'],
  },
  skiff: {
    label: 'Skiff',
    glyph: '▲',
    blurb: 'Choir sail-skiff. Bone sail, teal glow, quiet routes.',
    speedMin: 16,
    speedDef: 20,
    speedMax: 26,
    hover: 1.45,
    glow: '#57C4B8',
    hulls: ['#2E8C8C', '#57C4B8'],
  },
};

export const KIND_ORDER: VehicleKind[] = ['courier', 'hauler', 'skiff'];

/* ---------------- the shipping manifest (ghost reference traffic) ----------------
 * Mirrored verbatim from src/game/AmbientTraffic.tsx (iteration-3 fleet).
 * When the shipped fleet changes, update this sheet — the table reads the
 * game, not vice versa. */
export const SHIPPING_MANIFEST: VehicleSpec[] = [
  {
    kind: 'courier', speed: 30, phase: 0.1, color: '#B3502E', glow: '#FFB454', hover: 1.3,
    route: [...GLASSROAD_PATH] as [number, number][], // saltmouth end ⇄ canyon
  },
  {
    kind: 'courier', speed: 26, phase: 0.55, color: '#7E3320', glow: '#FFB454', hover: 1.3,
    route: [[0, 300], [240, 470], [480, 620], [240, 470]], // saltmouth ⇄ choirhollow
  },
  {
    kind: 'hauler', speed: 14, phase: 0.3, color: '#B07C3A', glow: '#FFB454', hover: 1.6,
    route: [[0, 300], [-220, 520], [-430, 640], [-520, 720], [-430, 640], [-220, 520]], // saltmouth ⇄ cinderflats
  },
  {
    kind: 'hauler', speed: 13, phase: 0.75, color: '#8A8578', glow: '#FFB454', hover: 1.6,
    route: [[0, 300], [-350, -60], [-780, -380], [-350, -60]], // saltmouth ⇄ skydocks
  },
  {
    kind: 'skiff', speed: 21, phase: 0.15, color: '#2E8C8C', glow: '#57C4B8', hover: 1.45,
    route: [[520, -520], [680, -470], [820, -420], [680, -470]], // glassroad ⇄ windspine
  },
  {
    kind: 'skiff', speed: 19, phase: 0.6, color: '#57C4B8', glow: '#57C4B8', hover: 1.45,
    route: [[0, 300], [-100, -60], [-120, -560], [-120, -980], [-120, -560], [-100, -60]], // saltmouth ⇄ drowned array
  },
];

/* ---------------- route math ---------------- */

export function polylineOf(r: PlannerRoute): [number, number][] {
  return r.waypoints.map((w) => [w.x, w.z]);
}

/** Total polyline length in metres. */
export function routeLength(pts: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return total;
}

/** Position + heading at arc distance s along the (wrap-around) polyline. */
const _pos = { x: 0, z: 0, hx: 0, hz: 1 };
export function pointAt(pts: [number, number][], s: number): { x: number; z: number; hx: number; hz: number } {
  let d = s;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dz = pts[i + 1][1] - pts[i][1];
    const len = Math.hypot(dx, dz);
    if (d <= len || i === pts.length - 2) {
      const t = len > 0 ? Math.min(1, d / len) : 0;
      _pos.x = pts[i][0] + dx * t;
      _pos.z = pts[i][1] + dz * t;
      if (len > 0) {
        _pos.hx = dx / len;
        _pos.hz = dz / len;
      }
      return _pos;
    }
    d -= len;
  }
  return _pos;
}

/** Snap radius (metres) used by the table — pins within this of a named anchor pin to it. */
export const SNAP_RADIUS_M = 55;

export function nearestAnchor(x: number, z: number, maxM: number): MapAnchor | null {
  let best: MapAnchor | null = null;
  let bd = maxM * maxM;
  for (const a of MAP_ANCHORS) {
    const d = (a.x - x) * (a.x - x) + (a.z - z) * (a.z - z);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}

/** Snap a world point to a named anchor if one sits within radius. */
export function snapWaypoint(x: number, z: number, snapM: number): Waypoint {
  const a = nearestAnchor(x, z, snapM);
  return a ? { x: a.x, z: a.z, anchor: a.key } : { x, z };
}

export function fmtKm(m: number): string {
  return `${(m / 1000).toFixed(2)} km`;
}

export function fmtLap(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const mm = Math.floor(seconds / 60);
  const ss = Math.round(seconds % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** Which regions a set of polylines serves (passes within the region radius). */
export function servedCounts(polylines: [number, number][][]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of MAP_REGIONS) {
    let n = 0;
    for (const line of polylines) {
      if (line.length >= 2 && distToPolyline(r.center[0], r.center[1], line) <= r.radius) n++;
    }
    out.set(r.slug, n);
  }
  return out;
}

/** Route-passing count for a single route + region. */
export function routeServes(line: [number, number][], region: MapRegion): boolean {
  return line.length >= 2 && distToPolyline(region.center[0], region.center[1], line) <= region.radius;
}

/* ---------------- construction ---------------- */

let uidCounter = 0;
export function uid(): string {
  uidCounter += 1;
  return `rt-${uidCounter.toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`;
}

export function blankRoute(kind: VehicleKind): PlannerRoute {
  const p = CLASS_PRESETS[kind];
  return {
    id: uid(),
    kind,
    waypoints: [],
    speed: p.speedDef,
    phase: 0,
    color: p.hulls[0],
    glow: p.glow,
    hover: p.hover,
  };
}

const roll = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function anchorPoint(slug: string): Waypoint {
  const anchors = MAP_ANCHORS.filter((a) => a.region === slug);
  if (!anchors.length) {
    const r = MAP_REGIONS.find((m) => m.slug === slug)!;
    return { x: r.center[0], z: r.center[1] };
  }
  const a = pick(anchors);
  return { x: a.x, z: a.z, anchor: a.key };
}

/** A plausible seed route: anchor ⇄ anchor across two regions, mirrored home. */
export function randomRoute(): PlannerRoute {
  const kind: VehicleKind = Math.random() < 0.45 ? 'courier' : Math.random() < 0.55 ? 'hauler' : 'skiff';
  const p = CLASS_PRESETS[kind];
  const startRegion = Math.random() < 0.45 ? 'saltmouth' : pick(MAP_REGIONS).slug;
  const others = MAP_REGIONS.filter((r) => r.slug !== startRegion);
  const endR = pick(others);
  const start = anchorPoint(startRegion);
  const end = anchorPoint(endR.slug);

  // a midpoint waystation: a named anchor near the line if one exists
  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;
  const namedMid = nearestAnchor(midX + roll(-90, 90), midZ + roll(-90, 90), 420);
  const mids: Waypoint[] = [];
  if (namedMid && namedMid.region !== startRegion && namedMid.region !== endR.slug) {
    mids.push({ x: namedMid.x, z: namedMid.z, anchor: namedMid.key });
  } else {
    // jittered dogleg so the leg never reads as a ruler line
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const len = Math.hypot(dx, dz) || 1;
    const off = roll(70, 170) * (Math.random() < 0.5 ? 1 : -1);
    mids.push({ x: midX + (-dz / len) * off, z: midZ + (dx / len) * off });
  }

  const route = blankRoute(kind);
  route.waypoints = [start, ...mids, end, ...mids]; // shipping style: mirror leg, wrap home
  route.speed = Math.round(roll(p.speedMin + 2, p.speedMax - 2));
  route.phase = Math.round(roll(0.02, 0.9) * 100) / 100;
  route.color = pick(p.hulls);
  return route;
}

/** Stamp the return leg: append the interior waypoints reversed (game style:
 *  the last point sits one hop from the first, the loop wrap closes it). */
export function withReturnLeg(r: PlannerRoute): PlannerRoute {
  if (r.waypoints.length < 3) return r;
  const interior = r.waypoints.slice(1, -1).reverse();
  return { ...r, waypoints: [...r.waypoints, ...interior] };
}

/* ---------------- two starter legs, so the table never greets you empty ---------------- */

function starterAnchor(key: string, fx: number, fz: number): Waypoint {
  const a = findAnchor(key);
  return a ? { x: a.x, z: a.z, anchor: a.key } : { x: fx, z: fz };
}

export function starterRoutes(): PlannerRoute[] {
  const courier = blankRoute('courier');
  courier.speed = 27;
  courier.phase = 0.2;
  courier.waypoints = [
    starterAnchor('saltmouth:job-board', -14, 292),
    { x: 420, z: -300 }, // dogleg past the glassroad mouth
    starterAnchor('mothersgate:approach', 900, 780),
    { x: 420, z: -300 },
  ];
  const skiff = blankRoute('skiff');
  skiff.speed = 21;
  skiff.phase = 0.6;
  skiff.color = '#2E8C8C';
  skiff.waypoints = [
    starterAnchor('choirhollow:crater-rim', 480, 430),
    starterAnchor('saltmouth:overlook', 160, 180),
    starterAnchor('canyon-slalom:race-start', 575, -315),
    starterAnchor('saltmouth:overlook', 160, 180),
  ];
  return [courier, skiff];
}

/* ---------------- export: exact VehicleSpec manifest ---------------- */

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));

export function exportManifest(routes: PlannerRoute[]): string {
  const plottable = routes.filter((r) => r.waypoints.length >= 2);
  const lines: string[] = [
    '/**',
    ' * VEHICLES — plotted on the Traffic Planner (lab bench).',
    ' * Paste over `const VEHICLES` in src/game/AmbientTraffic.tsx.',
    ` * ${plottable.length} route${plottable.length === 1 ? '' : 's'}, ${routes.length - plottable.length} unplotted (under 2 waypoints).`,
    ' */',
    'const VEHICLES: VehicleSpec[] = [',
  ];
  for (const r of plottable) {
    const pts = r.waypoints.map((w) => `[${Math.round(w.x)},${Math.round(w.z)}]`).join(', ');
    const touches = r.waypoints
      .filter((w) => w.anchor)
      .map((w) => w.anchor)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(' ⇄ ');
    lines.push(
      `  { kind: '${r.kind}', speed: ${fmtNum(r.speed)}, phase: ${fmtNum(r.phase)}, color: '${r.color}', glow: '${r.glow}', hover: ${fmtNum(r.hover)},`,
    );
    lines.push(`    route: [${pts}],${touches ? ` // ${touches}` : ''} },`);
  }
  lines.push('];');
  return lines.join('\n');
}

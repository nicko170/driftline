/**
 * WAYPOINT & BEACON BENCH — shipped marker specification + colourway candidates.
 *
 * Every constant here mirrors what src/game/MissionDirector.tsx renders today
 * (beam height, ground-ring radii, holo heights, race-gate tori and the
 * canonical shape ⇄ colour pairs from .ralph/DESIGN.md), so the "copy JSON"
 * export is an honest description of the shipping game. Alternate colourways
 * are candidates under test — `ghost` is deliberately hostile (all hues
 * collapse toward bone-grey) to prove the shape rule carries identity when
 * colour doesn't.
 * "Cycling through shapes, colourways and distances" happens on a night range
 * because night fog + glow is the worst legibility case the game ships.
 */
import type { CvdId } from './cvd';

export interface BenchConfig {
  colourway: ColourwayId;
  layout: LayoutId;
  motion: boolean;
  cvd: CvdId;
}

export const DEFAULT_CONFIG: BenchConfig = {
  colourway: 'shipped',
  layout: 'standard',
  motion: true,
  cvd: 'none',
};

/* ---------------- canonical marker spec ---------------- */

export const SPEC = {
  beam: {
    height: 60, // sky beam length, m
    radiusTop: 0.5,
    radiusBottom: 1.6,
    opacity: 0.22,
    ring: { inner: 5.6, outer: 7.36, opacity: 0.5, y: 0.3 }, // reach 8 × 0.7 / 0.92
    holoY: 4.2,
    spinRadPerSec: 0.8,
    bobAmp: 0.3,
    bobHz: 0.318, // Math.sin(t * 2) in the game => 2 rad/s
  },
  collect: { size: 0.8, hover: 1.6, bobAmp: 0.35, bobHz: 0.382, emissive: 2 },
  gate: { radius: 6, tube: 0.4, hover: 4 },
  holo: { size: 1.3 },
} as const;

/** Canonical shape ⇄ colour pairs: shape is the identity, colour is decoration. */
export interface MarkerDef {
  id: string;
  glyph: string;
  label: string;
  role: string;
  /** key into a Colourway */
  colorKey: 'waypoint' | 'team' | 'danger' | 'dim';
}

export const MARKERS: MarkerDef[] = [
  { id: 'objective', glyph: '◆', label: 'objective / waypoint', role: 'beam + holo diamond', colorKey: 'waypoint' },
  { id: 'convoy', glyph: '■', label: 'convoy / escort', role: 'thin beam + holo square', colorKey: 'team' },
  { id: 'scout', glyph: '◉', label: 'scout scan', role: 'scan ring + holo square', colorKey: 'team' },
  { id: 'chase', glyph: '▲', label: 'chase target', role: 'thin beam + holo triangle', colorKey: 'danger' },
  { id: 'storm', glyph: '●', label: 'storm front', role: 'ground disc + veil stack', colorKey: 'danger' },
  { id: 'collect', glyph: '✦', label: 'collectible', role: 'hovering octahedron cluster', colorKey: 'team' },
  { id: 'gate-active', glyph: '◍', label: 'race gate · next', role: 'bright torus', colorKey: 'waypoint' },
  { id: 'gate-passed', glyph: '◎', label: 'race gate · cleared', role: 'bright torus', colorKey: 'team' },
  { id: 'gate-pending', glyph: '○', label: 'race gate · pending', role: 'muted torus', colorKey: 'dim' },
];

/* ---------------- colourways ---------------- */

export type ColourwayId = 'shipped' | 'hotrod' | 'ghost';

export interface Colourway {
  id: ColourwayId;
  label: string;
  note: string;
  waypoint: string;
  team: string;
  danger: string;
  dim: string;
}

export const COLOURWAYS: Record<ColourwayId, Colourway> = {
  shipped: {
    id: 'shipped',
    label: 'shipped palette',
    note: 'what the game renders tonight',
    waypoint: '#FFB454',
    team: '#57C4B8',
    danger: '#E4572E',
    dim: '#5C4632',
  },
  hotrod: {
    id: 'hotrod',
    label: 'hot-rod candidate',
    note: 'brighter for haze tests',
    waypoint: '#FFC969',
    team: '#7FD4C9',
    danger: '#FF7A3C',
    dim: '#6E5744',
  },
  ghost: {
    id: 'ghost',
    label: 'ghost stress test',
    note: 'hostile: hues collapse to bone',
    waypoint: '#C9BDAA',
    team: '#B3A898',
    danger: '#A79C8B',
    dim: '#6E6559',
  },
};

export function markerColor(def: MarkerDef, way: Colourway): string {
  return way[def.colorKey];
}

/* ---------------- range layouts (station distances, m) ---------------- */

export type LayoutId = 'standard' | 'huddle' | 'horizon';

export const LAYOUTS: Record<LayoutId, { label: string; note: string; distances: number[] }> = {
  huddle: {
    label: 'huddle range',
    note: '12–90 m · HUD distances, car-park clutter',
    distances: [12, 20, 30, 42, 56, 72, 90],
  },
  standard: {
    label: 'standard range',
    note: '26–272 m · a working mission leg',
    distances: [26, 52, 84, 122, 166, 216, 272],
  },
  horizon: {
    label: 'horizon range',
    note: '60–660 m · fog and bloom are the boss',
    distances: [60, 110, 180, 270, 380, 510, 660],
  },
};

/* ---------------- contrast math (WCAG-ish, CVD-aware) ---------------- */

const srgbToLin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

type Matrix3 = readonly number[];

/** Apply a 3×3 sRGB matrix (Machado CVD sim) to a hex colour, returning hex. */
export function applyMatrix(hex: string, m: Matrix3): string {
  const [r, g, b] = hexToRgb(hex);
  const cl = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  const rr = cl(r * m[0] + g * m[1] + b * m[2]);
  const gg = cl(r * m[3] + g * m[4] + b * m[5]);
  const bb = cl(r * m[6] + g * m[7] + b * m[8]);
  return `#${((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
}

/** Night backdrop the beacons sit against — ink sky / unlit pan blend. */
export const NIGHT_BG = '#1B1526';

/** Copy-ready JSON describing the shipped marker spec + chosen colourway. */
export function specJson(way: Colourway): string {
  return JSON.stringify(
    {
      source: 'waypoint-glow-up bench',
      mirrors: 'src/game/MissionDirector.tsx runtime visuals',
      rule: 'shape is the identity; colour is decoration (never colour alone)',
      colours: way,
      geometry: SPEC,
      pairs: Object.fromEntries(MARKERS.map((d) => [d.id, { glyph: d.glyph, colour: markerColor(d, way), role: d.role }])),
      measured: Object.fromEntries(
        MARKERS.map((d) => [d.id, +contrast(markerColor(d, way), NIGHT_BG).toFixed(2)]),
      ),
    },
    null,
    2,
  );
}

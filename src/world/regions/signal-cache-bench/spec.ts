/**
 * SIGNAL CACHE SCOUT BENCH — shipped spec + bench configuration.
 *
 * SHIPPED mirrors the constants the game renders today:
 *  - the cache assembly from src/game/SignalCaches.tsx (violet octahedron,
 *    weathered tripod, ground ring, glimmer beam, bob/spin),
 *  - the pickup radii from src/game/caches.ts (capture 13 m, hail 340 m),
 *  - the HUD hint chip colours from .hud-signal in src/ui/ui.css,
 *  - the minimap open-diamond from drawMinimap in src/ui/HUD.tsx.
 * BACKDROPS mirror the day/dusk/night keyframes in src/game/Sky.tsx and the
 * storm sand-haze blend (_sandHaze #C98F4E), so the bench judges the pickup
 * against the skies it actually ships under.
 *
 * The "copy JSON" export is an honest description of the shipping game plus
 * the bench's current tuning and measured contrasts.
 */
import type { CvdId } from './cvd';

export interface BenchConfig {
  backdrop: BackdropId;
  storm: StormId;
  ladder: LadderId;
  /** octahedron emissive intensity (shipped 1.5) */
  emissive: number;
  /** glimmer beam opacity (shipped 0.09) */
  glimmer: number;
  /** ground ring opacity (shipped 0.3) */
  ring: number;
  motion: boolean;
  cvd: CvdId;
}

export const DEFAULT_CONFIG: BenchConfig = {
  backdrop: 'day',
  storm: 'off',
  ladder: 'standard',
  emissive: 1.5,
  glimmer: 0.09,
  ring: 0.3,
  motion: true,
  cvd: 'none',
};

/* ---------------- shipped constants (mirrors) ---------------- */

export const CACHE_VIOLET = '#9A86D0'; // reserved codex/record colour (⟡)
export const TRIPOD_TIMBER = '#5C4632';

export const SHIPPED = {
  core: {
    color: CACHE_VIOLET,
    size: 0.55, // octahedron radius, m
    emissive: 1.5,
    bobY: 1.9,
    bobAmp: 0.22,
    bobRadPerSec: 1.7,
    spinRadPerSec: 0.7,
  },
  tripod: {
    color: TRIPOD_TIMBER,
    legTop: 0.05,
    legBottom: 0.08,
    legHeight: 1.5,
    baseRadius: 0.55,
    lean: 0.3,
    y: 0.7,
  },
  ring: { inner: 1.5, outer: 2.1, opacity: 0.3, y: 0.12 },
  glimmer: { height: 22, rTop: 0.14, rBottom: 0.5, opacity: 0.09, yOff: 11 },
  captureRadius: 13, // caches.ts CAPTURE_RADIUS
  hintRange: 340, // caches.ts HINT_RANGE — hail cutoff for chip/minimap feed
  bounty: 15,
} as const;

/** HUD hint chip (.hud-signal) and minimap diamond (drawMinimap). */
export const CHIP = {
  text: '#B8A7E8',
  border: '#9A86D0',
  /** .panel background: color-mix(space 82-86%, transparent) over the night sky */
  bgOver: '#100C1B',
  bgAlpha: 0.84,
  panelBase: '#14101F',
} as const;

export const MINIMAP = {
  diamond: CACHE_VIOLET,
  diamondAlpha: 0.9,
  bg: '#14101F',
  bgAlpha: 0.72,
  halfPx: 3.6,
  lineWidth: 1.4,
  /** worst bright underlay: midday salt pan behind the translucent disc */
  brightUnderlay: '#F3EEE2',
  darkUnderlay: '#100C1B',
} as const;

/** Mission-marker family the violet must stay separable from (DESIGN.md). */
export const MISSION_COLOURS: { id: string; glyph: string; label: string; colour: string }[] = [
  { id: 'objective', glyph: '◆', label: 'waypoint / objective', colour: '#FFB454' },
  { id: 'convoy', glyph: '■', label: 'convoy / escort', colour: '#57C4B8' },
  { id: 'chase', glyph: '▲', label: 'chase / danger', colour: '#E4572E' },
];

/* ---------------- backdrops (mirror Sky.tsx keyframes) ---------------- */

export type BackdropId = 'day' | 'dusk' | 'night';

export interface Backdrop {
  id: BackdropId;
  label: string;
  note: string;
  skyTop: string;
  horizon: string;
  /** horizon glow accent (settlement / sun smear) */
  glow: string;
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  /** multiplies the floor vertex colours */
  floorTint: string;
  stars: boolean;
  sunDisc: { pos: [number, number, number]; color: string; size: number } | null;
}

export const BACKDROPS: Record<BackdropId, Backdrop> = {
  day: {
    id: 'day',
    label: 'midday salt',
    note: 'Sky.tsx t=0.50 — sun-bleached flats, pale teal zenith. The friendliest case.',
    skyTop: '#7FB4BE',
    horizon: '#E4D7BE',
    glow: '#FFF3D2',
    fog: '#D9C6A2',
    fogDensity: 0.00085,
    sunColor: '#FFEDC4',
    sunIntensity: 1.7,
    ambient: 0.9,
    hemiSky: '#ABCFD6',
    hemiGround: '#C4A98A',
    floorTint: '#FFFFFF',
    stars: false,
    sunDisc: { pos: [-540, 430, -980], color: '#FFF7DE', size: 42 },
  },
  dusk: {
    id: 'dusk',
    label: 'dusk burn',
    note: 'Sky.tsx t=0.78 — violet zenith, ochre horizon. The violet core meets its closest rival.',
    skyTop: '#6E4E78',
    horizon: '#E07B4A',
    glow: '#FFB27A',
    fog: '#C98A6E',
    fogDensity: 0.0014,
    sunColor: '#FF9E5A',
    sunIntensity: 1.1,
    ambient: 0.7,
    hemiSky: '#A895AE',
    hemiGround: '#BA824F',
    floorTint: '#8E7268',
    stars: false,
    sunDisc: { pos: [330, 55, -1150], color: '#FF9E5A', size: 84 },
  },
  night: {
    id: 'night',
    label: 'night watch',
    note: 'Sky.tsx t=0.00 — ink sky, emissive carries. The friendliest case for glow, worst for the tripod.',
    skyTop: '#14101F',
    horizon: '#2A2140',
    glow: '#FFB454',
    fog: '#241C33',
    fogDensity: 0.0023,
    sunColor: '#8899DD',
    sunIntensity: 0.3,
    ambient: 0.5,
    hemiSky: '#4A3A6E',
    hemiGround: '#332720',
    floorTint: '#474061',
    stars: true,
    sunDisc: { pos: [820, 300, -980], color: '#E9DFC8', size: 46 }, // low moon, per the beacon bench
  },
};

/* ---------------- storm dust (mirror Sky.tsx storm blend) ---------------- */

export type StormId = 'off' | 'gust' | 'wall';

export interface Storm {
  id: StormId;
  label: string;
  note: string;
  /** lerp horizon/fog toward this (Sky.tsx _sandHaze) */
  sand: string;
  horizonBlend: number;
  fogBlend: number;
  fogDensityAdd: number;
  sunKeep: number; // multiply sun intensity
  dustOpacity: number;
  dustSpeed: number;
  /** DOM screen tint strength (radial rust gradient from the bottom) */
  screenTint: number;
}

export const STORMS: Record<StormId, Storm> = {
  off: {
    id: 'off', label: 'clear air', note: 'no Dust Devil interference',
    sand: '#C98F4E', horizonBlend: 0, fogBlend: 0, fogDensityAdd: 0,
    sunKeep: 1, dustOpacity: 0, dustSpeed: 0, screenTint: 0,
  },
  gust: {
    id: 'gust', label: 'gust front', note: 'ch3 edge weather — haze rises, motes cross the lane',
    sand: '#C98F4E', horizonBlend: 0.45, fogBlend: 0.5, fogDensityAdd: 0.0018,
    sunKeep: 0.62, dustOpacity: 0.22, dustSpeed: 17, screenTint: 0.1,
  },
  wall: {
    id: 'wall', label: 'storm wall', note: 'worst shipped case — the chase missions\' sand face',
    sand: '#C98F4E', horizonBlend: 0.72, fogBlend: 0.68, fogDensityAdd: 0.0048,
    sunKeep: 0.34, dustOpacity: 0.45, dustSpeed: 30, screenTint: 0.2,
  },
};

/** Storm-wall fog colour (day + wall resolved) — the core's least-friendly backdrop. */
export const STORM_FOG_WALL = '#C4956B';

/* ---------------- distance ladders ---------------- */

export type LadderId = 'huddle' | 'standard' | 'horizon';

export const LADDERS: Record<LadderId, { label: string; note: string; distances: number[] }> = {
  huddle: {
    label: 'huddle ladder',
    note: '14–150 m · pickup range; the capture ring and tripod read',
    distances: [14, 26, 42, 62, 88, 118, 150],
  },
  standard: {
    label: 'standard ladder',
    note: '22–430 m · a working approach leg; runs past the 340 m hail cutoff',
    distances: [22, 48, 84, 130, 190, 260, 340, 430],
  },
  horizon: {
    label: 'horizon ladder',
    note: '70–760 m · fog, glimmer and the minimap diamond are the boss',
    distances: [70, 130, 210, 320, 450, 600, 760],
  },
};

/** Deterministic lane offsets (stations alternate so beacons never stack). */
export function stationPositions(ladder: LadderId): [number, number][] {
  const baseX = [-8, 9, -11, 7, -6, 12, -9, 8, -12, 10, -7, 11];
  return LADDERS[ladder].distances.map((d, i) => [baseX[i % baseX.length], -d]);
}

/** Where the mission-family reference holos stand (separability eyeball). */
export const FAMILY_POSITIONS: { pos: [number, number]; id: string }[] = [
  { pos: [22, -52], id: 'objective' },
  { pos: [-22, -52], id: 'convoy' },
  { pos: [22, -72], id: 'chase' },
];

/* ---------------- colour math (WCAG-ish, CVD-aware) ---------------- */

const srgbToLin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const cl = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${((1 << 24) | (cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).slice(1)}`;
}

export function blendHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Straight-alpha composite of fg (at alpha) over opaque bg. */
export function composite(fg: string, alpha: number, bg: string): string {
  const [fr, fgG, fb] = hexToRgb(fg);
  const [br, bgG, bb] = hexToRgb(bg);
  return rgbToHex(fr * alpha + br * (1 - alpha), fgG * alpha + bgG * (1 - alpha), fb * alpha + bb * (1 - alpha));
}

/** Component-wise multiply — material tint × vertex colour. */
export function mulHex(a: string, b: string): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex((ar * br) / 255, (ag * bg) / 255, (ab * bb) / 255);
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

/** Apply a 3×3 sRGB matrix (Machado CVD sim) to a hex colour, returning hex. */
export function applyMatrix(hex: string, m: readonly number[]): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r * m[0] + g * m[1] + b * m[2],
    r * m[3] + g * m[4] + b * m[5],
    r * m[6] + g * m[7] + b * m[8],
  );
}

/** Redmean colour distance (0 ≈ identical, 765 max) — separability measure. */
export function colorDelta(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 255) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 255) * db * db);
}

/**
 * Approximate the emissive-boosted core colour (what the eye sees with bloom
 * and tone mapping): violet driven toward white as intensity climbs.
 * Pure look-dev approximation — documented as such, not a renderer inverse.
 */
export function coreLit(emissive: number): string {
  return blendHex(CACHE_VIOLET, '#FFFFFF', Math.min(0.82, Math.max(0, emissive) * 0.28));
}

/* ---------------- copy-ready export ---------------- */

export function specJson(cfg: BenchConfig): string {
  const bd = BACKDROPS[cfg.backdrop];
  const core = coreLit(cfg.emissive);
  const floor = mulHex('#D8CDB4', bd.floorTint);
  return JSON.stringify(
    {
      source: 'signal-cache-bench',
      mirrors: [
        'src/game/SignalCaches.tsx (cache assembly)',
        'src/game/caches.ts (capture 13 m / hail 340 m)',
        'src/game/Sky.tsx (backdrop keyframes + storm sand blend)',
        '.hud-signal in src/ui/ui.css (hint chip)',
        'drawMinimap in src/ui/HUD.tsx (open diamond)',
      ],
      rule: '⟡ glyph + open diamond carry identity; lore-violet is reserved for codex finds; colour is never the only signal',
      shipped: SHIPPED,
      chip: CHIP,
      minimap: MINIMAP,
      tuning: { emissive: cfg.emissive, glimmer: cfg.glimmer, ring: cfg.ring },
      context: { backdrop: cfg.backdrop, storm: cfg.storm, ladder: cfg.ladder },
      measured: {
        coreVsHorizon: +contrast(core, bd.horizon).toFixed(2),
        coreVsFog: +contrast(core, bd.fog).toFixed(2),
        coreVsStormFog: +contrast(core, STORM_FOG_WALL).toFixed(2),
        glimmerVsHorizon: +contrast(composite(CACHE_VIOLET, cfg.glimmer, bd.horizon), bd.horizon).toFixed(2),
        ringVsGround: +contrast(composite(CACHE_VIOLET, cfg.ring, floor), floor).toFixed(2),
        chipTextVsPanel: +contrast(CHIP.text, composite(CHIP.panelBase, CHIP.bgAlpha, CHIP.bgOver)).toFixed(2),
        minimapDiamondVsDark: +contrast(
          composite(MINIMAP.diamond, MINIMAP.diamondAlpha, composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.darkUnderlay)),
          composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.darkUnderlay),
        ).toFixed(2),
        minimapDiamondVsSalt: +contrast(
          composite(MINIMAP.diamond, MINIMAP.diamondAlpha, composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.brightUnderlay)),
          composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.brightUnderlay),
        ).toFixed(2),
        separation: Object.fromEntries(
          MISSION_COLOURS.map((m) => [m.id, +colorDelta(CACHE_VIOLET, m.colour).toFixed(0)]),
        ),
      },
    },
    null,
    2,
  );
}

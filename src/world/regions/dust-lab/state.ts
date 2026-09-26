/**
 * Module-level lab state, read by the R3F scene every frame and written by the
 * control panel. Defaults mirror the shipped constants in src/game/DustTrail.tsx
 * so "game default" = what ships today; everything else is the upgrade path.
 */

export type SurfaceKind = 'salt' | 'sand' | 'glass';

export const SURFACES: SurfaceKind[] = ['salt', 'sand', 'glass'];

/** The constants that ship inside DustTrail.tsx today (source of truth). */
export const SHIPPED = {
  COUNT: 140,
  size: 0.9,
  opacity: 0.4,
  lifetime: 2.4,
  emitPerSpeed: 1.4, // emissions per second per m/s (capped at 60/s)
  emitCap: 60,
  spread: 0.8, // lateral spawn jitter, m
  behind: 1.4, // spawn offset behind the hull, m
  rise: 2.0, // mean vertical velocity, m/s
  slip: 0.12, // fraction of bike speed carried into particle drift
  turbulence: 0, // shipped build has none — this lab adds it
  drag: 0, // shipped build has none
  colors: { salt: '#EFE8D4', sand: '#D9B077', glass: '#7FD4C9' },
} as const;

export interface LabState {
  // emitter
  count: number; // live ring-buffer slots (max 2048)
  size: number;
  opacity: number;
  lifetime: number; // s
  emitPerSpeed: number;
  emitCap: number; // hard emissions/s ceiling
  spread: number;
  behind: number;
  rise: number; // mean upward velocity
  slip: number; // velocity carried from the bike
  turbulence: number; // sin-field wander strength
  drag: number; // velocity damping per second
  softFade: boolean; // shader age-fade (false = hard square points like PointsMaterial)
  // ghost bike
  bikeSpeed: number; // nominal cruise, m/s
  paused: boolean;
  boostUntil: number; // performance.now() deadline for a boost burst
  // surface palette
  salt: string;
  sand: string;
  glass: string;
}

export const DEFAULTS: LabState = {
  count: SHIPPED.COUNT,
  size: SHIPPED.size,
  opacity: SHIPPED.opacity,
  lifetime: SHIPPED.lifetime,
  emitPerSpeed: SHIPPED.emitPerSpeed,
  emitCap: SHIPPED.emitCap,
  spread: SHIPPED.spread,
  behind: SHIPPED.behind,
  rise: SHIPPED.rise,
  slip: SHIPPED.slip,
  turbulence: 0.35,
  drag: 0.35,
  softFade: true,
  bikeSpeed: 24,
  paused: false,
  boostUntil: 0,
  salt: SHIPPED.colors.salt,
  sand: SHIPPED.colors.sand,
  glass: SHIPPED.colors.glass,
};

/** The one mutable state object shared by scene + panel. */
export const lab: LabState = { ...DEFAULTS };

/** Aggregate stats the scene writes and the panel polls (~8 Hz). */
export const stats = {
  active: 0,
  emitPerSec: 0,
  bikeSpeed: 0,
  surface: 'sand' as SurfaceKind,
  fps: 0,
};

export interface Preset {
  name: string;
  note: string;
  set: Partial<LabState>;
}

export const PRESETS: Preset[] = [
  {
    name: 'Game default',
    note: 'exactly what ships in DustTrail.tsx',
    set: { ...DEFAULTS, turbulence: 0, drag: 0, softFade: false },
  },
  {
    name: 'Powder storm',
    note: 'dry season — huge soft plume',
    set: {
      count: 640, size: 1.5, opacity: 0.3, lifetime: 3.6, turbulence: 0.9,
      drag: 0.5, rise: 2.6, spread: 1.6, softFade: true,
    },
  },
  {
    name: 'Cold glass',
    note: 'thin electric skim on the fused lanes',
    set: {
      count: 220, size: 0.55, opacity: 0.62, lifetime: 1.3, turbulence: 1.6,
      drag: 0.1, rise: 1.1, spread: 0.4, glass: '#9BF5E8', softFade: true,
    },
  },
  {
    name: 'Fine haze',
    note: 'rep that reads from 200 m out',
    set: {
      count: 900, size: 2.4, opacity: 0.14, lifetime: 5.0, turbulence: 0.5,
      drag: 0.9, rise: 1.4, spread: 2.6, softFade: true,
    },
  },
];

/** JSON payload the Copy button produces — keys map onto DustTrail constants. */
export function exportPayload() {
  return {
    note: 'drop into src/game/DustTrail.tsx — SHIPPED keys map 1:1; turbulence/drag/softFade are the upgrade path',
    COUNT: lab.count,
    size: lab.size,
    opacity: lab.opacity,
    lifetime: lab.lifetime,
    emitPerSpeed: lab.emitPerSpeed,
    emitCap: lab.emitCap,
    spread: lab.spread,
    behind: lab.behind,
    rise: lab.rise,
    slip: lab.slip,
    turbulence: lab.turbulence,
    drag: lab.drag,
    softFade: lab.softFade,
    colors: { salt: lab.salt, sand: lab.sand, glass: lab.glass },
  };
}

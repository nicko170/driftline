/**
 * Storm Front Sandbox — shared module state.
 *
 * One mutable `lab` object is written by the control panel and read by the
 * scene every frame (dust-lab pattern). `bike` / `storm` / `stats` are the
 * sim's runtime scratch — no React re-renders, no per-frame allocations.
 *
 * Defaults mirror the shipped storm in src/game/MissionDirector.tsx so
 * "Game ch3 (shipped)" = what the game actually does today.
 */
import { fbm2, ridge2, smooth01, lerp } from '../../../lib/noise';

/* ================= shipped constants (source of truth = MissionDirector) ================= */

export const SHIPPED = {
  stormSpeed: 23, // base chase speed, m/s
  rubberband: 0.03, // extra speed per metre beyond 150 m of face distance
  catchCap: 9, // max rubber-band bonus, m/s
  radius: 150, // STORM_R — wall radius, m
  spawnBack: 460, // wall spawns this far behind the player
  feelRange: 420, // intensity = 1 - face/feelRange (audio/fog/shake range)
  wallHeight: 200, // inner shell height; outer shells scale 1.1×/1.2×
  shellOpacity: [0.22, 0.17, 0.12] as const,
  shellColors: ['#C98F4E', '#B97745', '#8A5335'] as const,
  churnOpacity: 0.4,
} as const;

/* ================= lab state ================= */

export interface LabState {
  // storm behaviour
  stormSpeed: number; // base chase m/s
  rubberband: number; // gain on (face - 150)
  catchCap: number; // clamp on rubber-band bonus
  radius: number; // wall radius R
  spawnBack: number; // spawn distance behind the bike
  feelRange: number; // proximity → intensity range
  // wall look
  wallHeight: number; // base shell height
  density: number; // opacity / particle-count / fog multiplier
  turbulence: number; // churn strength (particle sheet, shell wobble, fog flicker)
  // world / bike
  bikeTop: number; // bike top speed, m/s
  windStreaks: boolean;
  rumble: boolean; // procedural storm audio
  camMode: 'chase' | 'wide';
  autoRearm: boolean; // auto-release the wall again after catch/shelter
  fogBase: number; // clear-air fog density
}

export const DEFAULTS: LabState = {
  stormSpeed: SHIPPED.stormSpeed,
  rubberband: SHIPPED.rubberband,
  catchCap: SHIPPED.catchCap,
  radius: SHIPPED.radius,
  spawnBack: SHIPPED.spawnBack,
  feelRange: SHIPPED.feelRange,
  wallHeight: SHIPPED.wallHeight,
  density: 1,
  turbulence: 0.6,
  bikeTop: 34,
  windStreaks: true,
  rumble: false,
  camMode: 'chase',
  autoRearm: true,
  fogBase: 0.0016,
};

/** The one mutable state object shared by scene + panel. */
export const lab: LabState = { ...DEFAULTS };

/* ================= the pan (visuals and sim share one height function) ================= */

export const PAN_R = 640; // playable radius, m

export const shelter = { x: 0, z: 430, r: 26 };

export function panHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // hard flat pan with a whisper of unevenness…
  let h = fbm2(x * 0.012, z * 0.012, 2) * 0.9;
  // …rising into rim dunes outside the test apron
  h += smooth01((r - PAN_R) / 150) * Math.max(0, ridge2(x * 0.006 + 2.2, z * 0.006 - 4.1, 3) * 9);
  // the shelter pad sits level
  const d = Math.hypot(x - shelter.x, z - shelter.z);
  h = lerp(h, 0.35, smooth01((100 - d) / 55));
  return h;
}

/* ================= sim runtime (module scratch — written every frame) ================= */

export const bike = {
  x: 0, z: -60, y: 0,
  heading: 0, // 0 = +Z (toward shelter)
  speed: 0,
  vy: 0, hopY: 0,
  boostHeld: false,
};

export type SimStatus = 'free' | 'hunt' | 'caught' | 'sheltered';

export const storm = {
  active: false,
  x: 0, z: -8999,
  face: 9999, // distance from bike to the wall face (centre dist - radius)
  speed: 0,
  intensity: 0, // 0..1 proximity feel (drives fog/audio/tint)
};

export const stats = {
  status: 'free' as SimStatus,
  fps: 60,
  margin: 0, // rate of change of face distance, m/s (positive = gaining)
  runTime: 0,
  bestTime: 0,
  escapes: 0,
  attempts: 0,
  msg: '',
  msgUntil: 0,
};

/** One-shot timers the director keeps. */
export const sim = { rearmAt: 0, runStartedAt: 0, prevFace: 0 };

export function setMessage(msg: string, seconds = 2.6) {
  stats.msg = msg;
  stats.msgUntil = performance.now() + seconds * 1000;
}

/** Release the wall: spawn it `spawnBack` metres behind the bike, away from shelter. */
export function releaseStorm() {
  const dx = shelter.x - bike.x;
  const dz = shelter.z - bike.z;
  const len = Math.hypot(dx, dz) || 1;
  storm.x = bike.x - (dx / len) * lab.spawnBack;
  storm.z = bike.z - (dz / len) * lab.spawnBack;
  storm.active = true;
  storm.face = lab.spawnBack - lab.radius;
  storm.speed = 0;
  storm.intensity = 0;
  stats.status = 'hunt';
  stats.runTime = 0;
  stats.attempts += 1;
  sim.prevFace = storm.face;
  sim.runStartedAt = performance.now();
  setMessage('THE WALL IS RIDING', 2.2);
}

/** Call the wall off. */
export function recallStorm() {
  storm.active = false;
  storm.z = -8999;
  storm.face = 9999;
  storm.intensity = 0;
  if (stats.status === 'hunt') stats.status = 'free';
}

/* ================= presets ================= */

export interface Preset {
  name: string;
  note: string;
  set: Partial<LabState>;
}

export const PRESETS: Preset[] = [
  {
    name: 'Game ch3 (shipped)',
    note: 'exactly what MissionDirector.tsx does today',
    set: {
      stormSpeed: 23, rubberband: 0.03, catchCap: 9, radius: 150,
      spawnBack: 460, feelRange: 420, wallHeight: 200, density: 1,
      turbulence: 0, bikeTop: 34, fogBase: 0.0016,
    },
  },
  {
    name: 'First wall (gentle)',
    note: 'ch3-first-wall: teach the player storms mean run, not fight',
    set: {
      stormSpeed: 16, rubberband: 0.02, catchCap: 6, radius: 140,
      spawnBack: 520, feelRange: 480, wallHeight: 150, density: 0.85,
      turbulence: 0.4, bikeTop: 34,
    },
  },
  {
    name: "Black reach (ch5)",
    note: "MOTHER's season — fast, tall, hungry",
    set: {
      stormSpeed: 30, rubberband: 0.045, catchCap: 15, radius: 190,
      spawnBack: 430, feelRange: 520, wallHeight: 300, density: 1.45,
      turbulence: 1.3, bikeTop: 30, fogBase: 0.0024,
    },
  },
  {
    name: 'Geometry tune',
    note: 'no churn, thin haze — read the shell shapes cleanly',
    set: { turbulence: 0, density: 0.6, feelRange: 380, fogBase: 0.001 },
  },
];

/** JSON payload the Copy button produces — keys map onto MissionDirector constants. */
export function exportPayload() {
  return {
    note: 'drop into src/game/MissionDirector.tsx — STORM_* keys map 1:1; density/turbulence/windStreaks are the upgrade path',
    STORM_BASE_SPEED: lab.stormSpeed,
    STORM_RUBBERBAND_GAIN: lab.rubberband,
    STORM_CATCH_CAP: lab.catchCap,
    STORM_R: lab.radius,
    STORM_SPAWN_BACK: lab.spawnBack,
    STORM_FEEL_RANGE: lab.feelRange,
    wall: {
      shellHeights: [lab.wallHeight, lab.wallHeight * 1.1, lab.wallHeight * 1.2],
      shellOpacity: [0.22, 0.17, 0.12].map((o) => +(o * lab.density).toFixed(3)),
      shellColors: [...SHIPPED.shellColors],
      churnOpacity: +(SHIPPED.churnOpacity * lab.density).toFixed(3),
      turbulence: lab.turbulence,
      windStreaks: lab.windStreaks,
    },
    fogBase: lab.fogBase,
    bikeTopForBalance: lab.bikeTop,
  };
}

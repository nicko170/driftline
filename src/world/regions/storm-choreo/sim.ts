/**
 * Storm Choreo — pursuit sim core. Pure math, no React, no DOM.
 *
 * The storm step is an exact mirror of the shipped wall in
 * src/game/MissionDirector.tsx (storm objective):
 *
 *   face  = dist(stormCentre, courier) - STORM_R
 *   chase = STORM_BASE_SPEED + clamp((face - 150) * STORM_RUBBERBAND_GAIN,
 *                                    0, STORM_CATCH_CAP)
 *   wall hunts the courier's live position every tick; face <= 0 fails,
 *   dist(courier, shelter) < REACH * 1.8 (= 14.4 m, no slow gate) wins.
 *   At objective activation the wall spawns STORM_SPAWN_BACK (460 m) behind
 *   the courier, on the anti-shelter ray.
 *
 * The courier is a Monte Carlo stand-in for a player: straight-line intent
 * with reaction delay, throttle/steering noise, a panic dodge when the face
 * closes and a finite boost reserve that burns when things get loud.
 */

export const SHIPPED = {
  stormSpeed: 23, // STORM base chase m/s
  rubberGain: 0.03, // m/s bonus per metre beyond 150 m of face
  catchCap: 9, // max rubber-band bonus m/s
  radius: 150, // STORM_R
  spawnBack: 460, // spawn distance behind the courier at activation
  shelterR: 14.4, // REACH (8) * 1.8 — no slow gate on storm objectives
  killFace: 0, // face <= this fails the run
} as const;

export interface ChoreoParams {
  /* course — courier starts at (0,0); shelter at this offset on the pan */
  shelterX: number; // metres east
  shelterZ: number; // metres south (game convention)
  /* storm pursuit curve */
  stormSpeed: number;
  rubberGain: number;
  catchCap: number;
  radius: number;
  spawnBack: number;
  /* courier */
  bikeTop: number; // top speed m/s (stock ~34 per the sandbox)
  accel: number; // m/s²
  noise: number; // 0..1 — reaction, wobble, throttle discipline
  boostKick: number; // multiplier while panic-boosting
  boostTime: number; // seconds of boost reserve
  /* trials */
  trials: number;
  seed: number;
}

export const DEFAULTS: ChoreoParams = {
  shelterX: -948,
  shelterZ: 1156, // windspine:storm-gauge → saltmouth:gate-east (ch3-first-wall, 1495 m)
  stormSpeed: SHIPPED.stormSpeed,
  rubberGain: SHIPPED.rubberGain,
  catchCap: SHIPPED.catchCap,
  radius: SHIPPED.radius,
  spawnBack: SHIPPED.spawnBack,
  bikeTop: 34,
  accel: 9,
  noise: 0.35,
  boostKick: 1.25,
  boostTime: 2.4,
  trials: 384,
  seed: 20260926,
};

/** Real runs from shipped mission content — shelter offsets are true anchor deltas. */
export const PRESETS: { name: string; note: string; set: Partial<ChoreoParams> }[] = [
  {
    name: 'ch3 · The First Wall (shipped)',
    note: 'windspine:storm-gauge → saltmouth:gate-east · 1495 m · stock wall',
    set: {
      shelterX: -948, shelterZ: 1156,
      stormSpeed: 23, rubberGain: 0.03, catchCap: 9, radius: 150, spawnBack: 460,
      bikeTop: 34,
    },
  },
  {
    name: 'side · Storm Window',
    note: 'saltmouth:gate-east → windspine:survey-camp · 823 m',
    set: {
      shelterX: 568, shelterZ: -596,
      stormSpeed: 23, rubberGain: 0.03, catchCap: 9, radius: 150, spawnBack: 460,
      bikeTop: 34,
    },
  },
  {
    name: 'ch5 · Storm of Storms',
    note: 'glassroad:gate-south → mothersgate:approach · 854 m · black-reach tuning',
    set: {
      shelterX: 750, shelterZ: 408,
      stormSpeed: 30, rubberGain: 0.045, catchCap: 15, radius: 190, spawnBack: 430,
      bikeTop: 30,
    },
  },
  {
    name: 'Gentle teacher',
    note: 'first-time wall: wide berth, slow face, fast bike',
    set: {
      shelterX: 0, shelterZ: 780,
      stormSpeed: 16, rubberGain: 0.02, catchCap: 6, radius: 140, spawnBack: 540,
      bikeTop: 34,
    },
  },
];

/* ---------------- PRNG (seeded → slider tweaks don't reshuffle the deck) ---------------- */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- one trial ---------------- */

export type TrialOut = 'sheltered' | 'caught' | 'timeout';

export interface TrailPoint {
  t: number; x: number; z: number;
  sx: number; sz: number; // storm centre
  face: number; v: number;
}

export interface TrialResult {
  out: TrialOut;
  t: number;
  minFace: number;
  trace?: TrailPoint[];
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export function runTrial(p: ChoreoParams, rng: () => number, wantTrace = false): TrialResult {
  const dt = 1 / 30;
  // storm spawns on the anti-course ray, spawnBack metres behind the courier
  const cdA = Math.atan2(p.shelterZ, p.shelterX);
  let sx = -Math.cos(cdA) * p.spawnBack;
  let sz = -Math.sin(cdA) * p.spawnBack;
  let x = 0;
  let z = 0;
  let v = 0;
  // human factors, drawn once per trial from the same seeded deck
  const tReact = 0.25 + rng() * rng() * 2.4 * p.noise;
  const topEff = p.bikeTop * (1 - 0.09 * rng() * p.noise);
  const accel = p.accel * (1 - 0.12 * rng() * p.noise);
  let err = (rng() - 0.5) * 1.1 * p.noise;
  let boostLeft = p.boostTime;
  let t = 0;
  let face = Math.hypot(sx, sz) - p.radius;
  let minFace = face;
  const tr: TrailPoint[] | null = wantTrace ? [] : null;
  let out: TrialOut = 'timeout';

  for (; t < 260; ) {
    t += dt;
    /* --- courier --- */
    const toShelter = Math.atan2(p.shelterZ - z, p.shelterX - x);
    err += ((rng() * 2 - 1) * 2.0 * p.noise - err * 1.6) * dt;
    if (face < 160) {
      const away = Math.atan2(z - sz, x - sx);
      const dodge = wrap(away - toShelter);
      const w = (1 - face / 160) * (0.35 + 0.75 * p.noise);
      err += wrap(dodge - err) * w * 6 * dt;
    }
    const boosting = face < 220 && boostLeft > 0 && t > tReact;
    const target = t <= tReact ? 0 : topEff * (boosting ? p.boostKick : 1);
    if (v < target) v = Math.min(target, v + accel * dt);
    else v = Math.max(target, v - accel * 1.6 * dt);
    if (boosting) boostLeft -= dt;
    const h = toShelter + err;
    x += Math.cos(h) * v * dt;
    z += Math.sin(h) * v * dt;

    /* --- storm: exact MissionDirector mirror --- */
    const dx = x - sx;
    const dz = z - sz;
    const cd = Math.hypot(dx, dz) || 1;
    face = cd - p.radius;
    const chase = p.stormSpeed + clamp((face - 150) * p.rubberGain, 0, p.catchCap);
    sx += (dx / cd) * chase * dt;
    sz += (dz / cd) * chase * dt;
    if (face < minFace) minFace = face;
    if (tr) tr.push({ t, x, z, sx, sz, face, v });

    if (face <= SHIPPED.killFace) { out = 'caught'; break; }
    const ddx = x - p.shelterX;
    const ddz = z - p.shelterZ;
    if (ddx * ddx + ddz * ddz < SHIPPED.shelterR * SHIPPED.shelterR) { out = 'sheltered'; break; }
  }
  return { out, t, minFace, trace: tr ?? undefined };
}

/* ---------------- Monte Carlo ---------------- */

export interface Verdict {
  glyph: string;
  label: string;
  cls: 'bad' | 'sharp' | 'fair' | 'mild' | 'flat';
  note: string;
}

export function verdictFor(survival: number): Verdict {
  if (survival < 0.45)
    return { glyph: '▲', label: 'Funeral weather', cls: 'bad',
      note: 'The wall wins most runs. Back off spawn distance, speed or radius — or issue faster bikes.' };
  if (survival < 0.7)
    return { glyph: '⟡', label: 'Bloody — vet run', cls: 'sharp',
      note: 'Only aces walk away. Fine for a finale; cruel for a Tuesday posting.' };
  if (survival < 0.88)
    return { glyph: '◆', label: 'Tense but fair', cls: 'fair',
      note: 'Heart-rate territory: palms sweat, nobody drowns. Ship it.' };
  if (survival < 0.97)
    return { glyph: '▣', label: 'Comfortable commute', cls: 'mild',
      note: 'Tension sags. Shrink the spawn-back or wind the rubber-band up.' };
  return { glyph: '◉', label: 'Postage run', cls: 'flat',
    note: 'The wall is set dressing. Tighten the pursuit curve until it has opinions.' };
}

export const HIST_BINS = 24;
export const HIST_MAX_M = 720;

export interface MCResult {
  trials: number;
  sheltered: number;
  caught: number;
  timeouts: number;
  survival: number;
  medTime: number; // median clear time (s), 0 if nobody sheltered
  medFace: number;
  p10Face: number;
  p90Face: number;
  hist: Uint32Array; // survivors' minFace distribution over 0..HIST_MAX_M
  ms: number; // wall-clock time the batch took
  verdict: Verdict;
}

export function runMonteCarlo(p: ChoreoParams): MCResult {
  const t0 = performance.now();
  const rng = mulberry32(p.seed);
  let sheltered = 0;
  let caught = 0;
  let timeouts = 0;
  const faces: number[] = [];
  const times: number[] = [];
  const hist = new Uint32Array(HIST_BINS);
  for (let i = 0; i < p.trials; i++) {
    const r = runTrial(p, rng);
    if (r.out === 'sheltered') {
      sheltered++;
      times.push(r.t);
      const b = clamp(Math.floor((clamp(r.minFace, 0, HIST_MAX_M) / HIST_MAX_M) * HIST_BINS), 0, HIST_BINS - 1);
      hist[b]++;
    } else if (r.out === 'caught') caught++;
    else timeouts++;
    faces.push(r.minFace);
  }
  faces.sort((a, b) => a - b);
  times.sort((a, b) => a - b);
  const q = (arr: number[], f: number) =>
    arr.length === 0 ? 0 : arr[clamp(Math.floor(f * (arr.length - 1)), 0, arr.length - 1)];
  const survival = sheltered / p.trials;
  return {
    trials: p.trials,
    sheltered, caught, timeouts,
    survival,
    medTime: q(times, 0.5),
    medFace: q(faces, 0.5),
    p10Face: q(faces, 0.1),
    p90Face: q(faces, 0.9),
    hist,
    ms: performance.now() - t0,
    verdict: verdictFor(survival),
  };
}

/* ---------------- export payloads ---------------- */

export function exportObjectiveJson(p: ChoreoParams, mc: MCResult | null) {
  const runM = Math.round(Math.hypot(p.shelterX, p.shelterZ));
  return {
    _note:
      'Generated by /lab/storm-choreo. Merge objectives[] into the mission; the storm block maps 1:1 onto MissionDirector constants. Pick real start/shelter anchors and replace the <…> targets.',
    objectives: [
      { type: 'goto', target: '<start-anchor>', label: 'Stage at the marked start' },
      { type: 'storm', target: '<shelter-anchor>', label: `Outrun the wall — ${runM} m to shelter` },
    ],
    storm: {
      STORM_BASE_SPEED: +p.stormSpeed.toFixed(2),
      STORM_RUBBERBAND_GAIN: +p.rubberGain.toFixed(3),
      STORM_CATCH_CAP: +p.catchCap.toFixed(1),
      STORM_R: Math.round(p.radius),
      STORM_SPAWN_BACK: Math.round(p.spawnBack),
      STORM_SHELTER_R: SHIPPED.shelterR,
    },
    course: {
      shelterOffsetM: [Math.round(p.shelterX), Math.round(p.shelterZ)],
      runM,
    },
    courierAssumed: {
      topSpeedMs: +p.bikeTop.toFixed(1),
      accelMs2: +p.accel.toFixed(1),
      boostKick: +p.boostKick.toFixed(2),
      boostS: +p.boostTime.toFixed(1),
      humanNoise: p.noise,
    },
    tunedDifficulty: mc
      ? {
          trials: mc.trials,
          survival: +mc.survival.toFixed(3),
          verdict: mc.verdict.label,
          medClearS: +mc.medTime.toFixed(1),
          minFaceP10M: Math.round(mc.p10Face),
          minFaceP90M: Math.round(mc.p90Face),
        }
      : null,
  };
}

export function exportConstantsJson(p: ChoreoParams) {
  return {
    _note: 'drop into src/game/MissionDirector.tsx — keys map 1:1 onto the shipped storm constants',
    STORM_BASE_SPEED: +p.stormSpeed.toFixed(2),
    STORM_RUBBERBAND_GAIN: +p.rubberGain.toFixed(3),
    STORM_CATCH_CAP: +p.catchCap.toFixed(1),
    STORM_R: Math.round(p.radius),
    STORM_SPAWN_BACK: Math.round(p.spawnBack),
  };
}

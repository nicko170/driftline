/**
 * BOOST FEEDBACK LAB — synthetic telemetry + candidate boost-feedback curves.
 *
 * The bike here is driven by a *feel model* (an asymptotic speed approach using
 * the shipped constants from src/game/Bike.tsx), not the physics build — so a
 * scripted "tape" run is perfectly repeatable and the comparison charts can be
 * evaluated analytically. Feedback candidates are pure functions shared by the
 * 3D scene, the HUD and the charts; the id 'shipped' always means "what the
 * game does today" (CameraRig.tsx / audio.ts / HUD.tsx).
 */

/* Shipped constants — src/game/Bike.tsx (stock upgrade levels) */
export const V_MAX = 36;
export const V_MAX_BOOST = 1.38;
export const ACCEL = 24;
export const ACCEL_BOOST = 1.8;
export const DRAIN = 0.26; // boost meter per second
export const REGEN = 0.07;
export const BASE_FOV = 60;
export const KMH = 3.4; // the game HUD's m/s → km/h conversion

/** What every feedback channel consumes. `t` is the sim clock in seconds. */
export interface FeelState {
  v: number;          // m/s
  meter: number;      // 0..1 boost reserve
  boosting: boolean;
  boostTimer: number; // seconds since boost engaged (0 when not boosting)
  t: number;
}

export const makeFeel = (): FeelState => ({ v: 18, meter: 1, boosting: false, boostTimer: 0, t: 0 });

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** smoothstep 0→1 */
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** One integration step of the synthetic feel model (mutates s). */
export function step(s: FeelState, wantBoost: boolean, dt: number): void {
  const boosting = wantBoost && s.meter > 0.02;
  if (boosting) {
    s.meter = Math.max(0, s.meter - dt * DRAIN);
    s.boostTimer += dt;
  } else {
    s.meter = Math.min(1, s.meter + dt * REGEN);
    s.boostTimer = 0;
  }
  s.boosting = boosting;
  const target = V_MAX * (boosting ? V_MAX_BOOST : 1);
  const dv = ACCEL * (boosting ? ACCEL_BOOST : 1) * (1 - s.v / target) * dt;
  s.v = Math.max(0, s.v + dv);
  s.t += dt;
}

/* ------------------------------------------------------------------ */
/* Candidate channels                                                  */
/* ------------------------------------------------------------------ */

export interface CandidateDef {
  id: string;
  label: string;
  shipped?: boolean;
  note: string;
  formula: string;
}
export interface FovCandidate extends CandidateDef {
  f: (s: FeelState, punchSize: number) => number;
}
export interface ShakeCandidate extends CandidateDef {
  f: (s: FeelState) => number; // amplitude 0..1
}
export interface PitchCandidate extends CandidateDef {
  f: (s: FeelState) => number; // Hz
}

export const FOV_CANDIDATES: FovCandidate[] = [
  {
    id: 'shipped', label: 'A · Shipped kick', shipped: true,
    note: 'Speed term ×1.25 while boosting — a binary step. Cheap, but engagement reads as a jolt and release as a pop.',
    formula: '60 + min(13, v·0.24) · (boosting ? 1.25 : 1)',
    f: (s) => BASE_FOV + Math.min(13, s.v * 0.24) * (s.boosting ? 1.25 : 1),
  },
  {
    id: 'punch', label: 'B · Punch-in',
    note: 'Engagement overshoot decays to a smaller sustained kick. Sells the hit without fighting your eyes for the whole hold.',
    formula: '60 + min(13, v·0.24) + punch·e^(−2.6·tʰ) + min(6, v·0.10)',
    f: (s, punch) =>
      BASE_FOV +
      Math.min(13, s.v * 0.24) +
      (s.boosting ? punch * Math.exp(-2.6 * s.boostTimer) + Math.min(6, s.v * 0.10) : 0),
  },
  {
    id: 'blend', label: 'C · Speed-blend',
    note: 'No boost term at all — FOV follows speed alone, steeper, capped higher. Boost is felt because boost *is* speed.',
    formula: '60 + min(17, v·0.30)',
    f: (s) => BASE_FOV + Math.min(17, s.v * 0.30),
  },
  {
    id: 'elbow', label: 'D · Elbow ease',
    note: 'Shipped gain, but the boost factor eases in over the first ~0.45 s of the hold — the step becomes an elbow.',
    formula: '60 + min(13, v·0.24) · (1 + 0.25·smooth(tʰ/0.45))',
    f: (s) => BASE_FOV + Math.min(13, s.v * 0.24) * (1 + 0.25 * smooth(s.boostTimer / 0.45)),
  },
];

export const SHAKE_CANDIDATES: ShakeCandidate[] = [
  {
    id: 'shipped', label: 'A · Shipped silence', shipped: true,
    note: 'The shipped build only shakes on impacts. Boost is weightless — maybe too weightless.',
    formula: '0',
    f: () => 0,
  },
  {
    id: 'saturate', label: 'B · Saturate',
    note: 'Steady micro-rumble scaled by speed. Constant texture; at high amp it can read as camera noise.',
    formula: '0.30·smooth(v/40) while boosting',
    f: (s) => (s.boosting ? 0.30 * smooth(s.v / 40) : 0),
  },
  {
    id: 'ramp', label: 'C · Ramp it hot',
    note: 'Rumble builds over the hold — the cell running out of patience. Pairs naturally with drain pressure.',
    formula: '0.32·smooth(tʰ/2.2) + 0.10·smooth(v/40)',
    f: (s) =>
      s.boosting ? Math.min(1, 0.32 * smooth(s.boostTimer / 2.2) + 0.10 * smooth(s.v / 40)) : 0,
  },
  {
    id: 'gusty', label: 'D · Gusty',
    note: 'Rumble wanders in slow gusts — crosswind over the flats. The most alive, the least predictable.',
    formula: '0.26·smooth(v/30)·(0.55 + 0.45·sin(1.7t)·sin(0.37t + 1.3))',
    f: (s) =>
      s.boosting
        ? 0.26 *
          smooth(s.v / 30) *
          (0.55 + 0.45 * Math.sin(s.t * 1.7) * Math.sin(s.t * 0.37 + 1.3))
        : 0,
  },
];

export const PITCH_CANDIDATES: PitchCandidate[] = [
  {
    id: 'shipped', label: 'A · Shipped step', shipped: true,
    note: '+26 Hz the instant boost engages. Reads crisp; the identical step *down* on release can feel like a downgrade note.',
    formula: '46 + v·3.1 + thr·14 + (boosting ? 26 : 0)',
    f: (s) => 46 + s.v * 3.1 + 14 + (s.boosting ? 26 : 0),
  },
  {
    id: 'bloom', label: 'B · Bloom',
    note: 'Boost pitch climbs over the first second and keeps creeping — spool-up. Rewards long holds.',
    formula: '… + 26·smooth(tʰ/1.1) + 8·smooth(tʰ/4)',
    f: (s) =>
      46 + s.v * 3.1 + 14 +
      (s.boosting ? 26 * smooth(s.boostTimer / 1.1) + 8 * smooth(s.boostTimer / 4) : 0),
  },
  {
    id: 'lag', label: 'C · Turbo-lag',
    note: 'Pitch dips 10 Hz for a beat, then surges past shipped. Mechanical catch; very punchy, slightly comedic.',
    formula: '… − 10·e^(−9·tʰ) + 34·smooth((tʰ−0.15)/0.5)',
    f: (s) =>
      46 + s.v * 3.1 + 14 +
      (s.boosting ? -10 * Math.exp(-9 * s.boostTimer) + 34 * smooth((s.boostTimer - 0.15) / 0.5) : 0),
  },
  {
    id: 'wild', label: 'D · Strained song',
    note: 'A big step plus a slow warble that deepens through the hold — the bike sings under strain.',
    formula: '… + 30 + 7·sin(4π·tʰ)·smooth(tʰ/1.5)',
    f: (s) =>
      46 + s.v * 3.1 + 14 +
      (s.boosting ? 30 + 7 * Math.sin(s.boostTimer * Math.PI * 4) * smooth(s.boostTimer / 1.5) : 0),
  },
];

export const BAR_STYLES: CandidateDef[] = [
  {
    id: 'bar', label: 'A · Shipped bar', shipped: true,
    note: 'One continuous fill. Honest, glanceable, zero personality.',
    formula: 'width = meter·100%',
  },
  {
    id: 'cells', label: 'B · Charge cells',
    note: 'Eight amber cells that pop out one at a time — every lost cell lands as an event, with a tick. Quantised means memorable: “two cells left”.',
    formula: 'lit = ceil(meter·8)',
  },
  {
    id: 'ring', label: 'C · Halo ring',
    note: 'A 270° arc wrapped around the speed numerals — reserve lives where your eyes already are.',
    formula: 'arc = meter·270°',
  },
  {
    id: 'tach', label: 'D · Tach sweep',
    note: 'A needle gauge, the most diegetic of the four — but the needle hides the precise reserve at mid-deflection.',
    formula: 'needle θ = −120° + 240°·meter',
  },
];

/* ------------------------------------------------------------------ */
/* Scripted tape — a perfectly repeatable run for fair A/B comparisons */
/* ------------------------------------------------------------------ */

export const TAPE_S = 9;
/** boost is held [from, to] seconds into the tape */
export const TAPE_BOOST: [number, number] = [2.0, 6.4];
export const strobeInterval = 2.2;

export const tapeWantsBoost = (t: number): boolean => t >= TAPE_BOOST[0] && t <= TAPE_BOOST[1];

export interface TapeSample {
  t: number;
  v: number;
  meter: number;
  boosting: boolean;
  boostTimer: number;
}

let tapeCache: TapeSample[] | null = null;

/** Evaluate the tape run once at 30 Hz; cached (it's deterministic). */
export function evaluateTape(): TapeSample[] {
  if (tapeCache) return tapeCache;
  const s = makeFeel();
  const out: TapeSample[] = [];
  const dt = 1 / 30;
  for (let t = 0; t <= TAPE_S + dt / 2; t += dt) {
    out.push({ t, v: s.v, meter: s.meter, boosting: s.boosting, boostTimer: s.boostTimer });
    step(s, tapeWantsBoost(t), dt);
    s.t = t; // charts use t as the gust noise clock
  }
  tapeCache = out;
  return out;
}

/* ------------------------------------------------------------------ */
/* Shared lab state (module-level, like the other benches)             */
/* ------------------------------------------------------------------ */

export interface LabTuning {
  fov: string;
  shake: string;
  pitch: string;
  bar: string;
  punchSize: number; // ° for the punch-in candidate
  shakeAmp: number;  // amplitude multiplier for all shake candidates
  reducedShake: boolean;
  muted: boolean;
  wantBoost: boolean; // held by key/pointer (ignored while the tape drives)
  tape: boolean;
  tapeT: number;
  strobe: boolean; // alternate shipped ↔ candidates while the tape runs
}

export const lab: LabTuning = {
  fov: 'punch',
  shake: 'ramp',
  pitch: 'bloom',
  bar: 'cells',
  punchSize: 8,
  shakeAmp: 1,
  reducedShake: false,
  muted: false,
  wantBoost: false,
  tape: false,
  tapeT: 0,
  strobe: false,
};

/** The live feel state — owned by the scene's useFrame loop, shared here so
 * tape control and the HUD can reset/inspect it. */
export const simFeel: FeelState = makeFeel();
/** Distance scrolled down the strip (drives the treadmill). */
export const simScroll = { d: 0 };

/** Start/stop the scripted tape; starting rewinds to the exact tape opening. */
export function setTape(on: boolean): void {
  lab.tape = on;
  lab.tapeT = 0;
  Object.assign(simFeel, makeFeel());
}

/** Live numbers the scene writes each frame; the HUD/panel poll them. */
export const stats = {
  v: 0,
  meter: 1,
  boosting: false,
  boostTimer: 0,
  fov: BASE_FOV,
  pitch: 46,
  amp: 0,
  fps: 0,
};

/** True while the strobe is showing the *shipped* treatment of the tape. */
export function strobeOnShipped(l: LabTuning): boolean {
  return l.tape && l.strobe && Math.floor(l.tapeT / strobeInterval) % 2 === 1;
}

/** Resolve which candidate ids are *live right now* (strobe-aware). */
export function activeIds(l: LabTuning): { fov: string; shake: string; pitch: string; bar: string } {
  if (strobeOnShipped(l)) return { fov: 'shipped', shake: 'shipped', pitch: 'shipped', bar: 'bar' };
  return { fov: l.fov, shake: l.shake, pitch: l.pitch, bar: l.bar };
}

export const findFov = (id: string): FovCandidate =>
  FOV_CANDIDATES.find((c) => c.id === id) ?? FOV_CANDIDATES[0];
export const findShake = (id: string): ShakeCandidate =>
  SHAKE_CANDIDATES.find((c) => c.id === id) ?? SHAKE_CANDIDATES[0];
export const findPitch = (id: string): PitchCandidate =>
  PITCH_CANDIDATES.find((c) => c.id === id) ?? PITCH_CANDIDATES[0];
export const findBar = (id: string): CandidateDef =>
  BAR_STYLES.find((c) => c.id === id) ?? BAR_STYLES[0];

/** JSON payload the Copy button produces — a feedback preset for the game. */
export function exportPayload() {
  return {
    note: 'Boost feedback preset. shipped = current code in src/game/CameraRig.tsx / audio.ts / HUD.tsx; candidates are evaluated by the boost-feedback-lab bench.',
    fov: {
      id: lab.fov,
      formula: findFov(lab.fov).formula,
      punchSize: lab.punchSize,
      baseFov: BASE_FOV,
    },
    cameraShake: {
      id: lab.shake,
      formula: findShake(lab.shake).formula,
      amplitude: lab.shakeAmp,
      reducedShakeRespected: true,
    },
    enginePitch: { id: lab.pitch, formula: findPitch(lab.pitch).formula },
    boostBar: { id: lab.bar, formula: findBar(lab.bar).formula },
    telemetryModel: {
      vMax: V_MAX, vMaxBoostMult: V_MAX_BOOST, accel: ACCEL,
      accelBoostMult: ACCEL_BOOST, drainPerSec: DRAIN, regenPerSec: REGEN,
    },
    tape: { length: TAPE_S, boostWindow: TAPE_BOOST },
  };
}

/**
 * STORM OUTRUN SANDBOX — deterministic storm-chase tapes + tuning state.
 *
 * A scripted ghost courier (the stock feel model from src/game/Bike.tsx —
 * same constants the boost-feedback-lab uses) rides a fixed ~1160 m salt-pan
 * course to the shelter arch while a storm wall hunts it with the shipped
 * src/game/MissionDirector.tsx formula:
 *
 *   face  = dist(stormCentre, runner) − WALL_RADIUS
 *   chase = BASE_SPEED + clamp((face − RUBBER_REF) · RUBBER_GAIN, 0, CATCH_CAP)
 *
 * Pass A always runs the shipped constants; pass B runs the live `lab`
 * sliders. Both are evaluated offline at 120 Hz and recorded as 10 Hz ghost
 * traces, so A/B are perfectly repeatable and comparable by escape margin.
 * `exportSpec()` emits JSON whose keys map 1:1 onto the shipped storm code
 * (MissionDirector chase, Sky fog ramp, HUD tint ramp, audio setStorm mix).
 */
import { clamp01, fbm2, lerp, smooth01 } from '../../../lib/noise';

/* ------------------------------------------------------------------ */
/* Shipped constants (source of truth = the game files)                */
/* ------------------------------------------------------------------ */

/** src/game/MissionDirector.tsx — storm objective */
export const SHIPPED_CHASE = {
  baseSpeed: 23, // storm base chase speed, m/s
  rubberRef: 150, // face offset where the rubber-band starts paying out (m)
  rubberGain: 0.03, // extra m/s per metre of face beyond rubberRef
  catchCap: 9, // max rubber-band bonus (m/s) → shipped wall tops out at 32
  spawnBack: 460, // wall spawns this far behind the runner, anti-course ray
  wallRadius: 150, // STORM_R — face = centre distance − wallRadius
  shelterReach: 14.4, // REACH (8) × 1.8 — dive, no slow gate
  killFace: 0, // face crosses the runner → taken
} as const;

/** src/game/Sky.tsx — storm fog ramp (stormFog 0..1 eased toward target) */
export const SHIPPED_FOG = {
  fogRange: 500, // target = 1 − face/fogRange
  fogDensityAdd: 0.0042, // fog.density += stormFog × this
  fogEase: 2.5, // exponential ease rate /s
} as const;

/** src/ui/HUD.tsx + ui.css `.hud-storm-tint` */
export const SHIPPED_TINT = {
  tintRange: 380, // opacity = min(cap, (1 − face/range) · cap)
  tintCap: 0.55,
  urgentM: 200, // chip goes urgent below this
} as const;

/** src/audio/audio.ts → setStorm(intensity) */
export const SHIPPED_AUDIO = {
  intensityRange: 420, // intensity = clamp01(1 − face / this)
  rumbleMax: 0.22, // rumble gain cap
  windMax: 0.24, // wind gain cap (of intensity)
  rumbleHzMin: 34, // rumble osc freq at intensity 0
  rumbleHzAdd: 22, // + this × intensity
  easeTc: 0.3, // setTargetAtTime time constant
} as const;

/** Ghost bike feel model — src/game/Bike.tsx stock constants */
export const V_MAX = 36;
export const V_MAX_BOOST = 1.38;
export const ACCEL = 24;
export const ACCEL_BOOST = 1.8;
export const DRAIN = 0.26; // boost meter per second
export const REGEN = 0.07;

/* ------------------------------------------------------------------ */
/* The course — a fixed salt-pan line with two honest bends            */
/* ------------------------------------------------------------------ */

const DS = 2; // resample step (m)
const CTRL: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -200],
  [70, -460],
  [70, -640],
  [-30, -880],
  [0, -1130],
];

const BEND_GAIN = 46; // curvature → speed-cap bite

export interface Course {
  n: number;
  x: Float64Array;
  z: Float64Array;
  s: Float64Array; // cumulative arclength
  kappa: Float64Array; // curvature (rad/m, signed)
  length: number;
}

function buildCourse(): Course {
  // walk the polyline at DS steps
  const pts: number[][] = [[CTRL[0][0], CTRL[0][1]]];
  for (let i = 1; i < CTRL.length; i++) {
    const [ax, az] = pts[pts.length - 1];
    const [bx, bz] = CTRL[i];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.round(len / DS));
    for (let k = 1; k <= steps; k++) {
      pts.push([ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps]);
    }
  }
  // box-smooth the resample (endpoints pinned) so bends read as arcs
  let cur = pts;
  for (let pass = 0; pass < 5; pass++) {
    const next: number[][] = [cur[0]];
    for (let i = 1; i < cur.length - 1; i++) {
      let sx = 0;
      let sz = 0;
      let c = 0;
      for (let j = Math.max(0, i - 3); j <= Math.min(cur.length - 1, i + 3); j++) {
        sx += cur[j][0];
        sz += cur[j][1];
        c++;
      }
      next.push([sx / c, sz / c]);
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  const n = cur.length;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = cur[i][0];
    z[i] = cur[i][1];
    s[i] = i === 0 ? 0 : s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  }
  const kappa = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    const h0 = Math.atan2(x[i] - x[i - 1], z[i] - z[i - 1]);
    const h1 = Math.atan2(x[i + 1] - x[i], z[i + 1] - z[i]);
    let dh = h1 - h0;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    kappa[i] = dh / Math.max(0.001, s[i + 1] - s[i - 1]);
  }
  kappa[0] = kappa[1] ?? 0;
  kappa[n - 1] = kappa[n - 2] ?? 0;
  return { n, x, z, s, kappa, length: s[n - 1] };
}

export const COURSE = buildCourse();
export const SHELTER = {
  x: COURSE.x[COURSE.n - 1],
  z: COURSE.z[COURSE.n - 1],
};

/** Interpolated position at arclength `dist` (clamped to the course). */
export function pathAt(dist: number, out: { x: number; z: number }): void {
  const c = COURSE;
  const d = Math.max(0, Math.min(c.length, dist));
  let j = Math.min(c.n - 2, Math.max(0, Math.floor((d / c.length) * (c.n - 1))));
  while (j < c.n - 2 && c.s[j + 1] < d) j++;
  while (j > 0 && c.s[j] > d) j--;
  const t = c.s[j + 1] > c.s[j] ? (d - c.s[j]) / (c.s[j + 1] - c.s[j]) : 0;
  out.x = lerp(c.x[j], c.x[j + 1], t);
  out.z = lerp(c.z[j], c.z[j + 1], t);
}

export function kappaAt(dist: number): number {
  const d = Math.max(0, Math.min(COURSE.length, dist));
  const i = Math.min(COURSE.n - 1, Math.round((d / COURSE.length) * (COURSE.n - 1)));
  return COURSE.kappa[i];
}

/** The pan — mostly flat salt with a whisper of unevenness, rim dunes beyond. */
export function panHeight(x: number, z: number): number {
  const r = Math.hypot(x - 0, z + 560);
  let h = fbm2(x * 0.012, z * 0.012, 2) * 0.9;
  h += smooth01((r - 1350) / 260) * Math.max(0, fbm2(x * 0.004 + 2.2, z * 0.004 - 4.1, 3) * 16);
  // the course apron is graded flat-ish; the shelter pad is level
  h = lerp(h, 0.35, smooth01((120 - Math.hypot(x - SHELTER.x, z - SHELTER.z)) / 70));
  return h;
}

/* ------------------------------------------------------------------ */
/* Ghost script — who is riding, and how                               */
/* ------------------------------------------------------------------ */

export type PilotId = 'rookie' | 'stock' | 'ace';
export interface Pilot {
  label: string;
  throttle: number; // cruise fraction of V_MAX out of bends
  boostMult: number; // scales the scripted boost windows
  bendSkill: number; // divides the curvature speed cap bite
  note: string;
}
export const PILOTS: Record<PilotId, Pilot> = {
  rookie: {
    label: 'Rookie',
    throttle: 0.78,
    boostMult: 0.6,
    bendSkill: 0.8,
    note: 'Fresh bond, heavy thumb. Under-drives the bends, wastes the cells early.',
  },
  stock: {
    label: 'Stock courier',
    throttle: 0.92,
    boostMult: 1,
    bendSkill: 1,
    note: 'The reference rider — what the mission math should be tuned against.',
  },
  ace: {
    label: 'Ace',
    throttle: 1,
    boostMult: 1.3,
    bendSkill: 1.18,
    note: 'Rill Davenant on a good day. If the ace can’t escape, the mission is a killer.',
  },
};

/** Scripted boost sectors in course metres [start, end]; pilot boostMult stretches them. */
export const BOOST_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [150, 310],
  [585, 720],
  [960, 1090],
];

/** The second-hand bike coughs once — a scripted hesitation mid-course. */
export const STUMBLE = { at: 470, len: 16, throttle: 0.5 } as const;

/* ------------------------------------------------------------------ */
/* Tuning state (module-level, dust-lab pattern)                        */
/* ------------------------------------------------------------------ */

export interface LabParams {
  // MissionDirector.tsx chase
  baseSpeed: number;
  rubberRef: number;
  rubberGain: number;
  catchCap: number;
  spawnBack: number;
  wallRadius: number;
  // Sky.tsx fog ramp
  fogRange: number;
  fogDensityAdd: number;
  fogEase: number;
  // HUD.tsx screen tint
  tintRange: number;
  tintCap: number;
  // audio.ts setStorm mix
  audioRange: number;
  rumbleMax: number;
  windMax: number;
  rumbleHzMin: number;
  rumbleHzAdd: number;
  easeTc: number;
  // ghost
  pilot: PilotId;
}

export const lab: LabParams = {
  baseSpeed: SHIPPED_CHASE.baseSpeed,
  rubberRef: SHIPPED_CHASE.rubberRef,
  rubberGain: SHIPPED_CHASE.rubberGain,
  catchCap: SHIPPED_CHASE.catchCap,
  spawnBack: SHIPPED_CHASE.spawnBack,
  wallRadius: SHIPPED_CHASE.wallRadius,
  fogRange: SHIPPED_FOG.fogRange,
  fogDensityAdd: SHIPPED_FOG.fogDensityAdd,
  fogEase: SHIPPED_FOG.fogEase,
  tintRange: SHIPPED_TINT.tintRange,
  tintCap: SHIPPED_TINT.tintCap,
  audioRange: SHIPPED_AUDIO.intensityRange,
  rumbleMax: SHIPPED_AUDIO.rumbleMax,
  windMax: SHIPPED_AUDIO.windMax,
  rumbleHzMin: SHIPPED_AUDIO.rumbleHzMin,
  rumbleHzAdd: SHIPPED_AUDIO.rumbleHzAdd,
  easeTc: SHIPPED_AUDIO.easeTc,
  pilot: 'stock',
};

export interface Preset {
  id: string;
  name: string;
  note: string;
  set: Partial<LabParams>;
}
export const PRESETS: Preset[] = [
  {
    id: 'shipped',
    name: 'Game ch3 · shipped',
    note: 'exactly what MissionDirector.tsx does today',
    set: {
      baseSpeed: 23, rubberRef: 150, rubberGain: 0.03, catchCap: 9,
      spawnBack: 460, wallRadius: 150, fogRange: 500, fogDensityAdd: 0.0042,
      fogEase: 2.5, tintRange: 380, tintCap: 0.55, audioRange: 420,
      rumbleMax: 0.22, windMax: 0.24, rumbleHzMin: 34, rumbleHzAdd: 22, easeTc: 0.3,
    },
  },
  {
    id: 'first-wall',
    name: 'First wall · teach',
    note: 'ch3-first-wall: teach that storms mean run, not fight — generous but real',
    set: { baseSpeed: 18, rubberGain: 0.02, catchCap: 6, spawnBack: 540, wallRadius: 140, tintCap: 0.5 },
  },
  {
    id: 'mean-season',
    name: 'Mean season · ch5',
    note: "MOTHER's season: fast, low warning, hungry face — ace riders only",
    set: { baseSpeed: 30, rubberGain: 0.045, catchCap: 15, spawnBack: 430, wallRadius: 190, audioRange: 480 },
  },
  {
    id: 'slow-burn',
    name: 'Slow burn · long fuse',
    note: 'spawns far out but never stops gaining — dread instead of panic',
    set: { baseSpeed: 19, rubberGain: 0.05, catchCap: 16, spawnBack: 660, wallRadius: 165, fogRange: 650 },
  },
];

/* ------------------------------------------------------------------ */
/* Deterministic tape evaluation                                        */
/* ------------------------------------------------------------------ */

const DT = 1 / 120;
export const REC_HZ = 10;
const REC_EVERY = 120 / REC_HZ;
const MAXT = 140;

export type OutcomeKind = 'escaped' | 'taken' | 'timeout';
export interface Outcome {
  kind: OutcomeKind;
  t: number; // run duration (s)
  minFace: number; // closest the face ever got (m)
  marginM: number; // face distance at the moment of escape (0 if taken)
  wallAtShelterS: number | null; // seconds after escape until the face reaches the shelter
  takenAtM: number | null; // course distance where taken
}

export interface Trace {
  n: number;
  t: Float32Array;
  rx: Float32Array;
  rz: Float32Array;
  sx: Float32Array;
  sz: Float32Array;
  face: Float32Array;
  v: Float32Array;
  boost: Uint8Array;
  outcome: Outcome;
}

interface ChaseParams {
  baseSpeed: number;
  rubberRef: number;
  rubberGain: number;
  catchCap: number;
  spawnBack: number;
  wallRadius: number;
}

const _pos = { x: 0, z: 0 };

export function evaluate(chase: ChaseParams, pilot: Pilot): Trace {
  const cap = Math.ceil(MAXT * REC_HZ) + 8;
  const t = new Float32Array(cap);
  const rx = new Float32Array(cap);
  const rz = new Float32Array(cap);
  const sx = new Float32Array(cap);
  const sz = new Float32Array(cap);
  const face = new Float32Array(cap);
  const vv = new Float32Array(cap);
  const boost = new Uint8Array(cap);

  // scaled boost windows for this pilot
  const windows = BOOST_WINDOWS.map(([a, b]) => [a, a + (b - a) * pilot.boostMult] as const);

  // spawn: on the anti-course ray behind the runner (MissionDirector mirror)
  pathAt(0, _pos);
  let stormX = _pos.x;
  let stormZ = _pos.z;
  {
    const dx = SHELTER.x - _pos.x;
    const dz = SHELTER.z - _pos.z;
    const len = Math.hypot(dx, dz) || 1;
    stormX = _pos.x - (dx / len) * chase.spawnBack;
    stormZ = _pos.z - (dz / len) * chase.spawnBack;
  }

  const TAIL = 2.6; // keep the tape rolling past the outcome so replays show it
  let s = 0;
  let v = 2;
  let meter = 1;
  let time = 0;
  let n = 0;
  let step = 0;
  let minFace = Infinity;
  let endAt: number | null = null;
  let outcome: Outcome = { kind: 'timeout', t: MAXT, minFace: 0, marginM: 0, wallAtShelterS: null, takenAtM: null };

  const record = (boosting: boolean) => {
    if (n >= cap) return;
    t[n] = time;
    rx[n] = _pos.x;
    rz[n] = _pos.z;
    sx[n] = stormX;
    sz[n] = stormZ;
    face[n] = Math.hypot(_pos.x - stormX, _pos.z - stormZ) - chase.wallRadius;
    vv[n] = v;
    boost[n] = boosting ? 1 : 0;
    n++;
  };

  record(false);
  let boosting = false;
  while (time < MAXT) {
    const running = endAt === null;
    if (running) {
      pathAt(s, _pos);
      boosting = meter > 0.02 && windows.some(([a, b]) => s >= a && s <= b);
      meter = Math.max(0, Math.min(1, meter + (boosting ? -DRAIN : REGEN) * DT));
      const stumbling = s >= STUMBLE.at && s <= STUMBLE.at + STUMBLE.len;
      const thr = pilot.throttle * (stumbling ? STUMBLE.throttle : 1);
      const bend = Math.max(0.55, 1 - (Math.abs(kappaAt(s)) * BEND_GAIN) / pilot.bendSkill);
      const target = Math.max(4, V_MAX * thr * (boosting ? V_MAX_BOOST : 1) * bend);
      v += ACCEL * (boosting ? ACCEL_BOOST : 1) * (1 - v / target) * DT;
      v = Math.max(0.5, v);
      s = Math.min(COURSE.length, s + v * DT);
      pathAt(s, _pos);
    } else {
      // taken riders dig out, escaped riders hold at the arch — the wall doesn't care
      boosting = false;
      v = Math.max(0, v - 40 * DT);
    }

    // the wall hunts (exact MissionDirector formula)
    const dx = _pos.x - stormX;
    const dz = _pos.z - stormZ;
    const cd = Math.hypot(dx, dz) || 1;
    const f = cd - chase.wallRadius;
    if (running) minFace = Math.min(minFace, f);
    const chaseV =
      chase.baseSpeed + Math.min(Math.max((f - chase.rubberRef) * chase.rubberGain, 0), chase.catchCap);
    stormX += (dx / cd) * chaseV * DT;
    stormZ += (dz / cd) * chaseV * DT;

    time += DT;
    step++;
    if (step % REC_EVERY === 0) record(boosting);

    if (running) {
      const dShelter = Math.hypot(_pos.x - SHELTER.x, _pos.z - SHELTER.z);
      if (dShelter < SHIPPED_CHASE.shelterReach) {
        // escaped — project the wall onto the shelter to time the safety margin
        let extra = 0;
        let wsx = stormX;
        let wsz = stormZ;
        let wallFaceAtShelter = Math.hypot(wsx - SHELTER.x, wsz - SHELTER.z) - chase.wallRadius;
        while (wallFaceAtShelter > 0 && extra < 25) {
          const wx = SHELTER.x - wsx;
          const wz = SHELTER.z - wsz;
          const wd = Math.hypot(wx, wz) || 1;
          const wv =
            chase.baseSpeed +
            Math.min(Math.max((wallFaceAtShelter - chase.rubberRef) * chase.rubberGain, 0), chase.catchCap);
          wsx += (wx / wd) * wv * DT;
          wsz += (wz / wd) * wv * DT;
          wallFaceAtShelter = Math.hypot(wsx - SHELTER.x, wsz - SHELTER.z) - chase.wallRadius;
          extra += DT;
        }
        outcome = { kind: 'escaped', t: time, minFace, marginM: f, wallAtShelterS: extra, takenAtM: null };
        endAt = time;
      } else if (f <= SHIPPED_CHASE.killFace) {
        outcome = { kind: 'taken', t: time, minFace, marginM: 0, wallAtShelterS: null, takenAtM: s };
        endAt = time;
      }
    }
    if (endAt !== null && time >= endAt + TAIL) break;
  }
  if (endAt === null) outcome = { kind: 'timeout', t: MAXT, minFace, marginM: 0, wallAtShelterS: null, takenAtM: null };
  if (step % REC_EVERY !== 0) record(boosting);

  return {
    n,
    t: t.subarray(0, n),
    rx: rx.subarray(0, n),
    rz: rz.subarray(0, n),
    sx: sx.subarray(0, n),
    sz: sz.subarray(0, n),
    face: face.subarray(0, n),
    v: vv.subarray(0, n),
    boost: boost.subarray(0, n),
    outcome,
  };
}

/* A = shipped chase constants, B = live candidate. Same pilot both sides. */
export const traces: { A: Trace | null; B: Trace | null; version: number } = {
  A: null,
  B: null,
  version: 0,
};

export function evaluateAll(): void {
  const p = PILOTS[lab.pilot];
  traces.A = evaluate(SHIPPED_CHASE, p);
  traces.B = evaluate(lab, p);
  traces.version++;
}

let evalTimer = 0;
/** Debounced re-eval (sliders drag continuously; the tape is cheap but not free). */
export function scheduleEval(): void {
  window.clearTimeout(evalTimer);
  evalTimer = window.setTimeout(evaluateAll, 70);
}

/* ------------------------------------------------------------------ */
/* Playback runtime (written by the scene director every frame)         */
/* ------------------------------------------------------------------ */

export type PassId = 'A' | 'B';
export type ViewMode = 'A' | 'B' | 'both';

export const rt = {
  mode: 'both' as ViewMode,
  t: 0,
  playing: true,
  speed: 1,
  /** incremented whenever the tape should restart from zero */
  restart: 0,
};

export interface LivePass {
  x: number;
  z: number;
  hx: number; // heading unit vector
  hz: number;
  sx: number;
  sz: number;
  face: number;
  v: number;
  boost: boolean;
  done: boolean;
  vis: boolean;
}

const mkLive = (): LivePass => ({
  x: 0, z: 0, hx: 0, hz: -1, sx: 0, sz: 0, face: 9999, v: 0, boost: false, done: false, vis: false,
});
export const live: Record<PassId, LivePass> = { A: mkLive(), B: mkLive() };

/** Fog/glow easing state for the atmosphere ramp (module scratch). */
export const fogState = { mix: 0 };

export function sampleTrace(tr: Trace | null, tSec: number, out: LivePass): void {
  if (!tr || tr.n === 0) {
    out.vis = false;
    return;
  }
  out.vis = true;
  const i = Math.min(tr.n - 1, Math.max(0, Math.floor(tSec * REC_HZ)));
  out.x = tr.rx[i];
  out.z = tr.rz[i];
  out.sx = tr.sx[i];
  out.sz = tr.sz[i];
  out.face = tr.face[i];
  out.v = tr.v[i];
  out.boost = tr.boost[i] === 1;
  const j = Math.min(tr.n - 1, i + 2);
  const dx = tr.rx[j] - tr.rx[i];
  const dz = tr.rz[j] - tr.rz[i];
  const len = Math.hypot(dx, dz) || 1;
  out.hx = dx / len;
  out.hz = dz / len;
  out.done = tSec >= tr.t[tr.n - 1];
}

/** The face distance the HUD/audio should "feel" for the current mode. */
export function monitorFace(): number {
  if (rt.mode === 'A') return live.A.face;
  if (rt.mode === 'B') return live.B.face;
  // both: the nearer wall owns the mix (that's what you'd hear riding it)
  const a = live.A.vis ? live.A.face : Infinity;
  const b = live.B.vis ? live.B.face : Infinity;
  return Math.min(a, b);
}

/* ------------------------------------------------------------------ */
/* Contrast / legibility math (WCAG ratios, source-over compositing)    */
/* ------------------------------------------------------------------ */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function ch(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function relLum(c: Rgb): number {
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** source-over: fg at alpha over bg → composited colour */
export function over(fg: Rgb, fgA: number, bg: Rgb): Rgb {
  return {
    r: fg.r * fgA + bg.r * (1 - fgA),
    g: fg.g * fgA + bg.g * (1 - fgA),
    b: fg.b * fgA + bg.b * (1 - fgA),
  };
}

/* The shipped tint gradient, replicated from ui.css `.hud-storm-tint`:
 *   radial-gradient(120% 100% at 50% 120%, rgba(179,80,46,0.5) 0%, transparent 60%)
 *   linear-gradient(0deg, rgba(217,164,91,0.18) 0%, transparent 45%)
 * (radial layer paints on top). We sample it at three screen points. */
const RUST_TINT = hexToRgb('#B3502E');
const SAND_TINT = hexToRgb('#D9A45B');

/** alpha of each tint layer at screen point (x, y) — 0..1, y measured from top. */
export function tintAlphaAt(x: number, yTop: number): { rustA: number; sandA: number } {
  const g = Math.min(1, Math.hypot((x - 0.5) / 1.2, (yTop - 1.2) / 1.0));
  const rustA = 0.5 * clamp01((0.6 - g) / 0.6);
  const posUp = 1 - yTop; // 0 at bottom → 1 at top
  const sandA = 0.18 * clamp01(1 - posUp / 0.45);
  return { rustA, sandA };
}

/** Screen-tint overall opacity for a face distance, under the current lab ramp. */
export function tintOpacity(faceDist: number, p = lab): number {
  return Math.min(p.tintCap, Math.max(0, 1 - faceDist / p.tintRange) * p.tintCap);
}

/** Backdrop colours on the bench stage (dusk burn). */
export const BACKDROP = {
  skyTop: hexToRgb('#322A4A'), // violet, chip zone
  pan: hexToRgb('#8A6A44'), // dusk-lit salt where the waypoint diamond floats
  map: hexToRgb('#241C33'), // track-map paper
} as const;

/** Composite the tint stack over a backdrop at a screen point and face distance. */
export function tintedBackdrop(base: Rgb, x: number, yTop: number, faceDist: number): Rgb {
  const o = tintOpacity(faceDist);
  const { rustA, sandA } = tintAlphaAt(x, yTop);
  let c = over(SAND_TINT, sandA * o, base); // linear layer first (bottom)
  c = over(RUST_TINT, rustA * o, c); // radial layer on top
  return c;
}

/* HUD colours we audit */
export const HUD_COLORS = {
  chipIdle: hexToRgb('#D9A45B'), // --sand
  chipUrgent: hexToRgb('#E4572E'), // --danger
  waypoint: hexToRgb('#FFB454'), // --amber shelter diamond
  discEdge: hexToRgb('#FF7A4D'), // storm wedge edge (compass-minimap storm palette)
} as const;

/* ------------------------------------------------------------------ */
/* Export spec — keys map 1:1 onto the shipped storm code              */
/* ------------------------------------------------------------------ */

function outcomeSummary(o: Outcome | undefined) {
  if (!o) return null;
  return o.kind === 'escaped'
    ? { outcome: 'escaped', runTimeS: +o.t.toFixed(2), minFaceM: +o.minFace.toFixed(1), escapeMarginM: +o.marginM.toFixed(1), wallReachesShelterAfterS: +(o.wallAtShelterS ?? 0).toFixed(2) }
    : o.kind === 'taken'
      ? { outcome: 'taken', takenAtCourseM: +(o.takenAtM ?? 0).toFixed(0), runTimeS: +o.t.toFixed(2), minFaceM: +o.minFace.toFixed(1) }
      : { outcome: 'timeout', runTimeS: o.t };
}

export function exportSpec(): string {
  const p = PILOTS[lab.pilot];
  const payload = {
    _note:
      'Generated by /lab/storm-outrun-sandbox. Keys map 1:1 onto shipped storm code — ' +
      'MissionDirector.tsx (chase), Sky.tsx (fog ramp), HUD.tsx + ui.css .hud-storm-tint (screen tint), ' +
      'audio.ts setStorm (wind mix). Verified against a deterministic ghost tape; see `verification`.',
    'src/game/MissionDirector.tsx': {
      STORM_BASE_SPEED: +lab.baseSpeed.toFixed(2),
      STORM_RUBBER_REF_M: +lab.rubberRef.toFixed(1),
      STORM_RUBBER_GAIN: +lab.rubberGain.toFixed(4),
      STORM_CATCH_CAP: +lab.catchCap.toFixed(2),
      STORM_SPAWN_BACK: +lab.spawnBack.toFixed(0),
      STORM_R: +lab.wallRadius.toFixed(1),
      STORM_KILL_FACE: SHIPPED_CHASE.killFace,
      SHELTER_REACH_MULT: 1.8,
      _formula: 'chase = BASE + clamp((face - REF) * GAIN, 0, CAP); face = centreDist - STORM_R',
    },
    'src/game/Sky.tsx': {
      STORM_FOG_RANGE: +lab.fogRange.toFixed(0),
      STORM_FOG_DENSITY_ADD: +lab.fogDensityAdd.toFixed(5),
      STORM_FOG_EASE: +lab.fogEase.toFixed(2),
    },
    'src/ui/HUD.tsx + ui.css .hud-storm-tint': {
      TINT_RANGE: +lab.tintRange.toFixed(0),
      TINT_CAP: +lab.tintCap.toFixed(2),
      URGENT_BELOW_M: SHIPPED_TINT.urgentM,
    },
    'src/audio/audio.ts setStorm': {
      INTENSITY_RANGE_M: +lab.audioRange.toFixed(0),
      RUMBLE_MAX_GAIN: +lab.rumbleMax.toFixed(3),
      WIND_MAX_GAIN: +lab.windMax.toFixed(3),
      RUMBLE_HZ: [+lab.rumbleHzMin.toFixed(0), +(lab.rumbleHzMin + lab.rumbleHzAdd).toFixed(0)],
      EASE_TC_S: +lab.easeTc.toFixed(2),
    },
    ghostTape: {
      course: 'saltpan-outrun-1160m',
      courseLengthM: +COURSE.length.toFixed(0),
      pilot: lab.pilot,
      pilotSpec: { throttle: p.throttle, boostMult: p.boostMult, bendSkill: p.bendSkill },
      bikeConstants: { V_MAX, V_MAX_BOOST, ACCEL, ACCEL_BOOST, DRAIN, REGEN },
      boostWindowsM: BOOST_WINDOWS,
      stumble: STUMBLE,
    },
    verification: {
      passA_shipped: outcomeSummary(traces.A?.outcome),
      passB_candidate: outcomeSummary(traces.B?.outcome),
    },
  };
  return JSON.stringify(payload, null, 2);
}

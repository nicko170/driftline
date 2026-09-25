/**
 * Palette keyframes for the DRIFTLINE day/night cycle — mirrors src/game/Sky.tsx.
 * Pure-TS sampling (no three) so the DOM panel and the R3F scene share one source.
 */

export interface Key {
  t: number;
  phase: string;
  skyTop: string;
  horizon: string;
  fog: string;
  sun: string;
  sunI: number;
  ambI: number;
}

export const KEYS: Key[] = [
  { t: 0.0,  phase: 'night',     skyTop: '#14101F', horizon: '#2A2140', fog: '#241C33', sun: '#8899DD', sunI: 0.25, ambI: 0.5 },
  { t: 0.22, phase: 'pre-dawn',  skyTop: '#1B1730', horizon: '#4A2E55', fog: '#332847', sun: '#C9A2FF', sunI: 0.3,  ambI: 0.55 },
  { t: 0.28, phase: 'dawn',      skyTop: '#7E5A8C', horizon: '#E8915A', fog: '#D9A08A', sun: '#FFB454', sunI: 1.1,  ambI: 0.7 },
  { t: 0.36, phase: 'morning',   skyTop: '#87B8C4', horizon: '#E8D5AE', fog: '#DCC7A0', sun: '#FFF2D8', sunI: 1.6,  ambI: 0.85 },
  { t: 0.5,  phase: 'midday',    skyTop: '#7FB4BE', horizon: '#E4D7BE', fog: '#D9C6A2', sun: '#FFEDC4', sunI: 1.7,  ambI: 0.9 },
  { t: 0.66, phase: 'afternoon', skyTop: '#8FAEC0', horizon: '#E0C090', fog: '#CFB490', sun: '#FFE8C0', sunI: 1.4,  ambI: 0.8 },
  { t: 0.78, phase: 'dusk',      skyTop: '#6E4E78', horizon: '#E07B4A', fog: '#C98A6E', sun: '#FF9E5A', sunI: 1.1,  ambI: 0.7 },
  { t: 0.86, phase: 'twilight',  skyTop: '#2A2140', horizon: '#6E3E5C', fog: '#4A3552', sun: '#D07B5A', sunI: 0.5,  ambI: 0.55 },
];

/** Shared live state: the panel writes, the scene reads every frame. */
export const tuner = {
  t: 0.32,          // time of day, 0..1 (0 = midnight-ish, 0.5 = midday)
  playing: true,
  speed: 2,         // full cycles per minute
  fogDensity: 16,   // FogExp2 density × 10⁴
  sunGain: 1,       // sun intensity multiplier
  starGain: 1,      // star visibility multiplier
};

export const DEFAULTS = { ...tuner };

type RGB = [number, number, number];

/** Pre-parsed keyframe colours as linear 0..1 floats (srgb→linear like THREE.Color). */
interface CKey { t: number; phase: string; skyTop: RGB; horizon: RGB; fog: RGB; sun: RGB; sunI: number; ambI: number; }

const parse = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  const s = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return [s((n >> 16) & 255), s((n >> 8) & 255), s(n & 255)];
};

const CKEYS: CKey[] = KEYS.map((k) => ({
  t: k.t, phase: k.phase,
  skyTop: parse(k.skyTop), horizon: parse(k.horizon), fog: parse(k.fog), sun: parse(k.sun),
  sunI: k.sunI, ambI: k.ambI,
}));

export interface Sample {
  skyTop: RGB; horizon: RGB; fog: RGB; sun: RGB;
  sunI: number; ambI: number; night: number; phase: string; f: number;
}

const mix = (out: RGB, a: RGB, b: RGB, f: number) => {
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
};

/** Alloc-free sampler — fills `out`. Wraps across the t=1 → t=0 boundary. */
export function sampleInto(t: number, out: Sample): Sample {
  let i = 0;
  while (i < CKEYS.length - 2 && CKEYS[i + 1].t < t) i++;
  const a = CKEYS[i];
  const b = CKEYS[i + 1] ?? CKEYS[0];
  let span = b.t - a.t;
  if (span <= 0) span += 1;
  let local = t - a.t;
  if (local < 0) local += 1;
  const f = Math.min(1, local / span);
  mix(out.skyTop, a.skyTop, b.skyTop, f);
  mix(out.horizon, a.horizon, b.horizon, f);
  mix(out.fog, a.fog, b.fog, f);
  mix(out.sun, a.sun, b.sun, f);
  out.sunI = a.sunI + (b.sunI - a.sunI) * f;
  out.ambI = a.ambI + (b.ambI - a.ambI) * f;
  const d = Math.min(Math.abs(t - 0.02), Math.abs(t - 1.02));
  out.night = Math.max(0, 1 - d * 6);
  out.phase = f < 0.5 ? a.phase : b.phase;
  out.f = f;
  return out;
}

const toHex = (c: RGB) => {
  const lin = (v: number) => {
    v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  };
  return `#${lin(c[0])}${lin(c[1])}${lin(c[2])}`.toUpperCase();
};

const scratch: Sample = {
  skyTop: [0, 0, 0], horizon: [0, 0, 0], fog: [0, 0, 0], sun: [0, 0, 0],
  sunI: 0, ambI: 0, night: 0, phase: '', f: 0,
};

/** Allocation-ful hex sampler for DOM readouts (low-frequency UI use only). */
export function sampleHex(t: number) {
  sampleInto(t, scratch);
  return {
    skyTop: toHex(scratch.skyTop),
    horizon: toHex(scratch.horizon),
    fog: toHex(scratch.fog),
    sun: toHex(scratch.sun),
    sunI: scratch.sunI,
    ambI: scratch.ambI,
    night: scratch.night,
    phase: scratch.phase,
  };
}

/** Sun elevation/azimuth on the demo's dome — same path as the game's Sky. */
export function sunAngles(t: number) {
  const elev = Math.sin((t - 0.25) * Math.PI * 2) * 0.9 + 0.25;
  const azim = (t - 0.25) * Math.PI * 2;
  return { elev, azim };
}

/** Pretty 24h clock for a cycle position (t=0.5 → 12:00). */
export function clockString(t: number): string {
  const mins = Math.round(t * 24 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** JSON payload the Export button copies to the clipboard. */
export function exportPayload() {
  const s = sampleHex(tuner.t);
  return {
    preset: 'driftline/skybox-tuner',
    exportedAt: new Date().toISOString(),
    timeOfDay: +tuner.t.toFixed(4),
    clock: clockString(tuner.t),
    phase: s.phase,
    sampled: {
      skyTop: s.skyTop,
      horizon: s.horizon,
      fog: s.fog,
      sun: s.sun,
      sunIntensity: +s.sunI.toFixed(3),
      ambientIntensity: +s.ambI.toFixed(3),
      nightFactor: +s.night.toFixed(3),
    },
    overrides: {
      fogDensity: +(tuner.fogDensity / 1e4).toFixed(6),
      sunGain: tuner.sunGain,
      starFactor: tuner.starGain,
    },
    keyframes: KEYS,
  };
}

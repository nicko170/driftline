/**
 * Tunable bike parameters + presets + a tiny zustand store.
 * The physics step reads `useTuning.getState()` every tick, so slider
 * changes apply the same frame — that's the whole point of the toy.
 */
import { create } from 'zustand';

export interface BikeParams {
  /** ride height above ground (m) */
  hover: number;
  /** ride spring stiffness — how hard the bike chases ride height */
  spring: number;
  /** spring damping: mix factor toward the wanted vertical velocity */
  damp: number;
  /** lateral grip (higher = rails, lower = skate) */
  grip: number;
  /** steering rate at low speed */
  steer: number;
  /** forward acceleration */
  accel: number;
  /** soft top speed (m/s) */
  vMax: number;
  /** thrust multiplier while boosting */
  boostMulti: number;
  /** boost meter drain per second */
  boostDrain: number;
  /** boost meter regen per second */
  boostRegen: number;
  /** grip multiplier while drifting (0.05 = full slide) */
  driftGrip: number;
  /** boost-on-exit kick per second of drift */
  driftKick: number;
  /** hop impulse */
  hop: number;
}

export const DEFAULT_PARAMS: BikeParams = {
  hover: 1.25,
  spring: 6.5,
  damp: 0.78,
  grip: 9.5,
  steer: 1.9,
  accel: 24,
  vMax: 36,
  boostMulti: 1.8,
  boostDrain: 0.26,
  boostRegen: 0.07,
  driftGrip: 0.16,
  driftKick: 2.4,
  hop: 8.6,
};

export const PRESETS: Record<string, { label: string; note: string; params: BikeParams }> = {
  arcade: { label: 'Arcade', note: 'shipping defaults', params: { ...DEFAULT_PARAMS } },
  sim: {
    label: 'Sim',
    note: 'heavy, honest, punishes lazy lines',
    params: {
      hover: 1.05, spring: 5.0, damp: 0.6, grip: 6.2, steer: 1.55, accel: 19,
      vMax: 41, boostMulti: 1.5, boostDrain: 0.32, boostRegen: 0.05,
      driftGrip: 0.38, driftKick: 1.3, hop: 7.0,
    },
  },
  missile: {
    label: 'Drift Missile',
    note: 'no grip, all kick, some regrets',
    params: {
      hover: 1.45, spring: 8.5, damp: 0.85, grip: 5.0, steer: 2.6, accel: 30,
      vMax: 38, boostMulti: 2.2, boostDrain: 0.18, boostRegen: 0.1,
      driftGrip: 0.05, driftKick: 5.2, hop: 9.5,
    },
  },
};

export interface ParamDef {
  key: keyof BikeParams;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
  fmt: (v: number) => string;
}

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);

export const PARAM_DEFS: ParamDef[] = [
  { key: 'hover', label: 'Ride height', min: 0.6, max: 2.4, step: 0.05, group: 'Hover', fmt: (v) => `${f2(v)} m` },
  { key: 'spring', label: 'Spring', min: 2, max: 14, step: 0.25, group: 'Hover', fmt: f1 },
  { key: 'damp', label: 'Damping', min: 0.3, max: 0.98, step: 0.02, group: 'Hover', fmt: f2 },
  { key: 'grip', label: 'Grip', min: 2, max: 18, step: 0.25, group: 'Drive', fmt: f1 },
  { key: 'steer', label: 'Steer rate', min: 0.8, max: 3.4, step: 0.05, group: 'Drive', fmt: f2 },
  { key: 'accel', label: 'Acceleration', min: 8, max: 48, step: 0.5, group: 'Drive', fmt: f1 },
  { key: 'vMax', label: 'Top speed', min: 16, max: 60, step: 1, group: 'Drive', fmt: (v) => `${Math.round(v)} m/s` },
  { key: 'boostMulti', label: 'Boost thrust', min: 1.1, max: 2.8, step: 0.05, group: 'Boost', fmt: (v) => `×${f2(v)}` },
  { key: 'boostDrain', label: 'Boost drain', min: 0.08, max: 0.6, step: 0.01, group: 'Boost', fmt: (v) => `${f2(v)}/s` },
  { key: 'boostRegen', label: 'Boost regen', min: 0.01, max: 0.3, step: 0.005, group: 'Boost', fmt: (v) => `${f2(v)}` },
  { key: 'driftGrip', label: 'Drift grip', min: 0.02, max: 0.7, step: 0.01, group: 'Drift', fmt: f2 },
  { key: 'driftKick', label: 'Drift kick', min: 0, max: 9, step: 0.1, group: 'Drift', fmt: f1 },
  { key: 'hop', label: 'Hop impulse', min: 3, max: 16, step: 0.1, group: 'Jump', fmt: f1 },
];

export const PARAM_GROUPS = ['Hover', 'Drive', 'Boost', 'Drift', 'Jump'];

interface TuningState {
  params: BikeParams;
  preset: string; // 'custom' once a slider moves
  resetToken: number;
  setParam: (key: keyof BikeParams, value: number) => void;
  applyPreset: (name: string) => void;
  bumpReset: () => void;
}

export const useTuning = create<TuningState>((set) => ({
  params: { ...DEFAULT_PARAMS },
  preset: 'arcade',
  resetToken: 0,
  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value }, preset: 'custom' })),
  applyPreset: (name) => {
    const p = PRESETS[name];
    if (p) set({ params: { ...p.params }, preset: name });
  },
  bumpReset: () => set((s) => ({ resetToken: s.resetToken + 1 })),
}));

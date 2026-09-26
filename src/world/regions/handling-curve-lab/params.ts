/**
 * Handling Curve Lab — live tuning state.
 *
 * BASELINE mirrors the shipping helicopter constants in src/game/Bike.tsx
 * (level-0 upgrades), and `effective()` re-derives the controller constants
 * with the *same* upgrade formulas the game uses (engine/handling/boost
 * ladders 0–3). The physics step reads this store every tick, so every
 * slider applies same-frame. Nothing here forks bike physics — it is the
 * shipping controller with its numbers exposed.
 */
import { create } from 'zustand';

export interface Tune {
  /** forward acceleration, m/s² (shipping: 24 + engine·5) */
  accel: number;
  /** soft top speed, m/s (shipping: 36 + engine·3.5) */
  vMax: number;
  /** painted-zone grip multipliers (shipping: salt 1.0 · sand 0.8 · glass 0.5) */
  gripSalt: number;
  gripSand: number;
  gripGlass: number;
  /** drift-exit boost: impulse per drift-second (shipping 2.4, cap ×1.875) */
  driftKick: number;
  /** hop impulse (shipping 8.6) */
  hop: number;
  /** boost meter regen /s (shipping: 0.07 + boost·0.02) */
  boostRegen: number;
  /** boost meter drain /s (shipping: 0.26 − boost·0.035) */
  boostDrain: number;
}

export type LadderKey = 'engine' | 'handling' | 'boost';
export interface Ladders {
  engine: number;
  handling: number;
  boost: number;
}

export const BASELINE: Tune = {
  accel: 24,
  vMax: 36,
  gripSalt: 1.0,
  gripSand: 0.8,
  gripGlass: 0.5,
  driftKick: 2.4,
  hop: 8.6,
  boostRegen: 0.07,
  boostDrain: 0.26,
};

export type SurfaceKind = 'salt' | 'sand' | 'glass';

export const SURFACE_GRIP_KEY: Record<SurfaceKind, 'gripSalt' | 'gripSand' | 'gripGlass'> = {
  salt: 'gripSalt',
  sand: 'gripSand',
  glass: 'gripGlass',
};

/** Effective controller constants = sliders (base) + upgrade ladder deltas,
 *  using the exact formulas from src/game/Bike.tsx. */
export function effective(p: Tune, l: Ladders) {
  return {
    accel: p.accel + l.engine * 5,
    vMax: p.vMax + l.engine * 3.5,
    steer: 1.9 + l.handling * 0.22,
    gripScale: 9 + l.handling * 1.6,
    drain: Math.max(0.05, p.boostDrain - l.boost * 0.035),
    regen: p.boostRegen + l.boost * 0.02,
    driftKick: p.driftKick,
    hop: p.hop,
  };
}

export const LADDER_INFO: Record<LadderKey, { name: string; per: string }> = {
  engine: { name: 'Engine coils', per: '+5 accel · +3.5 top speed' },
  handling: { name: 'Gyro cage', per: '+0.22 steer · +1.6 grip scale' },
  boost: { name: 'Boost cell', per: '−0.035 drain · +0.02 regen' },
};

export interface ParamDef {
  key: keyof Tune;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
  fmt: (v: number) => string;
}

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const m2 = (v: number) => `×${f2(v)}`;

export const PARAM_DEFS: ParamDef[] = [
  { key: 'accel', label: 'Acceleration', min: 10, max: 52, step: 0.5, group: 'Power', fmt: (v) => `${f1(v)} m/s²` },
  { key: 'vMax', label: 'Top speed', min: 16, max: 64, step: 0.5, group: 'Power', fmt: (v) => `${f1(v)} m/s` },
  { key: 'gripSalt', label: 'Salt grip ■', min: 0.3, max: 1.6, step: 0.02, group: 'Surfaces', fmt: m2 },
  { key: 'gripSand', label: 'Sand grip ▲', min: 0.3, max: 1.4, step: 0.02, group: 'Surfaces', fmt: m2 },
  { key: 'gripGlass', label: 'Glass grip ◆', min: 0.05, max: 1.1, step: 0.01, group: 'Surfaces', fmt: m2 },
  { key: 'driftKick', label: 'Drift-exit boost', min: 0, max: 8, step: 0.1, group: 'Drift & hop', fmt: (v) => `${f1(v)}/s` },
  { key: 'hop', label: 'Hop impulse', min: 3, max: 16, step: 0.1, group: 'Drift & hop', fmt: (v) => `${f1(v)} m/s` },
  { key: 'boostRegen', label: 'Boost regen', min: 0.01, max: 0.3, step: 0.005, group: 'Boost economy', fmt: (v) => `${f2(v)}/s` },
  { key: 'boostDrain', label: 'Boost drain', min: 0.08, max: 0.6, step: 0.005, group: 'Boost economy', fmt: (v) => `${f2(v)}/s` },
];

export const PARAM_GROUPS = ['Power', 'Surfaces', 'Drift & hop', 'Boost economy'];

interface TuningState {
  params: Tune;
  ladders: Ladders;
  resetToken: number;
  setParam: (key: keyof Tune, value: number) => void;
  setLadder: (key: LadderKey, level: number) => void;
  baseline: () => void;
  bumpReset: () => void;
}

export const useTuning = create<TuningState>((set) => ({
  params: { ...BASELINE },
  ladders: { engine: 0, handling: 0, boost: 0 },
  resetToken: 0,
  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
  setLadder: (key, level) => set((s) => ({ ladders: { ...s.ladders, [key]: Math.max(0, Math.min(3, level)) } })),
  baseline: () => set({ params: { ...BASELINE }, ladders: { engine: 0, handling: 0, boost: 0 } }),
  bumpReset: () => set((s) => ({ resetToken: s.resetToken + 1 })),
}));

/** True when anything differs from the shipping baseline (panel shows a badge). */
export function isCustom(p: Tune, l: Ladders): boolean {
  return (
    l.engine !== 0 ||
    l.handling !== 0 ||
    l.boost !== 0 ||
    (Object.keys(BASELINE) as (keyof Tune)[]).some((k) => p[k] !== BASELINE[k])
  );
}

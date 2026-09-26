/**
 * Storm Wall Tuner — state.
 *
 * `lab`  = every look-dev knob (plain mutable; Panel writes + bumps React).
 * `rt`   = runtime scratch written each frame by the staging director
 *          (Scene.tsx) and the overdraw meter (Wall.tsx).
 *
 * SHIPPED mirrors the three shipped surfaces 1:1 so the bench defaults are
 * the game, not a guess:
 *   src/game/MissionDirector.tsx — StormWall (3 shells, churn band)
 *   src/game/Sky.tsx             — stormFog ramp (range 500, +0.0042, ease 2.5)
 *   src/ui/HUD.tsx / ui.css      — screen tint (range 380, cap 0.55)
 */
import { clamp01 } from '../../../lib/noise';

export type Quality = 'low' | 'medium' | 'high';
export type Rig = 'chase' | 'orbit' | 'top';
export type CvdMode = 'normal' | 'deutan' | 'protan' | 'tritan';

export const SHIPPED = {
  /** wall stack (MissionDirector) */
  shells: 3,
  radius: 150,
  colors: ['#C98F4E', '#B97745', '#8A5335'] as [string, string, string],
  opacity0: 0.22,          // inner shell alpha
  falloff: 0.773,          // 0.22 / 0.17 / 0.12 → ^i multiplier
  heights: 200,            // inner shell height; +30/shell
  heightStep: 0.15,        // +i*0.15·H, scale step 0.16 radially
  scaleStep: 0.16,
  baseY: 30,               // inner shell centre height
  yStep: 8,
  segments: 36,
  churn: true,
  churnColor: '#D9A45B',
  churnOpacity: 0.4,
  churnHeight: 12,
  skirt: false,
  wobble: 0.35,            // 0 = shipped rock-steady 0.14 rad sway; 1 = storm-churn
  sheet: false,            // shipped wall has no particle sheet
  sheetCount: 0,
  streaks: true,
  /** fog ramp (Sky.tsx) */
  fogRange: 500,
  fogBoost: 0.0042,
  fogEase: 2.5,
  fogColor: '#C98F4E',
  skyLerp: 0.75,
  horizonLerp: 0.6,
  /** screen tint (HUD) */
  tintRange: 380,
  tintCap: 0.55,
};

/** Per-quality particle/geometry budgets (mirrors store.ts Quality). */
export const QUALITY: Record<Quality, { seg: number; sheetMax: number; streaks: number; churnSkirt: boolean }> = {
  low: { seg: 20, sheetMax: 0, streaks: 0, churnSkirt: false },
  medium: { seg: 36, sheetMax: 700, streaks: 180, churnSkirt: true },
  high: { seg: 48, sheetMax: 1500, streaks: 320, churnSkirt: true },
};

export const FACE_MAX = 640; // rail length (m) the wall can be parked out to

export const lab = {
  /* staging */
  face: 560,          // scrubbed face distance, m (wall face → rider)
  tod: 0.62,          // time-of-day 0..1 (Sky keyframes; 0.62 ≈ late afternoon)
  rig: 'chase' as Rig,
  squeeze: false,     // auto-run the face 640 → 0
  /* wall look */
  shells: SHIPPED.shells,
  radius: SHIPPED.radius,
  heightScale: 1,
  opacity0: SHIPPED.opacity0,
  falloff: SHIPPED.falloff,
  density: 1,         // master alpha multiplier
  colors: [...SHIPPED.colors] as [string, string, string],
  churn: SHIPPED.churn,
  churnOpacity: SHIPPED.churnOpacity,
  skirt: SHIPPED.skirt,
  wobble: SHIPPED.wobble,
  sheet: SHIPPED.sheet,
  sheetCount: 0,
  streaks: SHIPPED.streaks,
  segments: SHIPPED.segments,
  /* atmosphere (fog ramp + tint) */
  fogRange: SHIPPED.fogRange,
  fogBoost: SHIPPED.fogBoost,
  fogEase: SHIPPED.fogEase,
  skyLerp: SHIPPED.skyLerp,
  horizonLerp: SHIPPED.horizonLerp,
  tintRange: SHIPPED.tintRange,
  tintCap: SHIPPED.tintCap,
  /* bench */
  quality: 'high' as Quality,
  measure: true,
};

export const rt = {
  face: lab.face,      // smoothed staging face (what the wall is really at)
  fogMix: 0,           // stormFog analog 0..1 (smoothed by fogEase)
  tint: 0,
  engulfed: false,
  /* perf + overdraw readout */
  fps: 60,
  calls: 0,
  tris: 0,
  coverage: 0,         // 0..1 fraction of test-readback pixels the wall paints
  meanAlpha: 0,        // mean composited alpha over covered pixels
  stackEst: 0,         // estimated translucent stack depth over covered pixels
  avgLayerAlpha: 0,    // mean per-layer alpha used for the estimate
  samples: 0,
  lastMeasure: 0,
};

/** Live wall height after the height scale (sheet spawn + rigs read this). */
export function wallHeight(): number {
  return SHIPPED.heights * lab.heightScale;
}

/** Shell colour ramp: inner → mid → outer across n shells. */
export function shellColorAt(i: number, n: number): string {
  if (n <= 1) return lab.colors[0];
  const t = i / (n - 1);
  const [a, b, c] = lab.colors.map(hexToRgb01) as [number, number, number][];
  const lo = t < 0.5 ? a : b;
  const hi = t < 0.5 ? b : c;
  const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return rgb01ToHex([
    lo[0] + (hi[0] - lo[0]) * f,
    lo[1] + (hi[1] - lo[1]) * f,
    lo[2] + (hi[2] - lo[2]) * f,
  ]);
}

export function shellOpacityAt(i: number, n: number): number {
  return lab.opacity0 * Math.pow(lab.falloff, i) * lab.density * (n > 3 ? 0.9 : 1);
}

/* ---------------- colour + CVD helpers ---------------- */

export function hexToRgb01(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
export function rgb01ToHex([r, g, b]: number[]): string {
  const to255 = (x: number) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`.toUpperCase();
}

/** Vienot/Machado-style linear CVD approximations (sRGB-space, good enough for tuning). */
const CVD: Record<Exclude<CvdMode, 'normal'>, number[]> = {
  deutan: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  protan: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  tritan: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
};

export function cvdSim(hex: string, mode: CvdMode): string {
  if (mode === 'normal') return hex.toUpperCase();
  const m = CVD[mode];
  const [r, g, b] = hexToRgb01(hex);
  return rgb01ToHex([
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ]);
}

/** Relative luminance — for the "can you still read it?" contrast column. */
export function relLum(hex: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = hexToRgb01(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---------------- export payload ---------------- */

export function exportPayload(): string {
  const round = (v: number, d = 3) => +v.toFixed(d);
  const payload = {
    _note:
      'Generated by /lab/storm-wall-tuner. Blocks map 1:1 onto shipped constants — ' +
      'MissionDirector.tsx StormWall, Sky.tsx stormFog ramp, HUD.tsx/ui.css storm tint. ' +
      '`measured` is the live 64px readback at export time (bench staging, not gameplay).',
    missionDirector_StormWall: {
      SHELLS: lab.shells,
      SHELL_COLORS: lab.colors,
      SHELL_OPACITY_INNER: round(lab.opacity0 * lab.density),
      SHELL_OPACITY_FALLOFF: round(lab.falloff),
      SHELL_HEIGHT: SHIPPED.heights,
      HEIGHT_SCALE: round(lab.heightScale, 2),
      SCALE_STEP: SHIPPED.scaleStep,
      SEGMENTS: lab.segments,
      WOBBLE: round(lab.wobble, 2),
      CHURN: lab.churn ? { color: SHIPPED.churnColor, opacity: round(lab.churnOpacity * lab.density), height: SHIPPED.churnHeight } : null,
      SKIRT: lab.skirt,
      PARTICLE_SHEET: lab.sheet ? Math.min(lab.sheetCount, QUALITY[lab.quality].sheetMax) : 0,
      WIND_STREAKS: lab.streaks ? QUALITY[lab.quality].streaks : 0,
    },
    sky_stormFog: {
      FOG_RANGE: round(lab.fogRange, 0),
      FOG_DENSITY_ADD: round(lab.fogBoost, 5),
      FOG_EASE: round(lab.fogEase, 2),
      FOG_COLOR: SHIPPED.fogColor,
      SKY_LERP: round(lab.skyLerp, 2),
      HORIZON_LERP: round(lab.horizonLerp, 2),
    },
    hud_stormTint: {
      TINT_RANGE: round(lab.tintRange, 0),
      TINT_CAP: round(lab.tintCap, 2),
    },
    qualityBudgets: {
      low: { segments: QUALITY.low.seg, sheetMax: QUALITY.low.sheetMax, streaks: QUALITY.low.streaks },
      medium: { segments: QUALITY.medium.seg, sheetMax: QUALITY.medium.sheetMax, streaks: QUALITY.medium.streaks },
      high: { segments: QUALITY.high.seg, sheetMax: QUALITY.high.sheetMax, streaks: QUALITY.high.streaks },
    },
    measured: {
      atFace_m: round(rt.face, 0),
      timeOfDay: round(lab.tod, 2),
      quality: lab.quality,
      coveragePct: round(rt.coverage * 100, 1),
      stackDepthEst: round(rt.stackEst, 1),
      drawCalls: rt.calls,
      triangles: rt.tris,
      fps: round(rt.fps, 0),
    },
  };
  return JSON.stringify(payload, null, 2);
}

/** Restore lab to the shipped treatment (look knobs only — keeps staging). */
export function resetToShipped() {
  lab.shells = SHIPPED.shells;
  lab.radius = SHIPPED.radius;
  lab.heightScale = 1;
  lab.opacity0 = SHIPPED.opacity0;
  lab.falloff = SHIPPED.falloff;
  lab.density = 1;
  lab.colors = [...SHIPPED.colors];
  lab.churn = SHIPPED.churn;
  lab.churnOpacity = SHIPPED.churnOpacity;
  lab.skirt = SHIPPED.skirt;
  lab.wobble = SHIPPED.wobble;
  lab.sheet = SHIPPED.sheet;
  lab.sheetCount = SHIPPED.sheetCount;
  lab.streaks = SHIPPED.streaks;
  lab.segments = SHIPPED.segments;
  lab.fogRange = SHIPPED.fogRange;
  lab.fogBoost = SHIPPED.fogBoost;
  lab.fogEase = SHIPPED.fogEase;
  lab.skyLerp = SHIPPED.skyLerp;
  lab.horizonLerp = SHIPPED.horizonLerp;
  lab.tintRange = SHIPPED.tintRange;
  lab.tintCap = SHIPPED.tintCap;
}

/**
 * Night Beam Tuner — shared live state, the exact spotlight attenuation model
 * three.js uses at draw time (getDistanceAttenuation / getSpotAttenuation in
 * the lights fragment shader), and the clipboard export payload. The scene and
 * the HUD read `beam` every frame / tick; the panel writes it. No allocations
 * in sampling (module-level scratch only).
 */

export type ViewPreset = 'chase' | 'profile' | 'footprint';

export interface BeamState {
  t: number;            // sky clock 0..1 (0.99 = deep night)
  playing: boolean;     // clock advances
  cyclesPerMin: number; // clock speed while playing
  angle: number;        // spot cone half-angle, radians (rad in game: full cone)
  penumbra: number;     // 0 hard edge .. 1 feathered
  intensity: number;    // peak candela-ish at beamOn=1
  decay: number;        // distance falloff exponent (2 = physical)
  distance: number;     // hard cutoff metres
  aimDrop: number;      // target y (local) — how far the beam dips
  aimAhead: number;     // target z (local) — how far ahead it points
  coneOpacity: number;  // additive dust-cone sheen at beamOn=1
  lampEmissive: number; // nose lamp emissive gain at beamOn=1 (0.6 base)
  fogGain: number;      // multiplier on the game's night fog formula
  view: ViewPreset;
}

/** Values currently shipped in src/game/Bike.tsx (Headlight). */
export const SHIPPED: BeamState = {
  t: 0.99,
  playing: false,
  cyclesPerMin: 0.5,
  angle: 0.45,
  penumbra: 0.7,
  intensity: 72,
  decay: 1.5,
  distance: 70,
  aimDrop: -1.1,
  aimAhead: 15,
  coneOpacity: 0.06,
  lampEmissive: 4.5,
  fogGain: 1,
  view: 'chase',
};

export const beam: BeamState = { ...SHIPPED };

export function resetBeam(): void {
  Object.assign(beam, SHIPPED);
}

/** Deep-night factor, mirrors nightFactor() in src/game/Sky.tsx. */
export function nightFactor(t: number): number {
  const d = Math.min(Math.abs(t - 0.02), Math.abs(t - 1.02));
  return Math.max(0, 1 - d * 6);
}

/** The game's dusk fade-in ramp: spot/cone/lamp gain, 0 by day → 1 deep night. */
export function beamOn(t: number): number {
  return Math.min(1, Math.max(0, (nightFactor(t) - 0.12) / 0.35));
}

/* ---------- lamp geometry (mirrors Bike.tsx, bike hovering ~0.55 m) ---------- */
export const HOVER_Y = 0.55;
export const LAMP = { x: 0, y: HOVER_Y + 0.65, z: 1.7 } as const;

/* ---------- three.js spotlight attenuation, verbatim math ---------- */

/** mirrors getDistanceAttenuation() in lights_pars_begin.glsl */
export function distAtt(d: number, cutoff: number, decay: number): number {
  const falloff = 1 / Math.max(Math.pow(d, decay), 0.01);
  if (cutoff <= 0) return falloff;
  const r = d / cutoff;
  const r4 = r * r * r * r;
  const w = 1 - Math.min(1, r4);
  return falloff * w * w;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** mirrors getSpotAttenuation() (smoothstep between cone cosines) */
export function spotAtt(angle: number, penumbra: number, cos: number): number {
  const coneCos = Math.cos(angle);
  const penCos = Math.cos(angle * (1 - penumbra));
  const f = clamp01((cos - coneCos) / Math.max(1e-6, penCos - coneCos));
  return f * f * (3 - 2 * f);
}

/**
 * Relative ground illuminance at pan point (x, z) under the current beam.
 * Flat-pan assumption: cosIncidence = -dirY. Returns ~0.02..0.2 scale values.
 */
export function groundLux(x: number, z: number): number {
  const on = beamOn(beam.t);
  if (on <= 0 || beam.intensity <= 0) return 0;
  // light → point
  const dx = x - LAMP.x;
  const dy = -LAMP.y;
  const dz = z - LAMP.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1e-3) return 0;
  const invD = 1 / d;
  // light axis: lamp → target (local [0, aimDrop, aimAhead] lifted by hover)
  let ax = -LAMP.x;
  let ay = HOVER_Y + beam.aimDrop - LAMP.y;
  let az = beam.aimAhead - LAMP.z;
  const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  ax /= al; ay /= al; az /= al;
  const cos = dx * invD * ax + dy * invD * ay + dz * invD * az;
  const att = distAtt(d, beam.distance, beam.decay) * spotAtt(beam.angle, beam.penumbra, cos);
  return beam.intensity * on * att * clamp01(-dy * invD);
}

/* ---------- tuning verdicts ---------- */

/** Relative illuminance that should still read paint/marker edges at night.
 *  Calibrated: shipped beam at full night reads ~27 m against this floor. */
export const READ_OK = 0.02;

export interface BeamVerdict {
  read: number;       // metres: furthest centreline point ≥ READ_OK (from 12 m out)
  glare: number;      // pool glare: mean lux at 4–8 m ÷ READ_OK
  band: number;       // mean lux in the 20–30 m read band ÷ READ_OK
  ok: boolean;
  label: string;
  tone: 'good' | 'warn' | 'bad';
}

const scratchSamples = new Float32Array(200);

export function evaluateBeam(): BeamVerdict {
  // forward centreline scan
  const N = 140;
  let read = 0;
  let miss = 0;
  for (let i = 0; i < N; i++) {
    const z = 2 + (i / (N - 1)) * 68;
    scratchSamples[i] = groundLux(0, z);
    if (z >= 12) {
      if (scratchSamples[i] >= READ_OK) { read = z; miss = 0; }
      else if (++miss > 4 && read > 0) break;
    }
  }
  let glareSum = 0;
  for (let z = 4; z <= 8; z += 0.5) glareSum += groundLux(0, z);
  const glare = glareSum / 9 / READ_OK;
  let bandSum = 0;
  for (let z = 20; z <= 30; z += 1) bandSum += groundLux(0, z);
  const band = bandSum / 11 / READ_OK;
  let label: string;
  let tone: BeamVerdict['tone'];
  if (glare > 2.4) {
    label = 'searchlight — the pool clips the pan';
    tone = 'bad';
  } else if (read < 20) {
    label = 'dim — the road dies before 20 m';
    tone = 'bad';
  } else if (read > 34) {
    label = 'long throw — canyon-run reach';
    tone = 'warn';
  } else {
    label = 'sweet spot — reads the 20–30 m band';
    tone = 'good';
  }
  return { read, glare, band, ok: tone === 'good', label, tone };
}

/* ---------- export payload ---------- */

const fmt = (v: number) =>
  Number.isInteger(v) ? String(v) : String(+v.toFixed(3));

/** Paste-ready props block for the Headlight in src/game/Bike.tsx. */
export function exportSnippet(): string {
  const v = evaluateBeam();
  return `// Headlight — tuned at /lab/night-beam-tuner
// night rig: reads ~${Math.round(v.read)} m at t=0.99, pool glare ×${v.glare.toFixed(1)}, band ×${v.band.toFixed(1)}
<spotLight
  ref={spot}
  position={[0, 0.65, 1.7]}
  angle={${fmt(beam.angle)}}
  penumbra={${fmt(beam.penumbra)}}
  distance={${fmt(beam.distance)}}
  decay={${fmt(beam.decay)}}
  color="#FFE0AE"
  intensity={on * ${fmt(beam.intensity)}}
>
  <object3D position={[0, ${fmt(beam.aimDrop)}, ${fmt(beam.aimAhead)}]} attach="target" />
</spotLight>
// lamp lens:  emissiveIntensity = 0.6 + on * ${fmt(beam.lampEmissive)}
// beam cone:  opacity = on * ${fmt(beam.coneOpacity)}`;
}

export function exportJson() {
  const v = evaluateBeam();
  return {
    preset: 'driftline/night-beam-tuner',
    exportedAt: new Date().toISOString(),
    tune: {
      angle: +beam.angle.toFixed(3),
      penumbra: +beam.penumbra.toFixed(3),
      intensity: +beam.intensity.toFixed(2),
      decay: +beam.decay.toFixed(3),
      distance: +beam.distance.toFixed(1),
      aimDrop: +beam.aimDrop.toFixed(2),
      aimAhead: +beam.aimAhead.toFixed(1),
      coneOpacity: +beam.coneOpacity.toFixed(3),
      lampEmissive: +beam.lampEmissive.toFixed(2),
    },
    shippedRamp: 'on = clamp((nightFactor(t) - 0.12) / 0.35, 0, 1)',
    verdict: {
      readMetres: Math.round(v.read),
      poolGlare: +v.glare.toFixed(2),
      bandMean: +v.band.toFixed(2),
      tone: v.tone,
      label: v.label,
    },
  };
}

/**
 * AMBIENT WEATHER — free-ride storm fronts ("storm season" made literal).
 *
 * A front is a travelling wall of sand-haze that spawns far out on the playa,
 * rolls roughly toward the player, and either catches them (engulfed: wind
 * push, thicker fog, boost burns faster) or slides past. It never kills and
 * never fails a mission — it's weather, not a hunter. Sheltering near any
 * on-world region anchor while the wall crosses pays a small Guild hazard
 * tariff; riding out an engulf long enough counts toward the "Weathered"
 * log entry. Chapter 3+ shortens the gap between fronts and speeds them up.
 *
 * State lives in module scope (no zustand churn); `tickWeather(dt)` runs from
 * WeatherFront's useFrame. Bike reads telemetry.wind; Sky reads
 * telemetry.front for fog; HUD draws the chip/minimap ring.
 */
import { telemetry } from '../telemetry';
import { useSaveStore, useGameStore } from '../state/store';
import { audio } from '../audio/audio';
import { REGIONS } from '../world/registry';
import { currentChapter } from '../missions/chapters';
import { ride } from './rideStats';

export interface Front {
  x: number;
  z: number;
  vx: number;
  vz: number; // m/s — travel direction
  r: number; // wall radius
  fade: number; // 0..1 — spawns dissolve in, endings dissolve out
  phase: 'in' | 'live' | 'out';
  age: number;
  engulfS: number; // cumulative seconds spent inside the wall
  closest: number; // nearest face distance seen (detects a clean pass)
  shelteredPaid: boolean;
}

export const weather: { front: Front | null; nextIn: number } = {
  front: null,
  nextIn: 80 + Math.random() * 50, // first front early enough to meet a new rider
};

/** Radio weather warnings — real voices, in the game's register. */
const WARN_LINES: { who: string; text: string }[] = [
  { who: 'surveyor-kest', text: 'Front on the horizon, rider. Wall-smell on the wind. Find a mast or make your peace with the sand.' },
  { who: 'surveyor-kest', text: 'Storm front moving across my grid. It is not in the almanac. The almanac has been notified and is embarrassed.' },
  { who: 'ketch', text: 'Dust wall rolling, kid. Check your intake filters after — or don\'t, and buy new ones from me like everyone else.' },
  { who: 'brinemaster-ogo', text: 'Weather tariff is in effect: shelter at a settlement while a front crosses and the Guild pays. Guild rules. My rules.' },
  { who: 'surveyor-kest', text: 'Heads up, band. Front rolling through. It has your name on it — they all do, I write the names on.' },
];

/** Shelters: every anchor of every on-world region, flattened once. */
let shelterPts: { x: number; z: number }[] | null = null;
function shelters(): { x: number; z: number }[] {
  if (shelterPts) return shelterPts;
  shelterPts = [];
  for (const mod of REGIONS.values()) {
    const m = mod.meta;
    if (Math.abs(m.center[0]) > 1800 || Math.abs(m.center[1]) > 1800) continue;
    for (const a of Object.values(mod.anchors)) shelterPts.push({ x: a.pos[0], z: a.pos[1] });
  }
  return shelterPts;
}

const SHELTER_R = 130;
let lastAudioI = -1;
// reusable gust vector (no per-frame allocation in the hot path)
const windVec = { x: 0, z: 0 };

function spawnFront(): void {
  const { chapter } = currentChapter(useSaveStore.getState().missionsDone);
  const season = chapter >= 3;
  const ang = Math.random() * Math.PI * 2;
  const dist = 1500 + Math.random() * 400;
  const speed = (10.5 + Math.random() * 3.5) * (season ? 1.15 : 1);
  // aim near the player with a little miss, plus a lazy perpendicular wander
  const miss = (Math.random() - 0.5) * 0.5;
  const head = ang + Math.PI + miss;
  weather.front = {
    x: telemetry.x + Math.sin(ang) * dist,
    z: telemetry.z + Math.cos(ang) * dist,
    vx: Math.sin(head) * speed,
    vz: Math.cos(head) * speed,
    r: 210,
    fade: 0,
    phase: 'in',
    age: 0,
    engulfS: 0,
    closest: Infinity,
    shelteredPaid: false,
  };
  scheduleNext();
  if (useGameStore.getState().mode === 'riding') {
    const line = WARN_LINES[Math.floor(Math.random() * WARN_LINES.length)];
    useGameStore.getState().say(line.who, line.text);
    audio.radioBlip();
  }
}

function scheduleNext(): void {
  const { chapter } = currentChapter(useSaveStore.getState().missionsDone);
  const season = chapter >= 3;
  const [lo, hi] = season ? [150, 250] : [210, 330];
  weather.nextIn = lo + Math.random() * (hi - lo);
}

export function tickWeather(dt: number): void {
  if (useGameStore.getState().physicsPaused) return;
  const f = weather.front;

  if (!f) {
    // no fronts while a job is live — missions own the drama then
    if (useGameStore.getState().activeMissionId) return;
    weather.nextIn -= dt;
    if (weather.nextIn <= 0) spawnFront();
    return;
  }

  f.age += dt;
  f.x += f.vx * dt;
  f.z += f.vz * dt;

  const dx = telemetry.x - f.x;
  const dz = telemetry.z - f.z;
  const faceDist = Math.max(0, Math.hypot(dx, dz) - f.r);
  f.closest = Math.min(f.closest, faceDist);
  const engulfed = faceDist <= 0.5;

  if (f.phase === 'in' && (f.fade += dt / 6) >= 1) {
    f.fade = 1;
    f.phase = 'live';
  }
  // dissolve once the wall has spent itself: a clean pass, an engulf, or old age
  if (f.phase === 'live' && (f.age > 340 || (f.closest < f.r * 2 && faceDist > 700))) f.phase = 'out';
  if (f.phase === 'out') {
    f.fade = Math.max(0, f.fade - dt / 10);
    if (f.fade <= 0) {
      endFront(f);
      return;
    }
  }

  /* ---- effects ---- */
  telemetry.front = { x: f.x, z: f.z, r: f.r, dist: faceDist, engulfed };

  // wind: ramps in ahead of the wall, gusting crosswise; strongest engulfed
  // (acceleration, m/s² — Bike adds it straight into velocity)
  const proximity = engulfed ? 1 : Math.max(0, 1 - faceDist / 150);
  if (proximity > 0.01) {
    const sp = Math.hypot(f.vx, f.vz) || 1;
    const dirX = f.vx / sp;
    const dirZ = f.vz / sp;
    const t = f.age;
    const gust = Math.sin(t * 1.7) * 2.4 + Math.sin(t * 0.63) * 1.4;
    windVec.x = dirX * (5.4 * proximity) + -dirZ * gust * proximity;
    windVec.z = dirZ * (5.4 * proximity) + dirX * gust * proximity;
    telemetry.wind = windVec;
  } else {
    telemetry.wind = null;
  }

  // rumble + howl — yield to a mission storm's own audio when one is live
  const i = engulfed ? 1 : Math.max(0, 1 - faceDist / 650);
  if (!telemetry.storm && Math.abs(i - lastAudioI) > 0.02) {
    audio.setStorm(i);
    lastAudioI = i;
  }

  if (engulfed) {
    f.engulfS += dt;
    if (!f.shelteredPaid && isSheltered()) {
      f.shelteredPaid = true;
      useSaveStore.getState().addCredits(45);
      useGameStore.getState().queueToast({
        id: `hazard-${Math.round(f.age * 10)}`,
        kicker: 'Guild weather tariff',
        title: 'Hazard pay · 45 cr',
        desc: 'Sheltered through the front. Brinemaster Ogo signs the chit twice, out of habit.',
        icon: '¤',
      });
      audio.chime();
    }
  }
}

function isSheltered(): boolean {
  for (const p of shelters()) {
    const dx = telemetry.x - p.x;
    const dz = telemetry.z - p.z;
    if (dx * dx + dz * dz < SHELTER_R * SHELTER_R) return true;
  }
  return false;
}

function endFront(f: Front): void {
  if (f.engulfS >= 5) {
    ride.frontsRodeOut += 1;
    ride.dirty = true;
  }
  weather.front = null;
  telemetry.front = null;
  telemetry.wind = null;
  if (lastAudioI > 0.02 && !telemetry.storm) audio.setStorm(0);
  lastAudioI = -1;
}

/** Force-reset (e.g. when quitting to title mid-front) — keeps stale fog/audio off the next run. */
export function clearWeather(): void {
  if (weather.front) endFront(weather.front);
  weather.nextIn = Math.max(weather.nextIn, 60);
}

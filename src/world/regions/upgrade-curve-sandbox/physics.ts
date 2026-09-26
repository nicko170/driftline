/**
 * Upgrade Curve Sandbox — the feel-economy model.
 *
 * Every constant below is copied from the shipped controller in
 * src/game/Bike.tsx (read it as the source of truth; this file quotes it):
 *
 *   accel  = (24 + engine*5)  * (boosting ? 1.8  : 1)
 *   vMax   = (36 + engine*3.5)* (boosting ? 1.38 : 1)
 *   drag   = v *= exp(-0.55 * dt)                       // rolling drag
 *   steer  = (1.9 + handling*0.22) / (1 + speed/30)
 *   drain  = 0.26 - boost*0.035   per second while boosting (meter > 0.02)
 *   regen  = 0.07 + boost*0.02 (+0.01 airborne) per second otherwise
 *   driftGain = 1 + handling*0.14 (builder iter 12 — gyros now reap drift exits)
 *   kick   = min(4.5 + handling*0.9, driftT*2.4*driftGain) impulse
 *   refund = min(0.35 + handling*0.05, driftT*0.1*driftGain) meter
 *
 * The launch sim integrates the grounded straight-line slice of the physics
 * loop (throttle pinned, salt-pan grip 1) so the graphs, the skidpad replay
 * and the exported numbers all agree to the decimal.
 *
 * The shipped ladder is 0–3 per part (PART_COSTS [400, 900, 1800],
 * GaragePanel.tsx / store.ts). "Dream" mode is a clearly-flagged what-if:
 * same linear gains extrapolated to level 5, cost doubling past the shipped
 * ceiling (3600, 7200) — for exploring whether a longer ladder is felt.
 */
import { missions } from '../../../missions/library';

export const KMH = 3.4; // the game's own m/s → km/h display factor (ride stats)

export const PHYS = {
  accBase: 24, accPerEngine: 5, accBoostX: 1.8,
  vmaxBase: 36, vmaxPerEngine: 3.5, vmaxBoostX: 1.38,
  drag: 0.55,
  steerBase: 1.9, steerPerHandling: 0.22, steerFalloff: 30,
  drainBase: 0.26, drainPerBoost: 0.035,
  regenBase: 0.07, regenPerBoost: 0.02, regenAirBonus: 0.01,
  boostMin: 0.02,
  kickPerS: 2.4, kickCap: 4.5,
  refundPerS: 0.1, refundCap: 0.35,
  // builder iter 12: handling ladder now scales drift-exit returns (was Fig 03's finding)
  driftGainPerHandling: 0.14,
  kickCapPerHandling: 0.9,
  refundCapPerHandling: 0.05,
} as const;

export const SHIPPED_MAX = 3;
export const DREAM_MAX = 5;
export const SHIPPED_COSTS = [400, 900, 1800];
export const DREAM_EXTRA_COSTS = [3600, 7200];

export type Ladder = 'shipped' | 'dream';
export type PartKey = 'engine' | 'handling' | 'boost';
export interface Pips {
  engine: number;
  handling: number;
  boost: number;
}

export const STOCK: Pips = { engine: 0, handling: 0, boost: 0 };

export const PRESETS: { id: string; label: string; pips: Pips; dream?: boolean; note: string }[] = [
  { id: 'stock', label: 'Stock', pips: { engine: 0, handling: 0, boost: 0 }, note: 'Second-hand, as bought at Saltmouth.' },
  { id: 'sport', label: 'Sport', pips: { engine: 2, handling: 2, boost: 2 }, note: 'Mid-ladder all-rounder — 3,900 cr sunk.' },
  { id: 'gold', label: 'Gold', pips: { engine: 3, handling: 3, boost: 3 }, note: 'Shipped ceiling. 9,300 cr of garage time.' },
  { id: 'queen', label: 'Salt Queen', dream: true, pips: { engine: 5, handling: 5, boost: 5 }, note: 'What-if dream ladder, levels 4–5 — 30,300 cr.' },
];

export const maxLevel = (l: Ladder) => (l === 'dream' ? DREAM_MAX : SHIPPED_MAX);
export const levelCosts = (l: Ladder) => (l === 'dream' ? [...SHIPPED_COSTS, ...DREAM_EXTRA_COSTS] : SHIPPED_COSTS);
export const levelCost = (l: Ladder, level: number) => (level <= 0 ? 0 : (levelCosts(l)[level - 1] ?? 0));
export const partSunk = (l: Ladder, level: number) => levelCosts(l).slice(0, Math.max(0, level)).reduce((a, b) => a + b, 0);
export const totalSunk = (l: Ladder, p: Pips) => partSunk(l, p.engine) + partSunk(l, p.handling) + partSunk(l, p.boost);

/* ------------------------------------------------ derived feel numbers */

export const accelOf = (e: number, boosting: boolean) =>
  (PHYS.accBase + PHYS.accPerEngine * e) * (boosting ? PHYS.accBoostX : 1);
export const vmaxOf = (e: number, boosting: boolean) =>
  (PHYS.vmaxBase + PHYS.vmaxPerEngine * e) * (boosting ? PHYS.vmaxBoostX : 1);
export const drainRate = (b: number) => PHYS.drainBase - PHYS.drainPerBoost * b;
export const regenRate = (b: number, air = false) => PHYS.regenBase + PHYS.regenPerBoost * b + (air ? PHYS.regenAirBonus : 0);
export const boostHoldS = (b: number) => (1 - PHYS.boostMin) / drainRate(b);
export const boostRefillS = (b: number) => (1 - PHYS.boostMin) / regenRate(b);
export const boostDuty = (b: number) => boostHoldS(b) / (boostHoldS(b) + boostRefillS(b));

/** Terminal speed where thrust meets the exp(-0.55·dt) rolling drag, m/s. */
export const terminalMs = (e: number, boosting: boolean) => {
  const a = accelOf(e, boosting);
  const v = vmaxOf(e, boosting);
  return a / (a / v + PHYS.drag);
};
/** Steer authority in rad/s at a given road speed (km/h). */
export const steerRateAt = (kmh: number, h: number) =>
  (PHYS.steerBase + PHYS.steerPerHandling * h) / (1 + kmh / KMH / PHYS.steerFalloff);

export const kickCapOf = (handling: number) => PHYS.kickCap + handling * PHYS.kickCapPerHandling;
export const kickOf = (driftT: number, handling = 0) =>
  Math.min(kickCapOf(handling), driftT * PHYS.kickPerS * (1 + handling * PHYS.driftGainPerHandling));
export const refundCapOf = (handling: number) => PHYS.refundCap + handling * PHYS.refundCapPerHandling;
export const refundOf = (driftT: number, handling = 0) =>
  Math.min(refundCapOf(handling), driftT * PHYS.refundPerS * (1 + handling * PHYS.driftGainPerHandling));
export const KICK_CAP_T = PHYS.kickCap / PHYS.kickPerS; // 1.875 s

export const HUNDRED_MS = 100 / KMH; // 100 km/h in m/s, on the game's own factor

/* ---------------------------------------------------- scripted launch */

export interface RunSample {
  t: number;
  v: number; // m/s
  d: number; // metres travelled
  meter: number;
  boosting: boolean;
}
export interface Run {
  samples: RunSample[];
  t100: number | null;
  d100: number | null;
  endKmh: number;
}

export const TAPE_S = 9;
export const BOOST_ON_T = 0.7; // tape script: throttle pinned at t=0, boost held from 0.7 s

/** Integrate the shipped forward-drive loop on a flat, grip-1 straight. */
export function runLaunch(pips: Pips, boosted: boolean, tapeS = TAPE_S): Run {
  const samples: RunSample[] = [];
  let t = 0;
  let v = 0;
  let d = 0;
  let meter = 1;
  let t100: number | null = null;
  let d100: number | null = null;
  const dt = 1 / 120;
  while (t <= tapeS) {
    const boosting = boosted && t >= BOOST_ON_T && meter > PHYS.boostMin;
    samples.push({ t, v, d, meter, boosting });
    if (boosting) meter = Math.max(0, meter - dt * drainRate(pips.boost));
    else meter = Math.min(1, meter + dt * regenRate(pips.boost));
    const push = accelOf(pips.engine, boosting) * (1 - Math.max(0, v) / vmaxOf(pips.engine, boosting));
    v += push * dt;
    v *= Math.exp(-PHYS.drag * dt);
    d += v * dt;
    t += dt;
    if (t100 === null && v >= HUNDRED_MS) {
      t100 = t;
      d100 = d;
    }
  }
  return { samples, t100, d100, endKmh: v * KMH };
}

/* ------------------------------------------------------------ metrics */

export interface Metrics {
  launch: Run;
  cruise: Run;
  topKmh: number; // terminal, throttle only
  topKmhBoost: number; // terminal, boosting
  holdS: number;
  refillS: number;
  duty: number;
  steer60: number; // deg/s @ 60 km/h
  sunk: number;
}

export function computeMetrics(pips: Pips, ladder: Ladder): Metrics {
  return {
    launch: runLaunch(pips, true),
    cruise: runLaunch(pips, false),
    topKmh: terminalMs(pips.engine, false) * KMH,
    topKmhBoost: terminalMs(pips.engine, true) * KMH,
    holdS: boostHoldS(pips.boost),
    refillS: boostRefillS(pips.boost),
    duty: boostDuty(pips.boost),
    steer60: (steerRateAt(60, pips.handling) * 180) / Math.PI,
    sunk: totalSunk(ladder, pips),
  };
}

/* ------------------------------------------------------------ context */

/** Mean mission payout — the economy's yardstick for "is this level earned". */
export const AVG_MISSION_CR = Math.round(
  missions.reduce((s, m) => s + (m.rewards?.credits ?? 0), 0) / Math.max(1, missions.length),
);

/* ---------------------------------------------------- live bench state */

/**
 * Mutable bridge into the R3F frame loop — React writes, the skidpad reads.
 * (No zustand subscriptions in the hot path; module-level by convention.)
 */
export const bench = {
  pips: { ...STOCK } as Pips,
  ladder: 'shipped' as Ladder,
  lap: 0,
};

/* ------------------------------------------------------------ export */

export function exportPayload(pips: Pips, ladder: Ladder, m: Metrics, stock: Metrics) {
  return {
    bench: 'upgrade-curve-sandbox',
    constantsSource: 'src/game/Bike.tsx (accel/vMax/drag/steer/drain/regen/kick)',
    ladder,
    pips,
    levelCosts: levelCosts(ladder),
    derived: {
      accel: accelOf(pips.engine, false),
      accelBoost: accelOf(pips.engine, true),
      vMax: vmaxOf(pips.engine, false),
      vMaxBoost: vmaxOf(pips.engine, true),
      drag: PHYS.drag,
      drainPerS: drainRate(pips.boost),
      regenPerS: regenRate(pips.boost),
    },
    metrics: {
      t100BoostedS: m.launch.t100,
      t100ThrottleOnlyS: m.cruise.t100,
      topSpeedKmh: +m.topKmh.toFixed(1),
      topSpeedBoostedKmh: +m.topKmhBoost.toFixed(1),
      boostHoldS: +m.holdS.toFixed(2),
      boostRefillS: +m.refillS.toFixed(2),
      boostDuty: +m.duty.toFixed(3),
      steerDegS60kmh: +m.steer60.toFixed(0),
      sunkCr: m.sunk,
    },
    vsStock: {
      t100BoostedS: stock.launch.t100 !== null && m.launch.t100 !== null
        ? +(stock.launch.t100 - m.launch.t100).toFixed(2)
        : null,
      topSpeedKmh: +(m.topKmh - stock.topKmh).toFixed(1),
      boostHoldS: +(m.holdS - stock.holdS).toFixed(2),
      boostDutyPts: +((m.duty - stock.duty) * 100).toFixed(1),
      steerDegS60kmh: +(m.steer60 - stock.steer60).toFixed(0),
    },
    notes: [
      'Flat salt pan, grip 1, throttle pinned; launch script boosts from t=0.7 s.',
      'Drift-exit returns scale with the handling ladder since builder iter 12 (gain ×(1+0.14·level); caps 4.5+0.9·level kick impulse, 0.35+0.05·level meter refund).',
      ladder === 'dream'
        ? 'DREAM LADDER: levels 4–5 extrapolate shipped linear per-level gains; costs double past 1800. Not shipped.'
        : 'Shipped ladder 0–3, cost ladder [400, 900, 1800] per part (GaragePanel.tsx).',
    ],
  };
}

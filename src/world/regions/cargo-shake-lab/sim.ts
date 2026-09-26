/**
 * CARGO SHAKE LAB — tuning model for the fragile-cargo damage chain.
 *
 * The model mirrors the shipped game chain exactly, so a preset tuned here
 * drops straight into the codebase:
 *   src/game/Bike.tsx          — impacts only register above THRESHOLD (9 m/s);
 *                                shield upgrades soak SOAK_PER_LEVEL (6) each
 *   src/game/MissionDirector.tsx — integrity loss = rawImpact × FRAGILE_DMG
 *                                (0.012), ignored under GRAZE_FLOOR (0.5 raw);
 *                                payout = PAYOUT_BASE + PAYOUT_SPAN × integrity
 *
 * The ghost bike runs canned bump sequences down a test pan; every scripted
 * impact is deterministic, so runs are repeatable and the ghost A/B replay is
 * fair. No allocations in the hot path — module-level state, mutated in place.
 */

/* Shipped constants — keep in sync with the cite paths above. */
export const SHIP = {
  FRAGILE_DMG: 0.012,
  THRESHOLD: 9,
  SOAK_PER_LEVEL: 6,
  GRAZE_FLOOR: 0.5,
  PAYOUT_BASE: 0.35,
  PAYOUT_SPAN: 0.65,
};

export interface Params {
  coef: number;      // integrity lost per unit of raw impact (FRAGILE_DMG)
  threshold: number; // m/s — impacts at or below never register
  shield: number;    // cargo-shield upgrade level 0..3 (soak = level × 6)
}

export const PRESETS: { id: string; label: string; shipped?: boolean; p: Params; note: string }[] = [
  {
    id: 'story-balance', label: 'story-balance', shipped: true,
    p: { coef: 0.012, threshold: 9, shield: 1 },
    note: 'What the game ships today, with one level of Ketch’s cargo shield — the chapter-one fragility budget. A sloppy gauntlet should still land you roughly two-thirds pay.',
  },
  {
    id: 'punishing', label: 'punishing',
    p: { coef: 0.02, threshold: 7, shield: 0 },
    note: 'Every tap costs. Thrilling for horror runs — check the gauntlet payout before shipping it, or fragile jobs become debt traps.',
  },
  {
    id: 'forgiving', label: 'forgiving',
    p: { coef: 0.007, threshold: 12, shield: 2 },
    note: 'Cargo rides like a hammock. Fine as early-game grace; watch that hard landings stop meaning anything.',
  },
];

export const findSeq = (id: string): Sequence => SEQUENCES.find((s) => s.id === id) ?? SEQUENCES[0];

/* ------------------------------------------------------------ course + hits */

export const RUN_V = 22;    // ghost cruise speed, m/s
export const RUN_M = 352;   // run length; the bike fades and loops at the end
export const HOVER_Y = 1.06;
export const GRAV = 18;     // snappy arcade gravity for scripted hops

export interface ImpactEvent {
  id: string;
  dist: number;     // metres down the course
  impulse: number;  // m/s equivalent — the game's collision speed
  kind: 'rock' | 'clip' | 'graze' | 'land' | 'gust' | 'hop';
  hop?: number;     // vy0 for launch events (no damage on its own)
  label: string;
}

export const EVENTS: ImpactEvent[] = [
  { id: 'rock-a', dist: 60, impulse: 12.5, kind: 'rock', label: 'small rock' },
  { id: 'rock-b', dist: 78, impulse: 10.8, kind: 'graze', label: 'rubble graze' },
  { id: 'gantry-clip', dist: 130, impulse: 21, kind: 'clip', label: 'gantry leg' },
  { id: 'gantry-graze', dist: 139, impulse: 13.5, kind: 'graze', label: 'post graze' },
  { id: 'hop-main', dist: 190, impulse: 0, kind: 'hop', hop: 8.2, label: 'launch ramp' },
  { id: 'land-main', dist: 212, impulse: 27, kind: 'land', label: 'hard landing' },
  { id: 'hop-second', dist: 250, impulse: 0, kind: 'hop', hop: 6.0, label: 'salt ledge' },
  { id: 'land-second', dist: 264, impulse: 19, kind: 'land', label: 'rough landing' },
  { id: 'gust-1', dist: 298, impulse: 8.5, kind: 'gust', label: 'storm shove' },
  { id: 'gust-2', dist: 307, impulse: 11.5, kind: 'gust', label: 'storm shove' },
  { id: 'gust-3', dist: 316, impulse: 9.2, kind: 'gust', label: 'storm shove' },
  { id: 'gust-4', dist: 325, impulse: 13.5, kind: 'gust', label: 'storm shove' },
  { id: 'gust-5', dist: 334, impulse: 8.8, kind: 'gust', label: 'storm shove' },
  { id: 'gust-6', dist: 343, impulse: 10.6, kind: 'gust', label: 'storm shove' },
];

export interface Sequence { id: string; label: string; events: string[]; note: string }

export const SEQUENCES: Sequence[] = [
  {
    id: 'rock', label: 'Small rock', events: ['rock-a', 'rock-b'],
    note: 'The everyday rubble strike. Should sting, not ruin a run.',
  },
  {
    id: 'gantry', label: 'Gantry leg', events: ['gantry-clip', 'gantry-graze'],
    note: 'A head-on clip at speed docking at the yard. The classic “I was barely touching it”.',
  },
  {
    id: 'landing', label: 'Hard landing', events: ['hop-main', 'land-main', 'hop-second', 'land-second'],
    note: 'Boost off the launch berm, land flat. Biggest single hit on the books.',
  },
  {
    id: 'storm', label: 'Storm clip', events: ['gust-1', 'gust-2', 'gust-3', 'gust-4', 'gust-5', 'gust-6'],
    note: 'Grinding along a storm wall: many small shoves, mostly sub-threshold. Watch the death-by-graze.',
  },
  {
    id: 'gauntlet', label: 'Full gauntlet', events: EVENTS.map((e) => e.id),
    note: 'A full bad delivery: rubble, a dock clip, one boost too far, then a storm wall. The tuning bottom line — check the final payout.',
  },
];

/* ---------------------------------------------------------- damage model */

export const soakOf = (p: Params): number => p.shield * SHIP.SOAK_PER_LEVEL;

export interface ResolvedHit {
  raw: number;  // post-threshold, post-soak impact (what MissionDirector sees)
  loss: number; // integrity fraction lost (0 for grazes/soaked hits)
}

/** The shipped chain, parameterised. */
export function resolveHit(impulse: number, p: Params): ResolvedHit {
  const raw = impulse <= p.threshold ? 0 : Math.max(0, impulse - p.threshold - soakOf(p));
  return { raw, loss: raw > SHIP.GRAZE_FLOOR ? raw * p.coef : 0 };
}

export const payoutOf = (integrity: number): number =>
  SHIP.PAYOUT_BASE + SHIP.PAYOUT_SPAN * Math.max(0, Math.min(1, integrity));

export interface PredictedRun {
  integrity: number;
  payout: number;
  shattered: boolean;
  hits: { id: string; impulse: number; loss: number }[];
}

/** Analytic replay of a sequence under a param set — deterministic, so the
 * ghost A/B, the scatter chart and the export payload all agree. */
export function predictRun(seq: Sequence, p: Params): PredictedRun {
  let integrity = 1;
  const hits: { id: string; impulse: number; loss: number }[] = [];
  for (const eid of seq.events) {
    const ev = EVENTS.find((e) => e.id === eid);
    if (!ev || ev.hop) continue;
    const { loss } = resolveHit(ev.impulse, p);
    hits.push({ id: eid, impulse: ev.impulse, loss });
    if (loss > 0) integrity = Math.max(0, integrity - loss);
    if (integrity <= 0) break; // cargo shattered — the run fails right here
  }
  return { integrity, payout: payoutOf(integrity), shattered: integrity <= 0, hits };
}

/* ------------------------------------------------------------ lab state */

export const lab = {
  params: { ...PRESETS[0].p } as Params,
  seq: 'gauntlet',
  running: false,
  muted: false,
  reducedMotion: typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  stash: null as Params | null, // ghost A param set
  ghostOn: false,               // replay the stash as a ghost alongside
};

/** Live run state — owned by the scene driver, polled (not subscribed) by UI. */
export const run = {
  t: 0,
  dist: 0,
  fade: 0,          // 0..1 ghost-bike visibility across loop resets
  y: HOVER_Y,
  vy: 0,
  airborne: false,
  bounceA: 0,       // cosmetic bounce amplitude from the last hit
  bounceT: 99,      // seconds since that hit
  wobble: 0,        // lateral storm wobble envelope 0..1
  lean: 0,          // roll kick from clips
  cumLoss: 0,
  integrity: 1,
  fired: new Set<string>(), // event ids already consumed this run
  lastFinal: null as null | { seq: string; integrity: number; payout: number; shattered: boolean },
  hitFlash: 0,      // ring-flash envelope 0..1 (amber hit)
  soakFlash: 0,     // ring-flash envelope 0..1 (teal soak)
  shake: 0,         // camera-shake envelope 0..1
};

/** Ghost-A integrity right now — analytic, no sim needed. */
export function ghostIntegrityNow(): number {
  if (!lab.ghostOn || !lab.stash) return 1;
  const seq = findSeq(lab.seq);
  let integrity = 1;
  for (const eid of seq.events) {
    const ev = EVENTS.find((e) => e.id === eid);
    if (!ev || ev.hop || ev.dist > run.dist) continue;
    integrity = Math.max(0, integrity - resolveHit(ev.impulse, lab.stash).loss);
    if (integrity <= 0) break;
  }
  return integrity;
}

/** Live damage points for the scatter chart (current run, current params). */
export const runPts: { impulse: number; loss: number; id: string }[] = [];

export interface FeedEntry { t: number; label: string; impulse: number; loss: number; raw: number }
/** Recent hit toasts for the HUD; entries expire 4.5s after their run.t. */
export const feed: FeedEntry[] = [];

export function resetRun(): void {
  run.dist = 0;
  run.cumLoss = 0;
  run.integrity = 1;
  run.fired.clear();
  run.vy = 0;
  run.airborne = false;
  run.y = HOVER_Y;
  run.wobble = 0;
  run.lean = 0;
  runPts.length = 0;
  feed.length = 0;
}

export function startRun(): void {
  resetRun();
  lab.running = true;
}

export function stopRun(): void {
  lab.running = false;
  resetRun();
}

/** Live numbers for the HUD/panel (fps written by the driver). */
export const stats = { fps: 0 };

/** Copy-payload for MissionDirector tuning — params + predicted outcomes. */
export function exportPayload() {
  return {
    note: 'Fragile-cargo preset from the cargo-shake-lab bench. Apply coef as FRAGILE_DMG in src/game/MissionDirector.tsx; threshold + soak drive src/game/Bike.tsx onCollisionEnter. payout formula is shipped: base + span × integrity.',
    params: { ...lab.params, soakPerLevel: SHIP.SOAK_PER_LEVEL },
    shipped: { ...SHIP },
    payoutCurve: `payout = ${SHIP.PAYOUT_BASE} + ${SHIP.PAYOUT_SPAN} × integrity`,
    sequences: SEQUENCES.map((seq) => {
      const p = predictRun(seq, lab.params);
      return {
        id: seq.id,
        finalIntegrity: +p.integrity.toFixed(3),
        payoutMult: +p.payout.toFixed(3),
        shattered: p.shattered,
        hits: p.hits.filter((h) => h.loss > 0).map((h) => ({
          event: h.id,
          impulse: h.impulse,
          integrityLoss: +h.loss.toFixed(4),
        })),
      };
    }),
  };
}

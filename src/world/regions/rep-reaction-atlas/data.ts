/**
 * REP REACTION ATLAS — model.
 *
 * The bench restages the *shipping* rep-reaction surfaces against a scripted
 * ride, reading the live character and mission libraries — no fixtures:
 *
 * 1. The radio pipeline (mirrored line-for-line from `src/ui/HUD.tsx`,
 *    iteration 11's band-weighted relay): cast = every character with radio
 *    lines; weights = base 1, +6 home band, +1 driftline lifers,
 *    +min(8, max(0, rep × 0.12)) for guild/choir/reclaimers; tag = nearest
 *    on-world region within radius + 260 m, centres beyond ±1800 m skipped.
 *    Cadence (14 s tick, 30 % call chance while riding and quiet) is uniform
 *    — standing changes WHO speaks, never how often.
 * 2. Board gates (`requires.rep`, schema + MissionBoard UI shipped) and
 *    rep payouts (`rewards.rep`) scanned live from src/content/missions.
 * 3. Posture bands: the Rep Ledger Bench's rail proposal
 *    (hostile <0 · wary 0–14 · neutral 15–39 · friendly 40–79 · kin 80+) —
 *    the save stores raw rep, so the Atlas borrows the same rails.
 *
 * Everything derivable is derived at module load; sliders only steer inputs.
 */
import { characters } from '../../../dialogue/library';
import { missions } from '../../../missions/library';
import { REGIONS, type RegionMeta } from '../../registry';

/* ---------- factions ------------------------------------------------------ */

export interface FactionInfo {
  id: string;
  name: string;
  short: string;
  color: string; // decoration only — the glyph is the signal
  glyph: string;
}

/** Faction colours per .ralph/DESIGN.md (same set the Ledger Bench draws). */
export const FACTIONS: FactionInfo[] = [
  { id: 'guild', name: 'Salt Guild', short: 'Guild', color: '#B07C3A', glyph: '◆' },
  { id: 'choir', name: 'The Choir', short: 'Choir', color: '#57C4B8', glyph: '◉' },
  { id: 'reclaimers', name: 'The Reclaimers', short: 'Reclaimers', color: '#B3502E', glyph: '▲' },
  { id: 'driftline', name: 'The Driftline', short: 'Driftline', color: '#FFB454', glyph: '✦' },
];

export const FACTION_BY_ID: Record<string, FactionInfo> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
);

/** The three factions the save actually tracks (`Faction` in store.ts). */
export const SLIDER_FACTIONS = ['guild', 'choir', 'reclaimers'] as const;
export type SliderFaction = (typeof SLIDER_FACTIONS)[number];
export type RepState = Record<SliderFaction, number>;
export const DEFAULT_REP: RepState = { guild: 0, choir: 0, reclaimers: 0 };

/* ---------- posture bands -------------------------------------------------- */

export interface Band {
  id: 'hostile' | 'wary' | 'neutral' | 'friendly' | 'kin';
  label: string;
  min: number; // inclusive (−Infinity for hostile)
  until: number | null; // exclusive (null = open)
  glyph: string;
  color: string;
}

/** Ledger-bench rail proposal, reused verbatim so the benches speak one language. */
export const BANDS: Band[] = [
  { id: 'hostile', label: 'HOSTILE', min: -Infinity, until: 0, glyph: '✖', color: '#E4572E' },
  { id: 'wary', label: 'WARY', min: 0, until: 15, glyph: '△', color: '#8A8578' },
  { id: 'neutral', label: 'NEUTRAL', min: 15, until: 40, glyph: '▢', color: '#D9A45B' },
  { id: 'friendly', label: 'FRIENDLY', min: 40, until: 80, glyph: '◈', color: '#57C4B8' },
  { id: 'kin', label: 'KIN', min: 80, until: null, glyph: '❖', color: '#FFC969' },
];

export function bandFor(v: number): Band {
  for (const b of BANDS) if (v < (b.until ?? Infinity)) return b;
  return BANDS[BANDS.length - 1]!;
}

/** Gauge/slider domain. Standing past 120 only matters to the ledger, not the gauges. */
export const GAUGE_MIN = -20;
export const GAUGE_MAX = 120;

/** Preset standings — one click per posture (centre of each band). */
export const PRESETS: { band: Band; value: number }[] = [
  { band: BANDS[0]!, value: -10 },
  { band: BANDS[1]!, value: 7 },
  { band: BANDS[2]!, value: 27 },
  { band: BANDS[3]!, value: 60 },
  { band: BANDS[4]!, value: 100 },
];

/* ---------- the radio cast (live library) --------------------------------- */

export interface Voice {
  id: string;
  name: string;
  faction: string;
  home: string;
  radioLines: number;
}

/** Every character with radio lines — the exact cast rule of HUD.radioCast(). */
export const CAST: Voice[] = [...characters.values()]
  .filter((c) => c.lines.radio?.length)
  .map((c) => ({
    id: c.id,
    name: c.name,
    faction: c.faction,
    home: c.home,
    radioLines: c.lines.radio?.length ?? 0,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/* ---------- the weight rules (mirroring HUD.pickRadioVoice) ---------------- */

export const WEIGHT_RULES: string[] = [
  'base 1 for every voice on the air',
  '+6 if the voice is home on the local band',
  '+1 for Driftline voices — their own channel',
  '+rep × 0.12, capped at +8, for Guild / Choir / Reclaimer voices — negative rep clamps to +0, so HOSTILE rides exactly like zero',
];

/** Rep where the standing bonus saturates at +8: ceil(8 / 0.12). */
export const SATURATION_REP = 67;

export interface VoiceWeight {
  voice: Voice;
  weight: number;
  /** share of the dial, 0..1 */
  p: number;
  boosts: string[];
}

const REP_VOICE_FACTIONS = new Set(['guild', 'choir', 'reclaimers']);

export function weighCast(local: string | null, rep: RepState): VoiceWeight[] {
  const rows: VoiceWeight[] = CAST.map((voice) => {
    let w = 1;
    const boosts: string[] = [];
    if (local && voice.home === local) {
      w += 6;
      boosts.push('+6 home band');
    }
    if (voice.faction === 'driftline') {
      w += 1;
      boosts.push('+1 own channel');
    }
    if (REP_VOICE_FACTIONS.has(voice.faction)) {
      const raw = rep[voice.faction as SliderFaction] ?? 0;
      const bonus = Math.min(8, Math.max(0, raw * 0.12));
      if (bonus > 0.005) boosts.push(`+${bonus.toFixed(1)} standing`);
      else if (raw < 0) boosts.push('hostile → clamped +0');
      w += bonus;
    }
    return { voice, weight: w, p: 0, boosts };
  });
  const total = rows.reduce((s, r) => s + r.weight, 0);
  for (const r of rows) r.p = r.weight / total;
  rows.sort((a, b) => b.weight - a.weight || a.voice.name.localeCompare(b.voice.name));
  return rows;
}

/* ---------- seeded rolls (stable across renders) --------------------------- */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One radio pick with the shipping weighting, driven by a supplied rng. */
export function rollVoice(local: string | null, rep: RepState, rng: () => number): string {
  const weights = weighCast(local, rep);
  let roll = rng();
  let acc = 0;
  for (const r of weights) {
    acc += r.p;
    if (roll <= acc) return r.voice.id;
  }
  return weights[weights.length - 1]?.voice.id ?? CAST[0]?.id ?? 'ketch';
}

/** A full subtitled line: seeded voice pick + seeded bucket draw (so scrubbing
 *  sliders never re-rolls the subtitle — only pressing the dial does). */
export function rollLine(local: string | null, rep: RepState, seed: number): { who: string; name: string; line: string } {
  const rng = mulberry32(seed);
  const who = rollVoice(local, rep, rng);
  const name = characters.get(who)?.name ?? who;
  const lines = characters.get(who)?.lines.radio ?? [];
  const line = lines.length ? lines[Math.floor(rng() * lines.length)]! : '…static, kindly static…';
  return { who, name, line };
}

export interface MonteCarlo {
  rolls: number;
  topAnalytic: string;
  topSampled: string;
  /** max |sampled share − analytic share| across the cast, in percentage points */
  maxDeltaPts: number;
  agree: boolean;
}

export const MC_ROLLS = 400;

/** 400 seeded rolls vs the analytic shares — a quiet sanity check that the
 *  bench and the shipping loop tell the same story. */
export function monteCarlo(local: string | null, rep: RepState, seed = 77): MonteCarlo {
  const weights = weighCast(local, rep);
  const rng = mulberry32(seed);
  const counts = new Map<string, number>();
  for (let i = 0; i < MC_ROLLS; i++) {
    const id = rollVoice(local, rep, rng);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let topAnalytic = weights[0]?.voice.id ?? '';
  let topSampled = '';
  let topN = -1;
  let maxDeltaPts = 0;
  for (const r of weights) {
    const n = counts.get(r.voice.id) ?? 0;
    if (n > topN) {
      topN = n;
      topSampled = r.voice.id;
    }
    maxDeltaPts = Math.max(maxDeltaPts, Math.abs(n / MC_ROLLS - r.p) * 100);
  }
  return { rolls: MC_ROLLS, topAnalytic, topSampled, maxDeltaPts, agree: topAnalytic === topSampled };
}

/* ---------- the band rule (mirroring HUD.localBandRegion) ------------------ */

export const BAND_SKIRT = 260;

/** On-world per the shipping rule: centre within ±1800 m. NOTE: this includes
 *  hover-playground — GAMEPLAY_EXCLUDED is not consulted by the band rule,
 *  and the Atlas says so in its flags. */
export const ONWORLD: RegionMeta[] = [...REGIONS.values()]
  .map((r) => r.meta)
  .filter((m) => Math.abs(m.center[0]) <= 1800 && Math.abs(m.center[1]) <= 1800);

export function bandAt(x: number, z: number): RegionMeta | null {
  let best: RegionMeta | null = null;
  let bestD = Infinity;
  for (const m of ONWORLD) {
    const d = Math.hypot(x - m.center[0], z - m.center[1]);
    if (d < m.radius + BAND_SKIRT && d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/* ---------- the scripted survey ride --------------------------------------- */

/** The Saltmouth loop: every on-world band once, home for supper. */
const ROUTE_ORDER = [
  'saltmouth',
  'choirhollow',
  'mothersgate',
  'canyon-slalom',
  'windspine',
  'glassroad',
  'drowned-array',
  'skydocks',
  'cinderflats',
];

export interface Stop {
  slug: string;
  name: string;
  x: number;
  z: number;
}

export const STOPS: Stop[] = ROUTE_ORDER.map((slug) => {
  const m = REGIONS.get(slug)?.meta;
  return m ? { slug, name: m.name, x: m.center[0], z: m.center[1] } : null;
}).filter((s): s is Stop => s !== null);

interface Leg {
  from: Stop;
  to: Stop;
  len: number;
  start: number; // cumulative distance at leg start
}

const LEGS: Leg[] = (() => {
  const out: Leg[] = [];
  if (STOPS.length < 2) return out;
  let acc = 0;
  for (let i = 0; i < STOPS.length; i++) {
    const from = STOPS[i]!;
    const to = STOPS[(i + 1) % STOPS.length]!;
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    out.push({ from, to, len, start: acc });
    acc += len;
  }
  return out;
})();

export const ROUTE_LENGTH = LEGS.length ? LEGS[LEGS.length - 1]!.start + LEGS[LEGS.length - 1]!.len : 0;

/** Point on the closed route at t ∈ [0,1), parametrised by distance. */
export function pointAt(t: number): { x: number; z: number } {
  if (!LEGS.length || ROUTE_LENGTH <= 0) return { x: 0, z: 0 };
  const d = ((t % 1) + 1) % 1 * ROUTE_LENGTH;
  for (const leg of LEGS) {
    if (d <= leg.start + leg.len || leg === LEGS[LEGS.length - 1]) {
      const k = leg.len > 0 ? (d - leg.start) / leg.len : 0;
      return { x: leg.from.x + (leg.to.x - leg.from.x) * k, z: leg.from.z + (leg.to.z - leg.from.z) * k };
    }
  }
  return { x: STOPS[0]!.x, z: STOPS[0]!.z };
}

/* ---------- live content scans --------------------------------------------- */

/** Missions that gate on standing (schema + board UI ship; this is usage). */
export const REP_GATED: { id: string; rep: Record<string, number> }[] = missions
  .filter((m) => m.requires?.rep && Object.keys(m.requires.rep).length > 0)
  .map((m) => ({ id: m.id, rep: m.requires!.rep as Record<string, number> }));

/** Total rep the library pays per faction key — including keys the save type
 *  doesn't model (driftline rides in through the JSON). */
export const REP_PAID: Record<string, { total: number; givers: number }> = (() => {
  const out: Record<string, { total: number; givers: number }> = {};
  for (const m of missions) {
    for (const [f, n] of Object.entries((m.rewards?.rep ?? {}) as Record<string, number>)) {
      const row = (out[f] ??= { total: 0, givers: 0 });
      row.total += n;
      row.givers += 1;
    }
  }
  return out;
})();

/** Lowest rep payout in the library — proves nothing can push a faction hostile. */
const ALL_PAYOUTS = missions.flatMap((m) => Object.values((m.rewards?.rep ?? {}) as Record<string, number>));
export const MIN_REP_REWARD = ALL_PAYOUTS.length ? Math.min(...ALL_PAYOUTS) : 0;

/** Line buckets whose names branch on a posture band — the scan says zero. */
export const TIERED_BUCKETS = new Set(['hostile', 'wary', 'neutral', 'friendly', 'kin']);
export const TIERED_LINE_COUNT = [...characters.values()].reduce(
  (n, c) =>
    n +
    Object.keys(c.lines).filter((k) => TIERED_BUCKETS.has(k.toLowerCase())).length,
  0,
);

/** Shipping chatter cadence: 14 s tick, 30 % call chance while riding & quiet. */
export const LINES_PER_MIN = (60 / 14) * 0.3;

/* ---------- coverage matrix ------------------------------------------------- */

export type CellState = 'shipped' | 'ready' | 'gap' | 'na';

export interface MatrixCell {
  state: CellState;
  text: string;
}

export interface MatrixRow {
  id: string;
  title: string;
  glyph: string;
  blurb: string;
  cells: Record<string, MatrixCell>;
}

export const CELL_STYLE: Record<CellState, { glyph: string; color: string; word: string }> = {
  shipped: { glyph: '✓', color: '#57C4B8', word: 'shipped' },
  ready: { glyph: '◌', color: '#D9A45B', word: 'runtime-ready, content silent' },
  gap: { glyph: '✕', color: '#E4572E', word: 'no hook — a true gap' },
  na: { glyph: '—', color: '#8A8578', word: 'not applicable' },
};

const c = (state: CellState, text: string): MatrixCell => ({ state, text });

export function buildMatrix(): MatrixRow[] {
  const paid = (f: string) => REP_PAID[f] ?? { total: 0, givers: 0 };
  const gatedFor = (f: string) => REP_GATED.filter((g) => g.rep[f] != null).length;
  const gateCell = (f: string): MatrixCell =>
    c('ready', `schema + board UI shipped — ${gatedFor(f)} jobs gate on ${f} standing`);
  return [
    {
      id: 'payouts',
      title: 'Content pays standing',
      glyph: '▤',
      blurb: 'Mission rewards write rep into the save.',
      cells: {
        guild: c('shipped', `+${paid('guild').total} across ${paid('guild').givers} jobs`),
        choir: c('shipped', `+${paid('choir').total} across ${paid('choir').givers} jobs`),
        reclaimers: c('shipped', `+${paid('reclaimers').total} across ${paid('reclaimers').givers} jobs`),
        driftline: c(
          'ready',
          `+${paid('driftline').total} paid across ${paid('driftline').givers} jobs — but the save type never models or reads it`,
        ),
      },
    },
    {
      id: 'radio-weight',
      title: 'Radio airtime answers to standing',
      glyph: '◉',
      blurb: 'Who the band favours when the ticker spins.',
      cells: {
        guild: c('shipped', '+rep × 0.12, capped +8 (saturates at 67)'),
        choir: c('shipped', '+rep × 0.12, capped +8 (saturates at 67)'),
        reclaimers: c('shipped', '+rep × 0.12, capped +8 (saturates at 67)'),
        driftline: c('na', 'no rep key — a fixed +1 lifer bonus instead'),
      },
    },
    {
      id: 'radio-lines',
      title: 'What they SAY answers to standing',
      glyph: '❝',
      blurb: 'Tier-branched radio lines (hostile voice, kin voice…).',
      cells: {
        guild: c('gap', `${TIERED_LINE_COUNT} band-branched lines in the whole cast`),
        choir: c('gap', `${TIERED_LINE_COUNT} band-branched lines in the whole cast`),
        reclaimers: c('gap', `${TIERED_LINE_COUNT} band-branched lines in the whole cast`),
        driftline: c('gap', `${TIERED_LINE_COUNT} band-branched lines in the whole cast`),
      },
    },
    {
      id: 'callouts',
      title: 'NPC callouts react to standing',
      glyph: '⚇',
      blurb: 'Barks or greetings that branch on how they rate you.',
      cells: {
        guild: c('gap', 'greetings + barks ship flat — no rep branch reads them'),
        choir: c('gap', 'greetings + barks ship flat — no rep branch reads them'),
        reclaimers: c('gap', 'greetings + barks ship flat — no rep branch reads them'),
        driftline: c('gap', 'greetings + barks ship flat — no rep branch reads them'),
      },
    },
    {
      id: 'board-gates',
      title: 'The board gates on standing',
      glyph: '▣',
      blurb: 'requires.rep keeps a job tucked away until you rate.',
      cells: {
        guild: gateCell('guild'),
        choir: gateCell('choir'),
        reclaimers: gateCell('reclaimers'),
        driftline: c('na', 'driftline is not a gateable faction in the schema'),
      },
    },
    {
      id: 'prices',
      title: 'Shops price by standing',
      glyph: '⛁',
      blurb: 'Garage parts and exchange terms bend with reputation.',
      cells: {
        guild: c('gap', 'exchange reads guild rep for display only — costs never move'),
        choir: c('gap', 'no choir storefront exists at all'),
        reclaimers: c('gap', 'no reclaimer storefront exists at all'),
        driftline: c('na', 'Ketch works for love and bond money'),
      },
    },
    {
      id: 'debt-beats',
      title: 'Story beats mark the relationship',
      glyph: '◆',
      blurb: 'Scripted milestones that make standing legible.',
      cells: {
        guild: c('shipped', 'bond-milestone barks at 25/50/75 % + wax-seal clear line (+12 rep)'),
        choir: c('gap', 'no counterpart rite — the Choir never comments on your standing'),
        reclaimers: c('gap', 'no counterpart tally — the Yards never comment on your standing'),
        driftline: c('gap', 'no counterpart — Ketch keeps his feelings off the ledger'),
      },
    },
  ];
}

/* ---------- flags ----------------------------------------------------------- */

export interface Flag {
  id: string;
  severity: 'warn' | 'note';
  glyph: string;
  title: string;
  detail: string;
  /** faction ids + slug-ish codes shown as marks */
  factions: string[];
}

export function buildFlags(): Flag[] {
  const drift = REP_PAID['driftline'] ?? { total: 0, givers: 0 };
  const benchLeaks = ONWORLD.some((m) => m.slug === 'hover-playground');
  const flags: Flag[] = [
    {
      id: 'hostile-silent',
      severity: 'warn',
      glyph: '✖',
      title: 'HOSTILE is a painted band nobody can reach',
      detail: `Every rep payout in the library is ≥ ${MIN_REP_REWARD} and the radio clamp reads negative rep as +0 — hostile plays identically to zero on every shipped surface. If a feud can be lost, nothing in the build will say so.`,
      factions: ['guild', 'choir', 'reclaimers'],
    },
    {
      id: 'driftline-ghost',
      severity: 'warn',
      glyph: '✦',
      title: 'The ledger pays ghost rep',
      detail: `${drift.total} points of driftline standing ride in on ${drift.givers} mission rewards, straight into a key the \`Faction\` type doesn't name — summed by the completion handler, never read by anything.`,
      factions: ['driftline'],
    },
    {
      id: 'gates-unused',
      severity: 'warn',
      glyph: '△',
      title: 'Every gate on the job board hangs open',
      detail: `requires.rep shipped in the schema, the runtime filter and the board UI — and ${REP_GATED.length} missions use it. Standing currently unlocks nothing.`,
      factions: ['guild', 'choir', 'reclaimers'],
    },
    {
      id: 'price-blind',
      severity: 'warn',
      glyph: '⛁',
      title: 'No shop on Kessa-9 has heard of you',
      detail:
        'Garage costs are fixed constants and the exchange displays guild rep without ever pricing by it. Friends pay what strangers pay.',
      factions: ['guild', 'choir', 'reclaimers'],
    },
    {
      id: 'saturation',
      severity: 'note',
      glyph: '❖',
      title: `KIN sounds like ${SATURATION_REP}`,
      detail: `The radio bonus caps at +8 (rep ${SATURATION_REP}), so on the air, kin (80+) is indistinguishable from mid-friendly. Nothing celebrates the top rail.`,
      factions: ['guild', 'choir', 'reclaimers'],
    },
    {
      id: 'cadence-flat',
      severity: 'note',
      glyph: '◌',
      title: 'Standing changes voices, never the beat',
      detail: `The 14 s tick × 30 % call chance runs ~${LINES_PER_MIN.toFixed(1)} lines/min at every standing and every band. A beloved courier is not greeted more often — just by warmer names.`,
      factions: [],
    },
    {
      id: 'lines-flat',
      severity: 'note',
      glyph: '❝',
      title: 'Nobody says the quiet part',
      detail: `${TIERED_LINE_COUNT} of the cast's line buckets branch on posture. Proposed convention for writers: \`radio_hostile\` / \`radio_kin\` buckets, read by a tiny tier-aware pickLine.`,
      factions: ['guild', 'choir', 'reclaimers', 'driftline'],
    },
  ];
  if (benchLeaks) {
    flags.push({
      id: 'bench-leak',
      severity: 'note',
      glyph: '◇',
      title: 'The workshed has its own radio band',
      detail:
        'hover-playground sits within the ±1800 m band rule although GAMEPLAY_EXCLUDED only stops it streaming. Ride within 320 m of the test pan and the ticker dutifully reads RADIO · HOVER PLAYGROUND.',
      factions: [],
    });
  }
  return flags;
}

/* ---------- export ----------------------------------------------------------- */

/** The whole sheet as markdown the writers can claim from. */
export function buildExport(rep: RepState): string {
  const lines: string[] = [];
  lines.push('# Rep Reaction Atlas — coverage sheet');
  lines.push('');
  lines.push(
    `Standing at export: ${SLIDER_FACTIONS.map((f) => `${FACTION_BY_ID[f]!.glyph} ${f} ${rep[f]} (${bandFor(rep[f]).label.toLowerCase()})`).join(' · ')}`,
  );
  lines.push('');
  lines.push('## Coverage matrix');
  lines.push('');
  lines.push(`| Surface | ${FACTIONS.map((f) => `${f.glyph} ${f.name}`).join(' | ')} |`);
  lines.push(`| --- | ${FACTIONS.map(() => '---').join(' | ')} |`);
  for (const row of buildMatrix()) {
    lines.push(
      `| ${row.glyph} ${row.title} | ${FACTIONS.map((f) => {
        const cell = row.cells[f.id] ?? c('na', '—');
        return `${CELL_STYLE[cell.state].glyph} ${CELL_STYLE[cell.state].word} — ${cell.text}`;
      }).join(' | ')} |`,
    );
  }
  lines.push('');
  lines.push('## Flags');
  lines.push('');
  for (const f of buildFlags()) {
    lines.push(`- **${f.severity === 'warn' ? 'WARN' : 'note'}** ${f.glyph} ${f.title} — ${f.detail}`);
  }
  lines.push('');
  lines.push('## Claims for the writers');
  lines.push('');
  lines.push('- 3 × `radio_hostile` line sets (one per client faction) + a tier-aware pickLine.');
  lines.push('- 2+ missions each using `requires.rep` (one friendly gate, one kin gate) so the board UI ships its lock reasons.');
  lines.push('- A garage discount hook keying on guild rep — one multiplier in the wallet and the exchange rows spring to life.');
  lines.push('- Resolve ghost driftline rep: either track it (craft perks at Ketch?) or stop paying it in mission JSON.');
  lines.push('');
  lines.push('_Surveyed by the Rep Reaction Atlas from the live mission + character libraries._');
  return lines.join('\n');
}

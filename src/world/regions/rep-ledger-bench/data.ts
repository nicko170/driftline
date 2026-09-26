/**
 * Rep Ledger Bench data: factions, standing tiers, and the full ledger model
 * built live from the mission library — chapter×faction flow matrix, story-only
 * and completionist end standings, a mission-ordered journey, the per-chapter
 * waterfall, audit flags, and the copy-paste rebalance export.
 *
 * The four factions here include the Driftline itself: mission JSONs pay
 * driftline rep even though the save type only names the three client
 * factions — the bench charts what content actually ships.
 */
import { missions, type Mission } from '../../../missions/library';
import { CHAPTERS } from '../../../missions/chapters';

/* ---------- factions ------------------------------------------------------ */

export interface FactionInfo {
  id: string;
  name: string;
  short: string;
  color: string; // decoration only — the glyph is the signal
  glyph: string;
}

/** Faction colours per .ralph/DESIGN.md. */
export const FACTIONS: FactionInfo[] = [
  { id: 'driftline', name: 'The Driftline', short: 'Driftline', color: '#FFB454', glyph: '✦' },
  { id: 'guild', name: 'Salt Guild', short: 'Guild', color: '#B07C3A', glyph: '◆' },
  { id: 'choir', name: 'The Choir', short: 'Choir', color: '#57C4B8', glyph: '◉' },
  { id: 'reclaimers', name: 'The Reclaimers', short: 'Reclaimers', color: '#B3502E', glyph: '▲' },
];

export const FACTION_BY_ID: Record<string, FactionInfo> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
);

/* ---------- standing tiers ------------------------------------------------ */

export interface Tier {
  id: 'hostile' | 'wary' | 'neutral' | 'friendly' | 'kin';
  label: string;
  min: number; // inclusive lower bound (−Infinity for hostile)
  until: number | null; // exclusive upper bound (null = open)
  glyph: string;
  color: string;
}

/**
 * The bench's rail proposal — the game stores raw rep with no named tiers,
 * so these are the thresholds every chart on the bench measures against.
 */
export const TIERS: Tier[] = [
  { id: 'hostile', label: 'HOSTILE', min: -Infinity, until: 0, glyph: '✖', color: '#E4572E' },
  { id: 'wary', label: 'WARY', min: 0, until: 15, glyph: '△', color: '#8A8578' },
  { id: 'neutral', label: 'NEUTRAL', min: 15, until: 40, glyph: '▢', color: '#D9A45B' },
  { id: 'friendly', label: 'FRIENDLY', min: 40, until: 80, glyph: '◈', color: '#57C4B8' },
  { id: 'kin', label: 'KIN', min: 80, until: null, glyph: '❖', color: '#FFC969' },
];

const FRIENDLY_MIN = 40;
const KIN_MIN = 80;

export function tierFor(v: number): Tier {
  for (const t of TIERS) if (v < (t.until ?? Infinity)) return t;
  return TIERS[TIERS.length - 1];
}

/* ---------- the ledger ----------------------------------------------------- */

export interface LedgerRow {
  mission: Mission;
  story: boolean;
  chapterLabel: string;
  /** rep per faction id (all four present, zeros filled) */
  rep: Record<string, number>;
  total: number;
  /** mission ids share a row set: chapter key → faction → { amount, count } for tooltips */
}

function repOf(m: Mission): Record<string, number> {
  const src = (m.rewards?.rep ?? {}) as unknown as Record<string, number | undefined>;
  const out: Record<string, number> = {};
  for (const f of FACTIONS) out[f.id] = src[f.id] ?? 0;
  return out;
}

export const ROWS: LedgerRow[] = missions.map((m) => {
  const rep = repOf(m);
  return {
    mission: m,
    story: m.chapter !== 'side',
    chapterLabel: m.chapter === 'side' ? 'SIDE' : `CH ${m.chapter}`,
    rep,
    total: Object.values(rep).reduce((a, b) => a + b, 0),
  };
});

function addRep(dst: Record<string, number>, rep: Record<string, number>) {
  for (const f of FACTIONS) dst[f.id] = (dst[f.id] ?? 0) + rep[f.id];
}

/* ---------- chapter nodes (sankey left column) ------------------------------- */

export interface ChapterNode {
  key: string; // '1'..'5' | 'side'
  label: string; // 'CH 1' | 'SIDE'
  title: string; // chapter title or 'Side jobs'
  totals: Record<string, number>;
  sum: number;
  missions: number;
  story: boolean;
}

function buildNode(key: string, label: string, title: string, story: boolean, rows: LedgerRow[]): ChapterNode {
  const totals: Record<string, number> = {};
  for (const r of rows) addRep(totals, r.rep);
  return {
    key, label, title, totals, missions: rows.length, story,
    sum: Object.values(totals).reduce((a, b) => a + b, 0),
  };
}

export const NODES: ChapterNode[] = (() => {
  const out: ChapterNode[] = [];
  for (const c of CHAPTERS) {
    const rows = ROWS.filter((r) => r.mission.chapter === c.n);
    if (!rows.length) continue;
    out.push(buildNode(String(c.n), `CH ${c.n}`, c.title, true, rows));
  }
  const side = ROWS.filter((r) => !r.story);
  if (side.length) out.push(buildNode('side', 'SIDE', 'Side jobs', false, side));
  return out;
})();

/* ---------- flow cell matrix (chapter × faction, for tooltips/details) ------- */

export interface FlowCell {
  chapter: string;
  faction: string;
  amount: number;
  count: number;
}

export const FLOW_CELLS: FlowCell[] = (() => {
  const out: FlowCell[] = [];
  for (const node of NODES) {
    const rows = ROWS.filter((r) => String(r.mission.chapter) === node.key);
    for (const f of FACTIONS) {
      let amount = 0;
      let count = 0;
      for (const r of rows) {
        const v = r.rep[f.id] ?? 0;
        if (v) {
          amount += v;
          count++;
        }
      }
      if (amount) out.push({ chapter: node.key, faction: f.id, amount, count });
    }
  }
  return out;
})();

/* ---------- end standings ----------------------------------------------------- */

export const STORY_END: Record<string, number> = {};
export const ALL_END: Record<string, number> = {};
for (const r of ROWS) {
  addRep(ALL_END, r.rep);
  if (r.story) addRep(STORY_END, r.rep);
}

export const GRAND_TOTAL = Object.values(ALL_END).reduce((a, b) => a + b, 0);
export const STORY_TOTAL = Object.values(STORY_END).reduce((a, b) => a + b, 0);

/** Shared vertical scale for the waterfall/rails/journey charts. */
export const CHART_MAX = Math.ceil(Math.max(KIN_MIN, ...Object.values(ALL_END)) / 10) * 10;

/* ---------- completionist journey (sparklines) --------------------------------- */

export interface JourneyChapterMark {
  index: number; // index INTO ROWS where this bucket ends (inclusive)
  label: string;
}

export interface JourneyModel {
  /** per faction: cumulative standing after each row (length = ROWS.length) */
  lines: Record<string, number[]>;
  marks: JourneyChapterMark[];
}

export const JOURNEY: JourneyModel = (() => {
  const lines: Record<string, number[]> = {};
  for (const f of FACTIONS) lines[f.id] = [];
  const cum: Record<string, number> = {};
  const marks: JourneyChapterMark[] = [];
  let lastKey = '';
  ROWS.forEach((r, i) => {
    for (const f of FACTIONS) {
      cum[f.id] = (cum[f.id] ?? 0) + r.rep[f.id];
      lines[f.id].push(cum[f.id]);
    }
    const key = String(r.mission.chapter);
    if (key !== lastKey) {
      if (lastKey) marks[marks.length - 1].index = i - 1;
      marks.push({ index: i, label: key === 'side' ? 'SIDE' : `CH ${key}` });
      lastKey = key;
    }
  });
  if (marks.length) marks[marks.length - 1].index = ROWS.length - 1;
  return { lines, marks };
})();

/* ---------- per-chapter waterfall ---------------------------------------------- */

export interface WaterfallColumn {
  key: string;
  label: string;
  story: boolean;
  /** per faction id: delta for this column and cumulative after it */
  bar: Record<string, { delta: number; from: number; to: number }>;
}

export const WATERFALL: WaterfallColumn[] = (() => {
  const cum: Record<string, number> = {};
  const cols: WaterfallColumn[] = [];
  for (const node of NODES) {
    const bar: WaterfallColumn['bar'] = {};
    for (const f of FACTIONS) {
      const from = cum[f.id] ?? 0;
      const delta = node.totals[f.id] ?? 0;
      const to = from + delta;
      bar[f.id] = { delta, from, to };
      cum[f.id] = to;
    }
    cols.push({ key: node.key, label: node.label, story: node.story, bar });
  }
  return cols;
})();

/* ---------- audit flags --------------------------------------------------------- */

export interface LedgerFlag {
  id: string;
  severity: 'warn' | 'note';
  glyph: string; // shape marker — carries the severity, colour only decorates
  title: string;
  detail: string;
  /** faction ids + mission ids referenced (rendered as chips) */
  factions: string[];
  missions: string[];
}

/** Feuds the fiction already established; a story job paying both ends ≥ HEDGE_MIN washes the deltas out. */
const TENSIONS: [string, string, string][] = [
  ['guild', 'reclaimers', 'the salvage feud — who owns what the storm drops'],
  ['choir', 'reclaimers', 'the infrastructure rites — stripping what the Choir prays to'],
];
const HEDGE_MIN = 5;

export const FLAGS: LedgerFlag[] = (() => {
  const flags: LedgerFlag[] = [];

  // 1. stranded factions
  for (const f of FACTIONS) {
    const story = STORY_END[f.id];
    const all = ALL_END[f.id];
    if (all < KIN_MIN) {
      flags.push({
        id: `strand-kin-${f.id}`,
        severity: 'warn',
        glyph: '⚠',
        title: `${f.glyph} ${f.name} can never hear ${'KIN'} called`,
        detail: `Even running every posted job, the ledger tops ${f.short} out at ${all} — ${KIN_MIN - all} points short of the kin rail (${KIN_MIN}+). The top tier is unreachable content as shipped.`,
        factions: [f.id],
        missions: [],
      });
    }
    if (story < FRIENDLY_MIN) {
      flags.push({
        id: `strand-friendly-${f.id}`,
        severity: 'warn',
        glyph: '⚠',
        title: `${f.glyph} The story alone never befriends ${f.short}`,
        detail: `Story missions alone end at ${story} (${tierFor(story).label.toLowerCase()}) — ${FRIENDLY_MIN - story} short of friendly (${FRIENDLY_MIN}+). A mainline player who skips the board never learns their first name.`,
        factions: [f.id],
        missions: [],
      });
    } else if (story < KIN_MIN && all >= KIN_MIN) {
      flags.push({
        id: `side-gated-${f.id}`,
        severity: 'note',
        glyph: '◌',
        title: `${f.glyph} ${f.short} kin is a side-job promise`,
        detail: `Story alone ends at ${story} (${tierFor(story).label.toLowerCase()}); the kin rail (${KIN_MIN}+) only opens once side jobs land. That's a defensible curve — flagged so the board keeps paying them meaningfully.`,
        factions: [f.id],
        missions: [],
      });
    }
  }

  // 2. story missions paying both sides of a feud
  for (const r of ROWS) {
    if (!r.story) continue;
    for (const [a, b, feud] of TENSIONS) {
      if (r.rep[a] >= HEDGE_MIN && r.rep[b] >= HEDGE_MIN) {
        flags.push({
          id: `hedge-${r.mission.id}-${a}-${b}`,
          severity: 'warn',
          glyph: '⇄',
          title: `⇄ “${r.mission.title}” pays both ends of ${feud.split(' — ')[0]}`,
          detail: `${r.chapterLabel} story job hands ${FACTION_BY_ID[a].glyph} ${FACTION_BY_ID[a].short} +${r.rep[a]} and ${FACTION_BY_ID[b].glyph} ${FACTION_BY_ID[b].short} +${r.rep[b]} at once — the deltas fight each other and the faction read-out of the moment washes flat (${feud}). If the fiction intends a brokered truce, consider making it a choice instead.`,
          factions: [a, b],
          missions: [r.mission.id],
        });
      }
    }
  }

  // 3. structural notes
  const negatives = ROWS.filter((r) => r.total < 0 || Object.values(r.rep).some((v) => v < 0));
  if (!negatives.length) {
    flags.push({
      id: 'no-negatives',
      severity: 'note',
      glyph: '◌',
      title: `The ledger has no costs`,
      detail: `Across ${ROWS.length} missions not one reputation delta goes negative — every delivery only adds. The hostile rail exists but nothing writes to it. If a choice should ever burn a bridge, that's a new mechanic, not a tuning pass.`,
      factions: [],
      missions: [],
    });
  }
  const repGates = missions.filter((m) => m.requires?.rep && Object.keys(m.requires.rep).length);
  if (!repGates.length) {
    flags.push({
      id: 'no-rep-gates',
      severity: 'note',
      glyph: '◌',
      title: `No mission ever checks a rail`,
      detail: `The runtime supports requires.rep gates, and this bench measures four tiers of standing — but zero missions gate on reputation. Every rail in these charts is decorative until somebody demands “${tierFor(KIN_MIN).label.toLowerCase()} with the Guild” at a door.`,
      factions: [],
      missions: [],
    });
  }

  return flags;
})();

export const WARN_COUNT = FLAGS.filter((f) => f.severity === 'warn').length;

/* ---------- rebalance export ----------------------------------------------------- */

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const cell = (v: number) => (v ? String(v) : '·');

export function buildExport(): string {
  const L: string[] = [];
  L.push(`DRIFTLINE — REP LEDGER EXPORT`);
  L.push(`${ROWS.length} missions · ${GRAND_TOTAL} rep in circulation (story ${STORY_TOTAL} / side ${GRAND_TOTAL - STORY_TOTAL})`);
  L.push(`Rails: WARY 0–14 · NEUTRAL 15–39 · FRIENDLY 40–79 · KIN 80+ · (HOSTILE <0 — nothing writes there)`);
  L.push('');
  const heads = ['MISSION', 'CH', 'TYPE', ...FACTIONS.map((f) => f.short.toUpperCase()), 'SUM'];
  L.push(heads.map((h, i) => pad(h, i === 0 ? 28 : i === 1 ? 6 : i === 2 ? 9 : 6)).join(' '));
  for (const r of ROWS) {
    L.push(
      [
        pad(r.mission.id, 28),
        pad(r.chapterLabel, 6),
        pad(r.mission.type, 9),
        ...FACTIONS.map((f) => pad(cell(r.rep[f.id]), 6)),
        pad(String(r.total), 6),
      ].join(''),
    );
  }
  L.push('');
  L.push(pad('CHAPTER TOTALS', 28) + FACTIONS.map((f) => pad(f.short.toUpperCase(), 6)).join(' '));
  for (const n of NODES) {
    L.push(pad(`${n.label} ${n.title}`, 28) + FACTIONS.map((f) => pad(cell(n.totals[f.id] ?? 0), 6)).join(' '));
  }
  L.push('');
  L.push(
    pad('STORY-ONLY END', 28) +
      FACTIONS.map((f) => pad(`${STORY_END[f.id]}`, 6)).join(' ') +
      '   ' +
      FACTIONS.map((f) => `${f.short}: ${tierFor(STORY_END[f.id]).label.toLowerCase()}`).join(' · '),
  );
  L.push(
    pad('COMPLETIONIST END', 28) +
      FACTIONS.map((f) => pad(`${ALL_END[f.id]}`, 6)).join(' ') +
      '   ' +
      FACTIONS.map((f) => `${f.short}: ${tierFor(ALL_END[f.id]).label.toLowerCase()}`).join(' · '),
  );
  if (FLAGS.length) {
    L.push('');
    L.push('FLAGS');
    for (const f of FLAGS) {
      L.push(`${f.severity === 'warn' ? '[!]' : '[ ]'} ${f.title}`);
      L.push(`     ${f.detail}`);
    }
  }
  return L.join('\n');
}

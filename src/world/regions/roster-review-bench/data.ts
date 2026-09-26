/**
 * Roster Review Bench data: factions, the live roster, line-bucket
 * definitions and the audit rules. Reads the real character library, so the
 * bench can never drift from shipped content.
 */
import { characters, type Character } from '../../../dialogue/library';
import type { DialogueChoice, DialogueLine } from '../../../state/store';

/* ---------- factions ---------------------------------------------------- */

export interface FactionInfo {
  id: string;
  name: string;
  color: string; // hex — decoration only; the glyph is the signal
  glyph: string;
}

/** Faction colours per .ralph/DESIGN.md; `independent` falls back to bone. */
export const FACTIONS: Record<string, FactionInfo> = {
  driftline: { id: 'driftline', name: 'The Driftline', color: '#FFB454', glyph: '✦' },
  guild: { id: 'guild', name: 'Salt Guild', color: '#B07C3A', glyph: '◆' },
  choir: { id: 'choir', name: 'The Choir', color: '#57C4B8', glyph: '◉' },
  reclaimers: { id: 'reclaimers', name: 'The Reclaimers', color: '#B3502E', glyph: '▲' },
  independent: { id: 'independent', name: 'Independent', color: '#E4D7BE', glyph: '▣' },
};

export const FACTION_ORDER = ['driftline', 'guild', 'choir', 'reclaimers', 'independent'];

export const factionOf = (c: Character): FactionInfo =>
  FACTIONS[c.faction] ?? FACTIONS.independent;

/* ---------- line buckets ------------------------------------------------ */

/** The four core buckets the game draws from (see .ralph/ROUTES.md schema). */
export interface BucketInfo {
  id: string;
  label: string;
  hint: string;
}

export const CORE_BUCKETS: BucketInfo[] = [
  { id: 'greetings', label: 'Greeting', hint: 'what they say when you walk up' },
  { id: 'barks', label: 'Bark', hint: 'one-liners while you poke around' },
  { id: 'mission', label: 'Mission', hint: 'job hand-offs and reminders' },
  { id: 'radio', label: 'Radio', hint: 'chatter while you ride' },
];

/** Schema minimum from .ralph/ROUTES.md — lines total across all buckets. */
export const MIN_LINES = 8;

/* ---------- roster ------------------------------------------------------- */

export type PaintState = 'painted' | 'stale' | 'unsat';

export const PAINT_LABEL: Record<PaintState, string> = {
  painted: 'PORTRAIT LIVE',
  stale: 'FRAME STALE', // JSON declares a portrait but the file 404s
  unsat: 'AWAITING SITTING', // no portrait declared at all
};

export interface RosterEntry {
  character: Character;
  faction: FactionInfo;
  declaredArt?: string;
  /** total lines across every bucket (core + emergent) */
  totalLines: number;
  /** core buckets with zero lines */
  missingBuckets: string[];
  /** buckets beyond the core four (storms, night, rumors…) */
  extraBuckets: string[];
  /** cycle offset so the cards don't all flip on the same beat */
  offset: number;
}

/** Deterministic small hash for cycling offsets. */
export function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function lineCount(c: Character): number {
  return Object.values(c.lines).reduce((n, arr) => n + (arr?.length ?? 0), 0);
}

const all = [...characters.values()].sort((a, b) => a.name.localeCompare(b.name));

export const ROSTER: RosterEntry[] = all.map((c) => {
  const core = new Set(CORE_BUCKETS.map((b) => b.id));
  return {
    character: c,
    faction: factionOf(c),
    declaredArt: c.portrait,
    totalLines: lineCount(c),
    missingBuckets: CORE_BUCKETS.filter((b) => !c.lines[b.id]?.length).map((b) => b.id),
    extraBuckets: Object.keys(c.lines).filter((k) => !core.has(k) && (c.lines[k]?.length ?? 0) > 0),
    offset: hashOf(c.id),
  };
});

export const factionCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const e of ROSTER) counts[e.faction.id] = (counts[e.faction.id] ?? 0) + 1;
  return counts;
};

/** Current line of a bucket for a card: shuffles on each shared tick. */
export function lineForTick(e: RosterEntry, bucketId: string, tick: number): string | null {
  const arr = e.character.lines[bucketId];
  if (!arr?.length) return null;
  return arr[(tick + e.offset) % arr.length];
}

/* ---------- audit -------------------------------------------------------- */

export interface Audit {
  flagged: boolean;
  reasons: string[];
}

export function auditEntry(e: RosterEntry, paint: PaintState): Audit {
  const reasons: string[] = [];
  if (paint === 'unsat') reasons.push('no portrait declared');
  if (paint === 'stale') reasons.push('declared art 404s');
  if (e.totalLines < MIN_LINES) reasons.push(`only ${e.totalLines} lines (min ${MIN_LINES})`);
  if (e.missingBuckets.length) reasons.push(`no ${e.missingBuckets.join(' / ')} lines`);
  return { flagged: reasons.length > 0, reasons };
}

/* ---------- live staging -------------------------------------------------- */

/**
 * A three-beat rehearsal scene — greeting, bark, mission line — exactly the
 * shape a mission's "offer" block carries. Falls back through the buckets if
 * one is empty so the box always has something to say for itself.
 */
export function buildScene(c: Character): DialogueLine[] {
  const picks: DialogueLine[] = [];
  for (const bucket of ['greetings', 'barks', 'mission']) {
    const arr = c.lines[bucket];
    if (arr?.length) picks.push({ who: c.id, text: arr[(hashOf(c.id) + picks.length) % arr.length] });
  }
  if (!picks.length) {
    picks.push({ who: c.id, text: '…(this frequency is silent — the line sheet is empty)' });
  }
  return picks;
}

/** End-of-scene choice: proves the flag pipeline without touching story flags. */
export function rehearsalChoices(c: Character): DialogueChoice {
  const first = c.name.split(' ')[0];
  return {
    prompt: 'Bench check — how did the take read?',
    options: [
      { text: `${first} reads true. Log it.`, setsFlag: 'bench.roster-rehearsed' },
      { text: 'Cut — from the top.', setsFlag: 'bench.roster-cut' },
    ],
  };
}

/** Next radio line for the character, walking the bucket in order. */
export function radioLineAt(c: Character, n: number): string | null {
  const arr = c.lines.radio;
  return arr?.length ? arr[n % arr.length] : null;
}

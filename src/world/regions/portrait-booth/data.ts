/**
 * Portrait Booth data: faction table, wall entries and the re-roll prompt
 * composer. Reads the real character library so the wall never drifts from
 * the shipped content.
 */
import { characters, type Character } from '../../../dialogue/library';

export interface FactionInfo {
  id: string;
  name: string;
  color: string; // hex
  glyph: string; // shape signal — colour alone is never the only cue (DESIGN.md)
}

/** Faction colours per .ralph/DESIGN.md; `independent` falls back to bone. */
export const FACTIONS: Record<string, FactionInfo> = {
  driftline: { id: 'driftline', name: 'The Driftline', color: '#FFB454', glyph: '✦' },
  guild: { id: 'guild', name: 'Salt Guild', color: '#B07C3A', glyph: '◆' },
  choir: { id: 'choir', name: 'The Choir', color: '#57C4B8', glyph: '◉' },
  reclaimers: { id: 'reclaimers', name: 'The Reclaimers', color: '#B3502E', glyph: '▲' },
  independent: { id: 'independent', name: 'Independent', color: '#E4D7BE', glyph: '▣' },
};

export const factionOf = (c: Character): FactionInfo =>
  FACTIONS[c.faction] ?? FACTIONS.independent;

/** The canonical shared style block from .ralph/DESIGN.md — keep in sync. */
export const STYLE_BLOCK =
  'Stylised low-poly 3D illustration, warm flat shading, frontier-western solarpunk; ' +
  'sun-bleached salt-white desert, ochre dunes, teal glass formations, rust-red machinery; ' +
  'long shadows, dusty air; no text, no watermark, no logo.';

/**
 * Compose the exact prompt used to (re-)paint a portrait: shared style block,
 * the character's canonical appearance paragraph, and the portrait finish
 * notes from DESIGN.md ("Portraits (canonical)").
 */
export function portraitPrompt(c: Character): string {
  const f = factionOf(c);
  return [
    STYLE_BLOCK,
    `Painted head-and-shoulders character portrait of ${c.name}, ${c.role}, aligned with ${f.name}. ` +
      `${c.appearance} Square crop, warm flat shading, long-shadow desert backdrop, painted finish. ` +
      'Photoreal is wrong for this: keep it illustrated.',
  ].join('\n');
}

/** Three paint states the wall tracks live. */
export type PaintState = 'painted' | 'stale' | 'unsat';

export const PAINT_LABEL: Record<PaintState, string> = {
  painted: 'PAINTED',
  stale: 'FRAME STALE', // JSON declares a portrait but the file 404s
  unsat: 'AWAITING SITTING', // no portrait declared at all
};

export interface WallEntry {
  character: Character;
  faction: FactionInfo;
  /** portrait path as declared in the JSON (withBase()-able), or undefined */
  declaredArt?: string;
}

const all = [...characters.values()].sort((a, b) => a.name.localeCompare(b.name));

export const WALL: WallEntry[] = all.map((c) => ({
  character: c,
  faction: factionOf(c),
  declaredArt: c.portrait,
}));

export const FACTION_ORDER = ['driftline', 'guild', 'choir', 'reclaimers', 'independent'];

export const factionCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const e of WALL) counts[e.faction.id] = (counts[e.faction.id] ?? 0) + 1;
  return counts;
};

/** First line of a bucket, for the lightbox samples. */
export function sampleLine(c: Character, bucket: string): string | null {
  const arr = c.lines[bucket];
  return arr && arr.length ? arr[0] : null;
}

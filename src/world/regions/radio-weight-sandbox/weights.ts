/**
 * Radio Weight Sandbox — the model.
 *
 * SHIPPED mirror: this re-implements `pickRadioVoice` from src/ui/HUD.tsx
 * (iteration 11) exactly, against the same live data sources:
 *   w = 1                      every voice with radio lines gets airtime
 *     + 6                      voice.home === the rider's local band region
 *     + 1                      faction === 'driftline' (lifers keep the channel)
 *     + min(8, max(0, rep×0.12))  guild/choir/reclaimers only
 * and picks by a cumulative-walk dice roll. If the game tunes these constants,
 * this table must be tuned with it (workshed rule: SHIPPED mirrors the game).
 */

import { characters } from '../../../dialogue/library';
import { REGIONS, isBenchRegion } from '../../registry';

/* ---------- shipped constants ---------- */

export const W_BASE = 1;
export const W_HOME = 6;
export const W_LIFER = 1;
export const REP_RATE = 0.12;
export const REP_CAP = 8;
/** Picks the HUD allows on its 14 s tick — kept here purely as bench context. */
export const HUD_TICK_S = 14;

export const REP_FACTIONS = ['guild', 'choir', 'reclaimers'] as const;
export type RepFaction = (typeof REP_FACTIONS)[number];
export interface RepInput {
  guild: number;
  choir: number;
  reclaimers: number;
}

export interface BandVoice {
  id: string;
  name: string;
  faction: string;
  home: string;
  lines: number;
}

let castCache: BandVoice[] | null = null;

/** Everyone with radio lines — same filter (and same ketch fallback) as HUD. */
export function radioCast(): BandVoice[] {
  if (castCache) return castCache;
  const out: BandVoice[] = [];
  for (const c of characters.values()) {
    if (c.lines.radio?.length) {
      out.push({
        id: c.id,
        name: c.name,
        faction: c.faction,
        home: c.home,
        lines: c.lines.radio.length,
      });
    }
  }
  if (!out.length) out.push({ id: 'ketch', name: 'Ketch', faction: 'driftline', home: 'saltmouth', lines: 1 });
  castCache = out.sort((a, b) => a.name.localeCompare(b.name));
  return castCache;
}

/* ---------- bands (one teleport plinth per on-world region) ---------- */

export interface Band {
  slug: string | null; // null = open playa ("LONG STATIC")
  name: string;
  radius: number; // metres; 0 for long static
  locals: number; // cast voices whose home is this band
}

let bandCache: Band[] | null = null;

export function bandList(): Band[] {
  if (bandCache) return bandCache;
  const cast = radioCast();
  const out: Band[] = [{ slug: null, name: 'Long Static · open playa', radius: 0, locals: 0 }];
  const regions: Band[] = [];
  for (const mod of REGIONS.values()) {
    const m = mod.meta;
    if (isBenchRegion(m)) continue;
    regions.push({
      slug: m.slug,
      name: m.name,
      radius: m.radius,
      locals: cast.filter((v) => v.home === m.slug).length,
    });
  }
  regions.sort((a, b) => a.name.localeCompare(b.name));
  bandCache = [...out, ...regions];
  return bandCache;
}

/* ---------- weights (the shipped math) ---------- */

export interface WeightRow extends BandVoice {
  base: number;      // always W_BASE
  local: number;     // W_HOME when home === band
  lifer: number;     // W_LIFER for driftline
  repBonus: number;  // min(REP_CAP, rep × REP_RATE) for the three rep factions
  w: number;         // sum
  share: number;     // w / total
}

export function repBonus(faction: string, rep: RepInput): number {
  if (faction === 'guild' || faction === 'choir' || faction === 'reclaimers') {
    return Math.min(REP_CAP, Math.max(0, (rep[faction] ?? 0) * REP_RATE));
  }
  return 0;
}

export function weightOf(v: BandVoice, band: string | null, rep: RepInput): number {
  return (
    W_BASE +
    (band && v.home === band ? W_HOME : 0) +
    (v.faction === 'driftline' ? W_LIFER : 0) +
    repBonus(v.faction, rep)
  );
}

export function computeWeights(
  band: string | null,
  rep: RepInput,
): { rows: WeightRow[]; total: number } {
  let total = 0;
  const rows: WeightRow[] = radioCast().map((v) => {
    const local = band && v.home === band ? W_HOME : 0;
    const lifer = v.faction === 'driftline' ? W_LIFER : 0;
    const bonus = repBonus(v.faction, rep);
    const w = W_BASE + local + lifer + bonus;
    total += w;
    return { ...v, base: W_BASE, local, lifer, repBonus: bonus, w, share: 0 };
  });
  for (const r of rows) r.share = total > 0 ? r.w / total : 0;
  rows.sort((a, b) => b.w - a.w || a.name.localeCompare(b.name));
  return { rows, total };
}

/* ---------- sampling (same cumulative walk as the shipped pick) ---------- */

export function rollPicks(rows: WeightRow[], total: number, n: number): Map<string, number> {
  const counts = new Map<string, number>();
  if (total <= 0) return counts;
  for (let k = 0; k < n; k++) {
    let roll = Math.random() * total;
    let picked = rows[rows.length - 1];
    for (const r of rows) {
      roll -= r.w;
      if (roll <= 0) {
        picked = r;
        break;
      }
    }
    counts.set(picked.id, (counts.get(picked.id) ?? 0) + 1);
  }
  return counts;
}

/** 3σ noise band for a binomial share — pass/fail ruler for the histogram. */
export function noiseBandPts(share: number, rolls: number): number {
  if (rolls <= 0) return 0;
  return 3 * Math.sqrt((share * (1 - share)) / rolls);
}

/* ---------- faction/language ---------- */

export const FACTION_META: Record<string, { glyph: string; color: string; label: string }> = {
  guild: { glyph: '◈', color: '#B07C3A', label: 'Salt Guild' },
  choir: { glyph: '◉', color: '#57C4B8', label: 'Choir' },
  reclaimers: { glyph: '▲', color: '#B3502E', label: 'Reclaimers' },
  driftline: { glyph: '◆', color: '#FFB454', label: 'Driftline' },
  independent: { glyph: '○', color: '#E4D7BE', label: 'Independent' },
};

export const factionMeta = (faction: string) =>
  FACTION_META[faction] ?? { glyph: '◇', color: '#E4D7BE', label: faction };

/** Mast-scene pulse channel: rolls and re-tunes set this; Scene decays it. */
export const benchPulse = { v: 0 };
export function kickPulse(amount = 1) {
  benchPulse.v = Math.min(1.6, benchPulse.v + amount);
}

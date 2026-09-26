/**
 * Signal caches — derelict data obelisks out in the world. Riding within
 * CAPTURE_RADIUS recovers the cache's codex entry (lore slug) and pays a
 * small Guild archival bounty. Positions resolve from content/caches.json
 * against region anchors at module load; several caches on one anchor are
 * fanned out on a golden-angle spiral so nobody hides inside anyone else.
 *
 * Collected state is derived from the save (`codex` list) — no new save
 * fields, nothing to migrate.
 */
import cachesJson from '../content/caches.json';
import { getAnchor } from '../world/registry';

export const CAPTURE_RADIUS = 13;
export const BOUNTY_CREDITS = 15;
/** HUD hint + minimap draw range. */
export const HINT_RANGE = 340;

export interface SignalCache {
  id: string;
  /** lore slug this cache recovers */
  lore: string;
  anchor: string;
  x: number;
  z: number;
}

const raw = (cachesJson as { caches: { id: string; lore: string; anchor: string }[] }).caches;

function resolve(): SignalCache[] {
  const byAnchor = new Map<string, number>();
  const out: SignalCache[] = [];
  for (const c of raw) {
    const a = getAnchor(c.anchor);
    if (!a) continue; // validator catches this; runtime skips quietly
    const k = byAnchor.get(c.anchor) ?? 0;
    byAnchor.set(c.anchor, k + 1);
    // first cache sits on the anchor; extras fan out on a golden-angle spiral
    const ang = k * 2.399963;
    const r = k === 0 ? 0 : 5 + k * 2.2;
    out.push({ id: c.id, lore: c.lore, anchor: c.anchor, x: a.x + Math.cos(ang) * r, z: a.z + Math.sin(ang) * r });
  }
  return out;
}

export const SIGNAL_CACHES: SignalCache[] = resolve();

/** Uncollected caches, given the save's codex list. */
export function uncollectedCaches(codex: string[]): SignalCache[] {
  return SIGNAL_CACHES.filter((c) => !codex.includes(c.lore));
}

/**
 * Cache Density & Fan-Out Planner — survey model.
 *
 * Replays the placement maths of src/game/caches.ts exactly (golden-angle
 * fan-out: `ang = k * 2.399963`, `r = 5 + k * 2.2`, first cache on-anchor)
 * against the live registry anchors, then derives everything the sheet draws:
 * per-anchor crowding grades (DESIGN.md thresholds: amber past 6, red past 10),
 * cross-anchor capture-disc overlaps, ghost slots for the next fan positions,
 * per-region stats and a marching-squares contour survey of the real shared
 * heightfield. A parity check re-runs the resolver over the raw content rows
 * and diffs against the shipped SIGNAL_CACHES — if this tool and the game ever
 * disagree, the badge on the header goes red.
 */
import cachesJson from '../../../content/caches.json';
import { CAPTURE_RADIUS, SIGNAL_CACHES } from '../../../game/caches';
import { getAnchor, REGIONS, isBenchRegion, type Anchor, type RegionMeta } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import { loreEntries } from '../../../codex/library';

export { CAPTURE_RADIUS } from '../../../game/caches';

/* ---------------- fan-out constants (mirror caches.ts — see parity check) ---------------- */

export const GOLDEN_ANGLE = 2.399963;
export const FAN_BASE = 5;
export const FAN_STEP = 2.2;
/** DESIGN.md crowding guidance: 6 per anchor with clean spacing, 10 max. */
export const CROWD_AMBER = 7; // 7..10 → amber ▲
export const CROWD_RED = 11; // 11+ → red ■
export const OVERLAP_DIST = CAPTURE_RADIUS * 2; // discs touch past this

export interface CacheRow {
  id: string;
  lore: string;
  anchor: string;
}

export interface PlottedCache extends CacheRow {
  k: number; // fan slot index on its anchor
  x: number;
  z: number;
  region: string;
  anchorId: string;
  anchorLabel: string;
  simulated: boolean;
}

export interface AnchorStats {
  key: string; // "slug:anchorId"
  region: string;
  anchorId: string;
  label: string;
  x: number;
  z: number;
  count: number;
  outerR: number; // radius of the outermost occupied fan slot
  minPairDist: number; // nearest sibling cache on the same anchor (m), Infinity if <2
  crossNearest: number; // nearest cache owned by any other anchor (m), Infinity if none
  level: 'ok' | 'amber' | 'red';
  spreadTo: { key: string; label: string; count: number; dist: number }[];
}

export interface OverlapPair {
  a: PlottedCache;
  b: PlottedCache;
  dist: number;
}

export interface RegionStyle {
  color: string;
  glyph: string;
  note: string;
}

export const REGION_STYLE: Record<string, RegionStyle> = {
  saltmouth: { color: '#B07C3A', glyph: '◈', note: 'Salt Guild ledger' },
  skydocks: { color: '#FFB454', glyph: '▲', note: 'Driftline banner' },
  choirhollow: { color: '#57C4B8', glyph: '◉', note: 'Choir teal' },
  mothersgate: { color: '#7E3320', glyph: '▣', note: 'Deep rust — MOTHER\'s threshold' },
  windspine: { color: '#B3502E', glyph: '✦', note: 'Reclaimer rust' },
  glassroad: { color: '#2E8C8C', glyph: '◆', note: 'Fused glass' },
  'canyon-slalom': { color: '#C98F4E', glyph: '◇', note: 'Canyon sand' },
  cinderflats: { color: '#E4572E', glyph: '▲', note: 'Burn scar' },
  'drowned-array': { color: '#57C4B8', glyph: '◉', note: 'Drowned glass' },
};

export function regionStyle(slug: string): RegionStyle {
  return REGION_STYLE[slug] ?? { color: '#8A5335', glyph: '◈', note: 'unsurveyed' };
}

/* ---------------- base content ---------------- */

export const BASE_ROWS: CacheRow[] = (cachesJson as { caches: CacheRow[] }).caches;

/** True if a parsed row's anchor is usable content: resolves and is on-world. */
export function anchorIsOnWorld(ref: string): boolean {
  const slug = ref.split(':')[0];
  const meta = REGIONS.get(slug)?.meta;
  return !!meta && !isBenchRegion(meta);
}

/** Re-resolve rows through the same fan-out caches.ts uses. */
export function resolveCaches(rows: CacheRow[], simulatedFrom = 0): PlottedCache[] {
  const byAnchor = new Map<string, number>();
  const out: PlottedCache[] = [];
  rows.forEach((c, i) => {
    const a = getAnchor(c.anchor);
    if (!a) return;
    const k = byAnchor.get(c.anchor) ?? 0;
    byAnchor.set(c.anchor, k + 1);
    const ang = k * GOLDEN_ANGLE;
    const r = k === 0 ? 0 : FAN_BASE + k * FAN_STEP;
    out.push({
      ...c,
      k,
      x: a.x + Math.cos(ang) * r,
      z: a.z + Math.sin(ang) * r,
      region: a.region,
      anchorId: c.anchor.split(':')[1] ?? '',
      anchorLabel: a.label,
      simulated: i >= simulatedFrom,
    });
  });
  return out;
}

/** Where fan slot `k` of an anchor lands (used for ghost slots). */
export function fanSlot(k: number): { dx: number; dz: number; r: number } {
  const ang = k * GOLDEN_ANGLE;
  const r = k === 0 ? 0 : FAN_BASE + k * FAN_STEP;
  return { dx: Math.cos(ang) * r, dz: Math.sin(ang) * r, r };
}

/* ---------------- parity with the shipped resolver ---------------- */

export interface ParityResult {
  ok: boolean;
  maxDrift: number;
  skipped: number;
}

export function resolverParity(): ParityResult {
  const ours = resolveCaches(BASE_ROWS);
  const shipped = new Map(SIGNAL_CACHES.map((c) => [c.id, c]));
  let maxDrift = 0;
  let skipped = 0;
  for (const o of ours) {
    const s = shipped.get(o.id);
    if (!s) {
      skipped++;
      continue;
    }
    maxDrift = Math.max(maxDrift, Math.hypot(o.x - s.x, o.z - s.z));
  }
  return { ok: maxDrift < 1e-6 && skipped === 0 && ours.length === SIGNAL_CACHES.length, maxDrift, skipped };
}

/* ---------------- model ---------------- */

export interface RegionSurvey {
  slug: string;
  meta: RegionMeta;
  anchors: Record<string, Anchor>;
  cacheCount: number;
  anchorsUsed: number;
  worstLevel: 'ok' | 'amber' | 'red';
}

export interface SurveyModel {
  caches: PlottedCache[];
  anchorStats: Map<string, AnchorStats>;
  crowded: AnchorStats[]; // amber + red, worst first
  overlaps: OverlapPair[];
  regions: RegionSurvey[];
  loreBySlug: Map<string, { slug: string; title: string; summary: string; category: string; body: string; words: number }>;
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}

let loreCache: SurveyModel['loreBySlug'] | null = null;
export function loreIndex(): SurveyModel['loreBySlug'] {
  if (!loreCache) {
    loreCache = new Map(
      loreEntries.map((e) => [
        e.slug,
        { slug: e.slug, title: e.title, summary: e.summary, category: e.category, body: e.body, words: e.words },
      ]),
    );
  }
  return loreCache;
}

/** On-world regions that missions/caches may target (benches excluded). */
export function surveyedRegions(): { slug: string; meta: RegionMeta; anchors: Record<string, Anchor> }[] {
  return [...REGIONS.values()]
    .filter((r) => !isBenchRegion(r.meta))
    .map((r) => ({ slug: r.meta.slug, meta: r.meta, anchors: r.anchors }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function buildModel(simRows: CacheRow[]): SurveyModel {
  const rows = [...BASE_ROWS, ...simRows];
  const caches = resolveCaches(rows, BASE_ROWS.length);
  const regions = surveyedRegions();

  // per-anchor counts (0 for quiet anchors) — anchors know their own region sheet
  const groups = new Map<string, PlottedCache[]>();
  for (const c of caches) {
    const g = groups.get(c.anchor) ?? [];
    g.push(c);
    groups.set(c.anchor, g);
  }

  const anchorStats = new Map<string, AnchorStats>();
  for (const region of regions) {
    for (const [anchorId, a] of Object.entries(region.anchors)) {
      const key = `${region.slug}:${anchorId}`;
      const own = groups.get(key) ?? [];
      const count = own.length;
      let minPairDist = Infinity;
      for (let i = 0; i < own.length; i++) {
        for (let j = i + 1; j < own.length; j++) {
          minPairDist = Math.min(minPairDist, Math.hypot(own[i].x - own[j].x, own[i].z - own[j].z));
        }
      }
      anchorStats.set(key, {
        key,
        region: region.slug,
        anchorId,
        label: a.label,
        x: a.pos[0],
        z: a.pos[1],
        count,
        outerR: count === 0 ? 0 : fanSlot(count - 1).r,
        minPairDist,
        crossNearest: Infinity,
        level: count >= CROWD_RED ? 'red' : count >= CROWD_AMBER ? 'amber' : 'ok',
        spreadTo: [],
      });
    }
  }

  // cross-anchor proximity (only anchors that hold caches matter)
  const holders = [...anchorStats.values()].filter((a) => a.count > 0);
  for (let i = 0; i < holders.length; i++) {
    for (let j = i + 1; j < holders.length; j++) {
      const d = Math.hypot(holders[i].x - holders[j].x, holders[i].z - holders[j].z);
      if (d < holders[i].crossNearest) holders[i].crossNearest = d;
      if (d < holders[j].crossNearest) holders[j].crossNearest = d;
    }
  }

  // spread suggestions: quietest same-region anchors, nearest first
  for (const a of anchorStats.values()) {
    if (a.level === 'ok') continue;
    a.spreadTo = [...anchorStats.values()]
      .filter((b) => b.key !== a.key && b.region === a.region && b.count < a.count)
      .sort((b1, b2) => b1.count - b2.count || Math.hypot(b1.x - a.x, b1.z - a.z) - Math.hypot(b2.x - a.x, b2.z - a.z))
      .slice(0, 2)
      .map((b) => ({ key: b.key, label: b.label, count: b.count, dist: Math.hypot(b.x - a.x, b.z - a.z) }));
  }

  // cross-anchor capture-disc overlaps (same-disc conflicts on one anchor are graded separately)
  const overlaps: OverlapPair[] = [];
  for (let i = 0; i < caches.length; i++) {
    for (let j = i + 1; j < caches.length; j++) {
      const a = caches[i];
      const b = caches[j];
      if (a.anchor === b.anchor) continue;
      if (Math.abs(a.x - b.x) > OVERLAP_DIST || Math.abs(a.z - b.z) > OVERLAP_DIST) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < OVERLAP_DIST) overlaps.push({ a, b, dist: d });
    }
  }
  overlaps.sort((p1, p2) => p1.dist - p2.dist);

  const crowded = [...anchorStats.values()]
    .filter((a) => a.level !== 'ok')
    .sort((a, b) => b.count - a.count);

  const byAnchorCount = new Map<string, number>();
  for (const c of caches) byAnchorCount.set(c.region, (byAnchorCount.get(c.region) ?? 0) + 1);

  const regionSurveys: RegionSurvey[] = regions.map((r) => {
    const used = Object.keys(r.anchors).filter((id) => (anchorStats.get(`${r.slug}:${id}`)?.count ?? 0) > 0);
    const worst = used.reduce<'ok' | 'amber' | 'red'>((w, id) => {
      const lv = anchorStats.get(`${r.slug}:${id}`)!.level;
      return lv === 'red' || w === 'red' ? 'red' : lv === 'amber' || w === 'amber' ? 'amber' : 'ok';
    }, 'ok');
    return {
      slug: r.slug,
      meta: r.meta,
      anchors: r.anchors,
      cacheCount: byAnchorCount.get(r.slug) ?? 0,
      anchorsUsed: used.length,
      worstLevel: worst,
    };
  });

  // survey bounds: region discs + skirt
  const MARGIN = 110;
  const bounds = regionSurveys.reduce(
    (b, r) => ({
      minX: Math.min(b.minX, r.meta.center[0] - r.meta.radius),
      minZ: Math.min(b.minZ, r.meta.center[1] - r.meta.radius),
      maxX: Math.max(b.maxX, r.meta.center[0] + r.meta.radius),
      maxZ: Math.max(b.maxZ, r.meta.center[1] + r.meta.radius),
    }),
    { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity },
  );
  bounds.minX -= MARGIN;
  bounds.minZ -= MARGIN;
  bounds.maxX += MARGIN;
  bounds.maxZ += MARGIN;

  return { caches, anchorStats, crowded, overlaps, regions: regionSurveys, loreBySlug: loreIndex(), bounds };
}

/* ---------------- paste simulation ---------------- */

export interface SimParse {
  rows: CacheRow[];
  issues: string[];
  dedupWarnings: string[];
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Parse pasted JSON: a single row object, an array of rows, or a wrapped
 * `{ caches: [...] }`. Validates against the same contract the content
 * validator enforces — unique kebab id, existing lore slug, on-world anchor.
 */
export function parseSimRows(text: string, existing: CacheRow[]): SimParse {
  const issues: string[] = [];
  const dedupWarnings: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], issues: ['Paste a row first — an object, an array, or a wrapped { "caches": [ … ] }.'], dedupWarnings };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { rows: [], issues: [`JSON rejects it: ${err instanceof Error ? err.message : String(err)}`], dedupWarnings };
  }
  const rawRows: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { caches?: unknown[] }).caches)
      ? (parsed as { caches: unknown[] }).caches
      : [parsed];

  const existingIds = new Set(existing.map((r) => r.id));
  const loreSlugs = new Set(loreEntries.map((e) => e.slug));
  const loreTaken = new Map(existing.map((r) => [r.lore, r.id]));
  const seenIds = new Set<string>();
  const rows: CacheRow[] = [];

  rawRows.forEach((raw, i) => {
    const at = `row ${i + 1}`;
    if (!raw || typeof raw !== 'object') {
      issues.push(`${at}: not an object.`);
      return;
    }
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    const lore = typeof r.lore === 'string' ? r.lore : '';
    const anchor = typeof r.anchor === 'string' ? r.anchor : '';
    let bad = false;
    if (!id || !ID_RE.test(id)) {
      issues.push(`${at}: id "${id || '∅'}" must be kebab-case (cache-my-entry).`);
      bad = true;
    } else if (existingIds.has(id) || seenIds.has(id)) {
      issues.push(`${at}: id "${id}" already exists.`);
      bad = true;
    }
    if (!lore || !loreSlugs.has(lore)) {
      issues.push(`${at}: lore slug "${lore || '∅'}" matches no codex entry.`);
      bad = true;
    } else if (loreTaken.has(lore)) {
      dedupWarnings.push(`${at}: "${lore}" already recovers at ${loreTaken.get(lore)} — two caches, one entry.`);
    }
    if (!anchor || !getAnchor(anchor)) {
      issues.push(`${at}: anchor "${anchor || '∅'}" does not resolve (region:anchor-id).`);
      bad = true;
    } else if (!anchorIsOnWorld(anchor)) {
      issues.push(`${at}: anchor "${anchor}" is off-world (a lab bench) — caches must sit on real regions.`);
      bad = true;
    }
    if (!bad) {
      seenIds.add(id);
      rows.push({ id, lore, anchor });
    }
  });

  return { rows, issues, dedupWarnings };
}

/* ---------------- terrain contours (marching squares) ---------------- */

export interface ContourSet {
  level: number;
  index: boolean; // heavier "index contour" every 3rd
  d: string;
}

/**
 * Contour survey of the real shared heightfield across `bounds`. Sampled on a
 * coarse grid, traced with marching squares (linear edge interpolation,
 * saddle resolved by cell-centre average). Runs once per bounds change.
 */
export function contourSurvey(
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number },
  cols = 104,
  rows = 104,
  levelCount = 7,
): ContourSet[] {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxZ - bounds.minZ;
  const field = new Float32Array((cols + 1) * (rows + 1));
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j <= rows; j++) {
    const z = bounds.minZ + (j / rows) * h;
    for (let i = 0; i <= cols; i++) {
      const x = bounds.minX + (i / cols) * w;
      const v = terrainHeight(x, z);
      field[j * (cols + 1) + i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const out: ContourSet[] = [];
  const at = (i: number, j: number) => field[j * (cols + 1) + i];
  for (let li = 0; li < levelCount; li++) {
    const level = lo + ((li + 1) / (levelCount + 1)) * (hi - lo);
    let d = '';
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v00 = at(i, j);
        const v10 = at(i + 1, j);
        const v11 = at(i + 1, j + 1);
        const v01 = at(i, j + 1);
        const code = (v00 > level ? 8 : 0) | (v10 > level ? 4 : 0) | (v11 > level ? 2 : 0) | (v01 > level ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x0 = bounds.minX + (i / cols) * w;
        const z0 = bounds.minZ + (j / rows) * h;
        const dx = w / cols;
        const dz = h / rows;
        // edge crossings: t = top, r = right, b = bottom, l = left
        const ix = (va: number, vb: number) => x0 + dx * ((level - va) / (vb - va || 1e-9));
        const iz = (va: number, vb: number) => z0 + dz * ((level - va) / (vb - va || 1e-9));
        const T = (): [number, number] => [ix(v00, v10), z0];
        const R = (): [number, number] => [x0 + dx, iz(v10, v11)];
        const B = (): [number, number] => [ix(v01, v11), z0 + dz];
        const L = (): [number, number] => [x0, iz(v00, v01)];
        const seg = (p: [number, number], q: [number, number]) => {
          d += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
        };
        switch (code) {
          case 1: case 14: seg(L(), B()); break;
          case 2: case 13: seg(B(), R()); break;
          case 3: case 12: seg(L(), R()); break;
          case 4: case 11: seg(T(), R()); break;
          case 6: case 9: seg(T(), B()); break;
          case 7: case 8: seg(T(), L()); break;
          case 5: {
            const centre = (v00 + v10 + v11 + v01) / 4;
            if (centre > level) { seg(T(), L()); seg(B(), R()); }
            else { seg(T(), R()); seg(L(), B()); }
            break;
          }
          case 10: {
            const centre = (v00 + v10 + v11 + v01) / 4;
            if (centre > level) { seg(T(), R()); seg(L(), B()); }
            else { seg(T(), L()); seg(B(), R()); }
            break;
          }
        }
      }
    }
    if (d) out.push({ level, index: (li + 1) % 3 === 0, d });
  }
  return out;
}

/** Exact bounds of one region's survey (center ± radius + breathing room). */
export function regionBounds(region: RegionSurvey, skirt = 90) {
  const [cx, cz] = region.meta.center;
  const r = region.meta.radius + skirt;
  return { minX: cx - r, minZ: cz - r, maxX: cx + r, maxZ: cz + r };
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtM = (n: number) => (Number.isFinite(n) ? `${fmt(n, n < 20 ? 1 : 0)} m` : '—');

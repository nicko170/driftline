/**
 * Region registry. Every region lives in src/world/regions/<slug>/ with:
 *   meta.json, anchors.json, index.tsx (default export RegionModule)
 * See .ralph/ROUTES.md for the contract.
 *
 * Loading model (iteration 6):
 * - meta.json + anchors.json are EAGER (tiny JSON — anchors drive missions,
 *   caches, climate blending and UI labels at boot).
 * - index.tsx is LAZY (props/colliders/propsCull — potentially heavy demos).
 *   Call loadRegion(slug) and re-render on subscribeRegions(); GameScreen
 *   preloads every on-world region via ensureOnWorldRegions().
 * - Off-world lab benches (centre beyond ±1800 m, or listed in
 *   GAMEPLAY_EXCLUDED) are never loaded by gameplay; the Lab imports them
 *   through its own lazy glob.
 */
import type { ComponentType } from 'react';
import { terrainHeight } from '../lib/terrain';

export interface RegionMeta {
  slug: string;
  name: string;
  blurb: string;
  center: [number, number];
  radius: number;
  danger: number;
  climate?: { fogDensity?: number; skyTint?: string; groundTint?: string };
}

export interface Anchor {
  pos: [number, number];
  label: string;
  elev?: number;
}

export interface RegionCollider {
  pos: [number, number]; // x, z (y resolved from terrain + h/2 unless elev)
  size: [number, number, number];
  elev?: number;
  rotY?: number;
}

export interface RegionModule {
  meta: RegionMeta;
  anchors: Record<string, Anchor>;
  Props?: ComponentType;
  colliders?: RegionCollider[];
  /** Only render props when the player is within radius * propsCull. */
  propsCull?: number;
}

/** Demo-regions parked on-world (standalone sandboxes, no Props contract). */
const GAMEPLAY_EXCLUDED = new Set(['hover-playground']);

/* ---------- eager: meta + anchors ---------- */

const folderOf = (path: string) => path.split('/')[2]; // ./regions/<slug>/<file>

const metaMods = import.meta.glob<{ default: RegionMeta }>('./regions/*/meta.json', { eager: true });
const anchorMods = import.meta.glob<{ default: Record<string, Anchor> }>('./regions/*/anchors.json', {
  eager: true,
});
const moduleLoaders = import.meta.glob<{ default: RegionModule | (ComponentType & Partial<RegionModule>) }>(
  './regions/*/index.tsx',
);

const anchorsByFolder = new Map<string, Record<string, Anchor>>();
for (const [path, mod] of Object.entries(anchorMods)) anchorsByFolder.set(folderOf(path), mod.default);

const folderBySlug = new Map<string, string>();
export const REGIONS = new Map<string, RegionModule>();
for (const [path, mod] of Object.entries(metaMods)) {
  const meta = mod.default;
  if (!meta?.slug) {
    console.warn(`[regions] ${path} has no meta.slug`);
    continue;
  }
  folderBySlug.set(meta.slug, folderOf(path));
  REGIONS.set(meta.slug, { meta, anchors: anchorsByFolder.get(folderOf(path)) ?? {} });
}

const loaderByFolder = new Map<string, () => Promise<unknown>>();
for (const [path, loader] of Object.entries(moduleLoaders)) loaderByFolder.set(folderOf(path), loader);

/* ---------- bench detection ---------- */

/** Off-world lab benches never participate in gameplay streaming. */
export function isBenchRegion(meta: RegionMeta): boolean {
  return GAMEPLAY_EXCLUDED.has(meta.slug) || Math.max(Math.abs(meta.center[0]), Math.abs(meta.center[1])) > 1800;
}

/* ---------- lazy module loading ---------- */

let regionVersion = 0;
const listeners = new Set<() => void>();
export function subscribeRegions(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getRegionVersion(): number {
  return regionVersion;
}
function bump() {
  regionVersion++;
  for (const cb of Array.from(listeners)) cb();
}

const loadPromises = new Map<string, Promise<RegionModule | null>>();
const resolved = new Set<string>();

/** Lazily import a region's index.tsx and merge Props/colliders/propsCull into REGIONS. */
export function loadRegion(slug: string): Promise<RegionModule | null> {
  const existing = loadPromises.get(slug);
  if (existing) return existing;
  const entry = REGIONS.get(slug);
  const loader = loaderByFolder.get(folderBySlug.get(slug) ?? '');
  if (!entry || !loader) return Promise.resolve(null);
  const p = loader()
    .then((raw) => {
      const mod = raw as { default: RegionModule | (ComponentType & Partial<RegionModule>) };
      const m = mod.default;
      if (m?.Props) entry.Props = m.Props;
      if (m?.colliders?.length) entry.colliders = m.colliders;
      if (typeof (m as RegionModule | null)?.propsCull === 'number') entry.propsCull = (m as RegionModule).propsCull;
      resolved.add(slug);
      bump();
      return entry;
    })
    .catch((err) => {
      console.warn(`[regions] failed to load ${slug}`, err);
      resolved.add(slug);
      bump();
      return null;
    });
  loadPromises.set(slug, p);
  return p;
}

/** True once every on-world region module has resolved (Props and colliders settled). */
export function onWorldRegionsLoaded(): boolean {
  for (const region of REGIONS.values()) {
    if (isBenchRegion(region.meta)) continue;
    if (!resolved.has(region.meta.slug)) return false;
  }
  return true;
}

/** Kick loads for all on-world regions (GameScreen mount). */
export function ensureOnWorldRegions(): void {
  for (const region of REGIONS.values()) {
    if (isBenchRegion(region.meta)) continue;
    void loadRegion(region.meta.slug);
  }
}

/* ---------- anchors & colliders ---------- */

export interface ResolvedAnchor {
  key: string;      // "slug:anchorId"
  region: string;
  label: string;
  x: number;
  y: number;        // terrain height (+ elev override)
  z: number;
}

export function getAnchor(ref: string): ResolvedAnchor | null {
  const [slug, aid] = ref.split(':');
  const region = REGIONS.get(slug);
  const anchor = region?.anchors[aid];
  if (!region || !anchor) return null;
  const [x, z] = anchor.pos;
  const y = anchor.elev ?? terrainHeight(x, z);
  return { key: ref, region: slug, label: anchor.label, x, y, z };
}

export interface RegionColliderResolved extends RegionCollider {
  region: string;
  y: number;
}

/** Colliders of loaded regions (on-world regions are preloaded by GameScreen). */
export function allColliders(): RegionColliderResolved[] {
  const out: RegionColliderResolved[] = [];
  for (const region of REGIONS.values()) {
    for (const c of region.colliders ?? []) {
      const groundY = terrainHeight(c.pos[0], c.pos[1]);
      const base = c.elev ?? groundY;
      // buried 3m so slopes never expose a gap beneath props
      out.push({ ...c, region: region.meta.slug, y: base + c.size[1] / 2 - 3 });
    }
  }
  return out;
}

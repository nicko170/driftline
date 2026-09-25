/**
 * Region registry. Every region lives in src/world/regions/<slug>/ with:
 *   meta.json, anchors.json, index.tsx (default export RegionModule)
 * See .ralph/ROUTES.md for the contract.
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

/* eager — region props are cheap primitives; distance-gating happens at render */
const modules = import.meta.glob<{ default: RegionModule }>('./regions/*/index.tsx', { eager: true });

export const REGIONS = new Map<string, RegionModule>();
for (const [path, mod] of Object.entries(modules)) {
  const m = mod.default;
  if (m?.meta?.slug) REGIONS.set(m.meta.slug, m);
  else console.warn(`[regions] ${path} has no valid default export`);
}

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

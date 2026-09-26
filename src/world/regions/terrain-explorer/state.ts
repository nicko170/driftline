/**
 * Terrain Explorer state — one zustand store shared by the panel (DOM) and
 * the scene (R3F). Numbers only; the scene owns three objects in refs.
 */
import { create } from 'zustand';
import { ALL_ON } from './heightfield';
import type { LayerState } from './heightfield';

export type ColourMode = 'height' | 'game' | 'surface';

export interface ExplorerStats {
  verts: number;
  tris: number;
  minH: number;
  maxH: number;
  mapMs: number; // time to rebuild the cached field maps (noise)
  applyMs: number; // time to recombine + recolour
  drift: number; // max |replica − live terrain| across grid samples, metres
}

export interface ExplorerState {
  layers: LayerState;
  mode: ColourMode;
  contours: boolean;
  showRegions: boolean;
  showLabels: boolean;
  showRoutes: boolean;
  showGrid: boolean;
  fly: boolean;
  exag: number; // vertical exaggeration (visual scale.y)
  res: number; // grid segments per side
  seed: number;
  flySpeed: number;

  mapsVersion: number; // bump when cached FieldMaps are replaced
  appliedVersion: number; // bump when geometry heights/colours are final
  building: number; // 0..1 while noise maps rebuild, -1 idle

  stats: ExplorerStats | null;

  toggleLayer: (key: keyof LayerState) => void;
  setMode: (m: ColourMode) => void;
  toggle: (key: 'contours' | 'showRegions' | 'showLabels' | 'showRoutes' | 'showGrid' | 'fly') => void;
  setExag: (v: number) => void;
  setRes: (v: number) => void;
  setSeed: (v: number) => void;
  setFlySpeed: (v: number) => void;
  bumpMaps: () => void;
  bumpApplied: () => void;
  setBuilding: (v: number) => void;
  setStats: (s: ExplorerStats) => void;
  allOn: () => void;
  reset: () => void;
}

export const DEFAULTS = {
  layers: { ...ALL_ON },
  mode: 'height' as ColourMode,
  contours: true,
  showRegions: true,
  showLabels: true,
  showRoutes: true,
  showGrid: true,
  fly: false,
  exag: 1.5,
  res: 224,
  seed: 0,
  flySpeed: 160,
};

export const useExplorer = create<ExplorerState>((set) => ({
  ...DEFAULTS,
  mapsVersion: 0,
  appliedVersion: 0,
  building: -1,
  stats: null,

  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setMode: (mode) => set({ mode }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<ExplorerState>),
  setExag: (exag) => set({ exag }),
  setRes: (res) => set({ res }),
  setSeed: (seed) => set({ seed }),
  setFlySpeed: (flySpeed) => set({ flySpeed }),
  bumpMaps: () => set((s) => ({ mapsVersion: s.mapsVersion + 1 })),
  bumpApplied: () => set((s) => ({ appliedVersion: s.appliedVersion + 1 })),
  setBuilding: (building) => set({ building }),
  setStats: (stats) => set({ stats }),
  allOn: () => set({ layers: { ...ALL_ON }, seed: 0 }),
  reset: () => set({ ...DEFAULTS, layers: { ...ALL_ON } }),
}));

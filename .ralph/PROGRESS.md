# Progress

## Status — iteration 1 (complete vertical slice, playable)

**Live loop:** title → Play → ride (WASD, Shift boost, Space hop, S+steer drift-with-boost-reward,
E interact) → job board → accept mission → waypoints/compass/minimap → complete → credits, rep,
flags, codex unlocks → garage upgrades & paint → pause/settings. Gamepad + touch. Saves persist
(versioned localStorage `driftline-save`). Playtest: 60fps, 0 console errors.

## Architecture (as committed, iteration 1)
- **Terrain is analytic** (`src/lib/terrain.ts`): one height function for mesh, bike hover,
  anchors and scatter — no rapier heightfield collider. Bike = dynamic rigid body, but motion is
  arcade-driven (ride-height controller + lateral grip shaping + manual smoothed rotation);
  rapier handles prop collisions only ("bump, not kill" by construction).
- **World**: 2400×2400 m, 8 regions in `src/world/regions/<slug>/` (meta.json + anchors.json +
  index.tsx with Props + colliders). Distance-gated render via RegionStream; colliders always on.
  Canonical coordinates in `src/world/layout.ts` (canyon/ridge paths + region placements).
- **Content**: missions/characters JSON + lore MD loaded by glob; schemas in ROUTES.md;
  `npm run validate:content` (plain node) checks schema + cross-refs — seed: 3 missions, 3
  characters, 3 lore (4th mission may exist from a parallel writer).
- **State**: zustand `useSaveStore` (persisted) + `useGameStore` (runtime); per-frame data via
  mutable `src/telemetry.ts` (HUD polls at 10Hz). Audio: fully procedural WebAudio singleton.
- **Routes**: `/` title (key art generated ✓), `/play`, `/codex`, `/credits`, `/lab` (auto registry).
- Build: `tsc && vite build && postbuild` (404.html + .nojekyll). BASE_PATH supported.

## Next iterations (priority order)
1. **Mission runtime breadth**: escort/chase/scout/storm objective runtimes; fragile damage
   actually reducing payout (shield soak); mission board shows locked reasons; retry after fail.
2. **More regions' props density** (skydocks/cinderflats still sparse; cinderflats needs the big
   crane; drowned-array needs sunken detail) + region climate tint blending in Sky.
3. **Chapters gating UI** (chapter ribbon on board; story chapter intro cards).
4. **Portraits**: generate illustrated portraits for characters (DialogueBox already supports them).
5. **Post-processing** (bloom/vignette via @react-three/postprocessing) on high preset.
6. **Achievements + stats**; credits sequence; endings flow for ch5.
7. Keep seeding lore backlog: planned must carry ≥120 total; add ~70 more lore ideas next builder pass.

## Known issues / watch-items
- Rapier bundle is 2.2MB min (wasm inlined) — lazy-loaded on /play only; fine for now.
- Bike rotation is fully manual — no physical tumbling ever; acceptable arcade choice (brief allows).
- `slowEnough` gate for pickup/dropoff (16 km/h) can confuse — consider auto-brake assist later.
- Two backlog intents have a stray "…no—" typo (nona-vex, windspine guide); harmless, writers infer.
- Radio chatter cycles ketch/tamsin only until more characters land.
- Terrain draw is CPU-built once (200×200 grid ~40k verts); keep SEGMENTS ≤ 224 on low preset.

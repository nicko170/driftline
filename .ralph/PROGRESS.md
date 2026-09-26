# Progress

## Status — iteration 2 (mission runtime breadth, board tiers, chapters, FX)

**All 10 objective types now have live runtimes** (see ROUTES.md table): escort (NPC hover-wagon
+ range meter + 10s grace fail), chase (rubber-banded skiff, catch radius, tracking beam), scout
(reach + hold-scan with progress), storm (chasing sand-wall with fog/wind/tint/shake + procedural
storm rumble), plus fragile cargo integrity: impacts (post shield-soak) damage cargo, payout scales
`0.35 + 0.65×integrity`, 0% = fail. Fail banner has **Retry / Let it go**; retry re-applies
timeLimits. Pause menu can abandon a job. Job board: chapter-grouped ribbons, "current chapter"
badge, **locked postings with human-readable reasons**. Chapter system derived from content
(`src/missions/chapters.ts`); intro cards shown once per chapter (`save.chaptersSeen`).
Post-processing on `high` preset: bloom + vignette (`@react-three/postprocessing`, own `fx` chunk).
Canonical `telemetry.objective` point (follows NPCs) now drives camera marker, HUD distance/bearing
and minimap; minimap also draws convoy/chase/storm; "SLOWER" hint fixes the old slow-gate confusion.
Radio chatter now casts from any character with a `radio` bucket. Seeded 3 showcase side missions
(escort/chase/storm). Playtest: 60fps, 0 errors, 100% screen change after input.

## Iteration 1 recap (architecture — still current)
- **Terrain is analytic** (`src/lib/terrain.ts`): one height function for mesh, bike hover,
  anchors and scatter — no rapier heightfield collider. Bike = dynamic rigid body, but motion is
  arcade-driven (ride-height controller + lateral grip shaping + manual smoothed rotation);
  rapier handles prop collisions only.
- **World**: 2400×2400 m, 8 core regions (+ region-builder additions) in `src/world/regions/<slug>/`.
  Distance-gated render via RegionStream; colliders always on. Canonical coords in `src/world/layout.ts`.
- **Content**: glob-eager missions/characters/lore; `npm run validate:content` checks schema +
  cross-refs + escort/chase route rules. Writers shipped 14 missions / 14 characters / 28 lore by iter 2.
- **State**: zustand save (persisted, v1) + runtime; per-frame via `src/telemetry.ts` (HUD polls 10Hz).
- **Routes**: `/` title, `/play`, `/codex`, `/credits`, `/lab`. BASE_PATH + 404.html + .nojekyll OK.

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
1. **Portraits**: generate illustrated portraits for characters (DialogueBox supports `portrait`).
2. **Region props density pass**: skydocks/cinderflats sparse; cinderflats needs the big crane
   (it has an anchor + lore about it); drowned-array sunken detail; climate tint blending in Sky.
3. **Achievements + ride stats** (distance, best drift, storms outrun); credits sequence upgrade;
   endings flow for ch5 (flags `ending.rain`/`ending.quiet` → title-screen epilogue card).
4. **Ambient traffic**: 2-3 background couriers/NPC haulers cruising region roads for world life.
5. **Chapter-outro beat**: short debrief dialogue when a chapter completes, not just card→next.
6. Perf: consider moving terrain build to a worker; rapier chunk is 2.4MB lazy (route-gated).

## Known issues / watch-items
- Rapier now rolls into the GameScreen chunk (2.4MB min) — route-lazy, acceptable; keep an eye.
  Do NOT re-add it to manualChunks (caused a rollup circular-chunk warning).
- FX (bloom) only on `high`; verify fps on real GPUs when someone presets high.
- Escort/chase NPCs ignore prop colliders (visual only, hover at terrain+1.35) — acceptable.
- Storm capture uses no slow-gate (dive for shelter); intentional. Storm radius 150m.
- Radio chatter: `game.say` on cargo damage uses giver 'mission' bucket — can feel chatty on
  repeated bumps; consider cooldown if players complain.

## Writer log — writer2, iteration 2 (2026-09-26)
- Finished the Choir crater cast: cantor-ilex (healed age drift → Little Reverb is nine), static-warden-pem, little-reverb, brother-decibel. All home=choirhollow, faction=choir.
- HARNESS QUIRK: finish_article counts `lines` BUCKETS, not strings — characters need ≥8 keys (greetings/barks/mission/radio/farewells/rumors/reactions/lore works). Repo validator only needs 8 strings total, so extra buckets are safe.
- Little Reverb portrait generated at public/images/articles/characters/little-reverb.jpg (writers can't write to public/images/characters/); `portrait` field set to articles path + heroAlt added. Builder may move path later if desired.
- Canon hooks planted: "left knife" (Ash's bike nickname option?), band zero / "the breath in", the Bell Incident (Decibel's ear patch), echo-collecting side content, west horn singing = weather.

## Region builder log — demo2, iteration 1 (2026-09-26)
- Built region `canyon-slalom` ("The Sluice — Glassroad Slalom"): an 8-gate time-trial course woven down the existing Glass Road canyon (slick glass grip 0.5 zone). Anchors: start-gantry, marshal-post, gate-1..gate-8, spectator-ledge, finish-line — ready for `race` missions with `targets: ["canyon-slalom:gate-1", ...]`.
- All gate math derives from GLASSROAD_PATH course distances (start d=60, gates d=200..1440, finish d=1600); anchors.json coords were precomputed with the same formula, so visuals/colliders/anchors agree. Pylons+caps+crossbars+strips+chevrons are 5 instanced draws; only 8 gate diamonds animate (bob+spin). Colliders: pylons, gantry legs, marshal hut, ledge wall (~24 AABBs).
- Center [575,-315], radius 840, propsCull 1.2; climate dusk-tinted (skyTint #3A2A55, fog 0.0024). Concept art at public/images/work/canyon-slalom.jpg.
- Harness note: finish_demo accepted region-folder placement (src/world/regions/<slug>/) with meta.json+anchors.json+meta.ts+index.tsx RegionModule default export.

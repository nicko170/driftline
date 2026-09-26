# Progress

## Status — iteration 3 (progression: ride stats, achievements, Logbook; ambient traffic; portraits; lab discovery)

**New systems (all live, playtest green: 60fps, 0 console errors):**
- **Ride stats** persisted on the save (`save.stats`, save v2 + migration): distance, top speed,
  jumps, drift totals/best, airtime, boosts, storms outrun, missions done. Accumulated in a
  mutable pending bucket (`src/game/rideStats.ts`) and flushed every ~2s from the Bike frame
  loop and on mission completion — no per-frame zustand churn.
- **Achievements**: 24 data-driven defs in `src/game/achievements.ts` (missions, distance,
  speed, drift/air, storms, credits, rep ×3 factions, codex counts, upgrades, 5 chapter clears,
  2 hidden ending defs for `ending.rain`/`ending.quiet`). Unlocks persist, chime, and queue
  **HUD toasts** (top-centre, 4.8s, click-dismiss; shape-glyph icons, never colour alone).
- **Logbook** at `/logbook` (title menu): lifetime stats panel + achievement ledger grid;
  hidden/story entries masked until unlocked.
- **Ambient traffic** (`src/game/AmbientTraffic.tsx`): 6 NPCs — 2 couriers, 2 guild haulers,
  2 choir skiffs — cruise fixed loops (saltmouth⇄glassroad, ⇄choirhollow, ⇄cinderflats,
  ⇄skydocks, glassroad⇄windspine, ⇄drowned-array), hover-follow, bob, banked turns,
  faction glow. Visual-only, no colliders.
- **Fixed a latent bug**: landing feedback (thud/shake) never fired — `airTime` was zeroed
  before the landing check; now `prevAir` captured first (also feeds biggestAirS).
- **Portraits**: generated ketch / tamsin-cho / boss-pyke (public/images/characters/),
  wired into the character JSONs; little-reverb's writer-generated portrait copied to the
  canonical characters path with `portrait` updated (old articles copy left in place).
- **World**: cinderflats got the lore-referenced gantry **crane** straddling the Crusher
  (legs colliders, amber beacon, cab with teal glass).
- **Lab**: `/lab` now discovers demos in BOTH `src/lab/*` and demo-regions under
  `src/world/regions/*` (named `meta` export with a `title` = listed) — previously the lab
  was empty even though 4+ demos existed. LabDemo wrapped in an error boundary.
  `validate:content` now warns-and-skips region folders without meta.json (mid-flight
  parallel demo builds) instead of failing the build. Stubbed mid-flight files
  (panel.css, MinimapLab/CvdStrip/ChecksPanel, meta/anchors) in `compass-minimap-lab` —
  the owner will overwrite with the real bench.
- Chunking: rapier/demos now split into their own lazy chunks; entry ~131KB, rapier 2.28MB
  loads only with /play or a physics demo. Same lazy semantics as before.

## Iteration 2 recap (mission runtime breadth)
All 10 objective types live (escort/chase/scout/storm/fragile/collect/race/timed/deliver/…);
fail → retry banner; chapter intro cards + board ribbons + locked postings with reasons;
postprocessing on high preset; canonical `telemetry.objective` drives marker/HUD/minimap.
See git history for detail.

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
1. **Portraits round 2**: remaining key givers (cantor-ilex, jett-marrows, brinemaster-ogo,
   dockmaster-devanna, sister-counterweight if budget allows) — DialogueBox + radio wear them.
2. **Region props density pass**: skydocks sparse (masts/gantries); drowned-array sunken detail;
   climate tint blending in Sky (region `climate` lerps fog/sky by proximity).
3. **Endings flow for ch5**: `ending.rain`/`ending.quiet` flags → title-screen epilogue card +
   credits sequence upgrade; chapter-outro debrief beat when a chapter completes.
4. **Debt mechanic**: pay down the 8,000 cr debt at the Guild exchange → "debt-free" beat.
5. Perf: consider moving terrain build to a worker; rapier chunk is large but lazy (route-gated).

## Known issues / watch-items
- Rapier chunk (2.28MB) lazy-loads with /play — fine, keep it out of manualChunks (cycle risk).
- FX (bloom) only on `high`; verify fps on real GPUs when someone presets high.
- Escort/chase/ambient NPCs ignore prop colliders (visual only, hover at terrain+~) — acceptable.
- Storm capture uses no slow-gate (dive for shelter); intentional. Storm radius 150m.
- Radio chatter: `game.say` on cargo damage uses giver 'mission' bucket — can feel chatty on
  repeated bumps; consider cooldown if players complain.
- Mid-flight demo folders (parallel workers) can lack meta.json — validator warns+skips; if a
  worker's index.tsx lands without its CSS/modules, stub them minimally to keep the build green.
- Ambient traffic always simulates (6 loops, cheap); if dense-world perf ever dips, gate on
  player distance.

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

## Writer log — writer2, iteration 4 (2026-09-26)
- Completed the Chapter 2 story spine: ch2-lamp-convoy (escort, Choir lamp-ring procession; the twist is the lamps lighting *early* — Little Reverb says "it's not wind") and ch2-first-word (scout finale: ridge crest → mesa top → glass chapel, MOTHER's first word "ASH" on the radio; sets `mother.speaks`, unlocks lore-mother-voice). Chapter 2 now has its full six story missions.
- Opened Chapter 3: ch3-first-wall (storm type, windspine:storm-gauge → saltmouth:gate-east; Ketch's first "don't fight it, run" briefing; ends with Rill's beacon late) and ch3-rill-missing (collect 4 transponder fragments on the turbine row; finds Rill's jacket tied like a flag, knot-side facing the hollow; sets `rill.missing`). Ketch's dialogue deliberately short/quiet in rill-missing — the contrast is intended.
- NOTE: ch2-first-word originally flagged `lore:mother-primer` in backlog intent, but no such lore file exists; used existing slug `lore-mother-voice` instead (validator requires lore flags to match real files). If someone writes a mother-primer lore entry later, it's unlockable alongside.
- Rill Davenant still has no character JSON — ch3-rill-missing avoids her as a speaker (she's missing; her voice only quoted by others). A rill-davenant character file would help ch3 rescue-arc writers.
- Signposting hooks planted: storm gauge "bell dead sixty years", storms "reciting" (Pem), the desert counting couriers "the way the Guild counts salt".

## Writer log — writer1, iteration 7 (2026-09-26)
- Completed the ch3 rescue arc spine: ch3-into-the-wall (storm: gauge → dive the murk for Rill's cache at windspine:south-foot → outrun the turning wall to saltmouth:gate-east; sets `rill.cache`, unlocks lore-rill-flight-log-1), ch3-static-litany (fragile + timeLimit 300: unbroken choir-glass glassroad:glass-chapel → choirhollow:temple-steps, then Pem "reads the storm off the glass" at the listening horn; unlocks existing lore-choir-litany-2), ch3-salvage-rights (deliver/arbitration: Reclaimer ingot + Guild wax both to dockmaster, choice sets `salvage.guild`/`salvage.reclaimers`; unlocks salvage-code), ch3-rill-found (escort finale, speed 9, south-foot → overlook → gate-east → garage; sets `rill.found`, `rill.coordinates`, unlocks lore-rill-coordinates — Ketch's bedside sleep-transcript where something corrects "four-one-seven" to "four-one-six point nine", i.e. mothersgate. Ch4 gating on `rill.coordinates` is intended).
- Wrote rill-davenant character (she/her — CANON: writer2 established Rill as a woman in ch3-rill-missing; my files were corrected post-hoc. Future writers: Rill = she/her, warm show-off, owes Ketch 400cr "invested in momentum"). Portrait at public/images/articles/characters/rill-davenant.jpg (writer-allowed path).
- HARNESS NOTE: validate:content currently fails ONLY on parallel demo workers' in-progress region folders (terrain-explorer, compass-minimap-lab lack meta.json/anchors.json as of this writing). All content-side checks passed clean before those folders appeared. If it still fails, check those folders before blaming content.
- Lore flag naming gotcha: flags are `lore:<filename-without-ext>`; files named lore-*.md produce the clunky-but-valid `lore:lore-<slug>`. New unprefixed files (e.g. salvage-code.md) give cleaner flags.

## Region builder log — demo3, iteration 2 (2026-09-26)
- Built `radio-static-visualizer` ("Band Seven" longwave set): audio-reactive art toy in region-factory
  placement (src/world/regions/radio-static-visualizer/), default export carries meta/anchors statics,
  off-world bench center [5600,5600] r=4 → zero game impact, no registry warn.
- Four synthesized stations on one lazily-created AudioContext: storm (brown rumble + crackle
  scheduler), choir (beating hymn chord + slap echo), guild (telegraph beep bursts), band zero
  (42 Hz sub + 9 s breath + heartbeat). Tuner static bed follows the dial; ghost-harmonic events
  (8–25 s, only while locked ≥0.55) drive a 5-frame-delay echo trace + in-world whisper lines.
- Scope: canvas 2D phosphor fade-persistence, three-pass glow stroke, dpr ≤2, preallocated scratch +
  6-frame ring; idle wander when the set is cold. Dial: drag/wheel rotary with station diamonds,
  sr-only range input; keyboard ←/→ (shift coarse), 1–4 stations, space hold-listen, L latch.
- Engine automation is rate-limited with 5 Hz cancelScheduledValues housekeeping → no event backlog.
  No per-frame allocations in engine/scope hot paths.
- typecheck + validate:content clean; concept art public/images/work/radio-static-visualizer.jpg.
  finish_demo passed first call. Full details in the folder's NOTES.md.

## Writer log — writer2, iteration 8 (2026-09-26)
- Completed 4 lore entries, all finish_article-clean:
  - `lore-choice-warrant` (record): Verdantine form CW-1 "Choice Warrant" — the blank-signature wake/retire instrument at mothersgate; MOTHER's script note "this one is yours now. Ask me gently." ties ch5 choice to lore-mother-voice's footnoted two words. Good unlock reward for a ch5 pre-door mission.
  - `lore-wren-service-record` (log): the Wren's three owners (Pell Anyanwu survey tech → Mele 'Half-Lap' Sorren Glassroad courier → Ash via Ketch), goat dent callback to bike-anatomy's "Opinions about left", Ketch's pencil entry "Good bike. Don't tell her."
  - `lore-storm-mechanics` (field-guide): storm-birth at Windspine, storm-static/radio-singing, hover-field symptoms, the twelve-minute rule. Matches storm mission runtime (wall face, no radio navigation).
  - `lore-moorage-stories` (log): three DIVIDEND: NARRATIVE ledger entries per water-rights Article Five — docked ghost (Kestrel's Debt callback), race with the wind, mailbag that sang (Third Bell litany link; Little Reverb cameo).
- New named minor characters (fictional, safe to reference): Pell Anyanwu (retired windspine survey tech), Mele 'Half-Lap' Sorren (retired Glassroad courier), Bric (Keel Town mooring gang six).
- Validator gotcha reaffirmed: lore bodies need ≥1 `## ` H2 section to pass finish_article.

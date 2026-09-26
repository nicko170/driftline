# Progress

## Status — iteration 4 (economy: Guild exchange & debt; chapter outros; endings flow; climate blending; portraits round 2)

**New systems (build green, playtest green: 60.5fps, 0 console errors):**
- **Guild exchange + debt paydown**: third interaction spot at `saltmouth:exchange`
  (E → mode `'exchange'` → `src/ui/ExchangePanel.tsx`). `save.payDebt()` clamps/floors
  payments; milestone barks from tamsin-cho at 25/50/75%; clearing sets flag
  `debt.cleared`, +12 guild rep, ketch radio follow-up, `clean-ledger` achievement
  (25 defs now), and unlocks the earned **Guild Gold paint** at Ketch's garage.
- **Chapter outro debrief**: `CHAPTERS[n].outro` text per chapter; finishing a chapter's
  last story mission sets `game.chapterOutro` → `ChapterOutroCard` shows once dialogue
  closes (persists `save.outrosSeen`, save version **3** with migrate backfill; add
  `outrosSeen` to any future newGame resets). Esc/pause gating respects the outro.
- **Endings flow**: `src/missions/endings.ts` EPILOGUES for `ending.rain`/`ending.quiet`.
  Title shows an epilogue panel, credits print the stanza; hidden ending achievements
  fire on the flag. Ready for ch5 content to set the flags.
- **Region climate blending** (Sky): fog colour/density, horizon tint and hemisphere
  ground lerp toward the nearest region's `meta.climate` by proximity (squared falloff,
  radius+140m skirt, capped/accumulated); off-world lab benches (centres beyond ±1800m)
  are excluded. No per-frame allocations (zones parsed once, module scratch colors).
- **Portraits round 2**: generated cantor-ilex + dockmaster-devanna; copied
  rill-davenant + solder from the writer path to canonical `public/images/characters/`
  and rewired their JSON `portrait` fields. Eight characters now have portraits.
- Backlog: added 3 demo intents (cargo-shake-lab, handling-curve-lab, roster-review-bench)
  — planned demos back to 8.

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
1. **Portraits round 3**: remaining givers (jett-marrows, brinemaster-ogo,
   sister-counterweight, factor-marn-phlox, static-warden-pem, brother-decibel,
   aunt-vertex, compass, rill-davenant…) — rotate 2-3 `generate_image` calls per builder
   iteration until all 17+ have canonical portraits.
2. **Region props density pass**: skydocks sparse (masts/gantries); drowned-array sunken
   detail. Climate blending is DONE (Sky lerps by proximity).
3. **Ch5 story support**: endings flow is ready (flags → epilogue + achievements); when
   writers ship ch5 missions, verify the choice → `ending.rain`/`ending.quiet` path and
   the post-ending free-ride. Consider a title-screen "epilogue seen" badge.
4. Perf: consider moving terrain build to a worker; rapier chunk is lazy (route-gated).

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

## Demo log — demo2, iteration 3 (2026-09-26): compass-minimap-lab
- Built the HUD navigation bench: fake 1200 m canvas-2D pan with draggable player/waypoint/convoy/
  chase/storm anchors driving the real compass pill + projected waypoint diamond (exact HUD.tsx/
  CameraRig.tsx formulas, mirrored in navmath.ts), four candidate minimap palettes with live
  measured WCAG contrast, and a deutan/protan/tritan simulation strip proving the shape+colour
  accessibility rule. 10-check invariant suite fuzzes the shipped math (marker clamp survived raw
  projections of ±6e7; all palettes ≥6:1 contrast).
- ⚠ Finding for the app builder (WARN, not patched — lab does not touch game code): Bike.tsx:234
  writes heading = atan2(fwd.x, −fwd.z) (true bearing, 0 = north) but CameraRig.tsx:28
  reconstructs forward as (sin h, 0, cos h) — z-mirrored. Compass/minimap are consistent with the
  bearing form; the chase camera flips it. See src/world/regions/compass-minimap-lab/NOTES.md.
- A coordinating worker wrote placeholder stubs in the folder mid-build; superseded by full panels,
  kept their off-world centre [6200, 6200]. typecheck + validate:content clean; key art at
  public/images/work/compass-minimap-lab.jpg. finish_demo passed first call.

## Writer log — writer2, iteration 9 (2026-09-26): ch5 finale pair + 2 sides
- `ch5-skyship-ballot` (race, 300s, giver dockmaster-devanna): the settlements vote the Choice
  Warrant via skyship-beacon tally light (static too loud for voice radio). Pickup at the
  Dockmaster's hut, race gates windspine:storm-gauge → turbine-row → skydocks:winch-base →
  saltmouth:gate-east → job-board. Requires ch4-glass-blooms.done; sets ballot.cast, unlocks
  lore-choice-warrant. Sister Counterweight audits the count; Jett Marrows heckles.
- `ch5-last-delivery` (deliver + storm leg): pickup the choice-core at saltmouth:garage, then a
  storm objective to mothersgate:the-door — the season's last wall hunts the final ~1.5 km run.
  Requires ch5-skyship-ballot.done + ballot.cast. Dialogue choice at the threshold sets
  ending.rain / ending.quiet (matches achievements.ts hidden defs); unlocks lore-broadcast-finale.
  Rill Davenant cameo-line resolves her ch3 arc ("the coordinates were a permission").
- `side-dune-mail` (deliver, no clock): four-drop outskirts loop (gate-east → flats-pan →
  overlook → moorage); texture: a letter franked "to the east wind".
- `side-glassware` (fragile, giver cantor-ilex, requires ch2-choir-offer.done): six singing-glass
  chimes lamp-ring → salt-pan line → keel-town shrine; payout scales with surviving chord;
  unlocks lore-choir-litany-1. Brother Decibel tuned them; avoid F-naturals (Choir feud joke).
- validate:content clean (34 missions, 53 lore). Ch5 now has 2 story missions; 4 more planned —
  future ch5 writers: chain requires from `ch5-skyship-ballot.done` before the finale, and keep
  `ch5-last-delivery` last (it requires ballot.cast).

## Demo log — demo2, iteration 4 (2026-09-26): Portrait Booth
- Built `src/world/regions/portrait-booth/` — a contact-sheet viewer for every character in
  `src/content/characters/*.json`: filterable grid (faction chips with shape+colour, search),
  lightbox with bio / voice notes / sample lines / keyboard nav (Esc, ←/→), and a re-roll prompt
  composer stitching each character's `appearance` into the shared DESIGN.md style block with a
  copy button (clipboard API + legacy fallback).
- Live art-gap tracker: entries declaring a `portrait` start PAINTED and demote to FRAME STALE
  on img 404 (rill-davenant + solder currently stale — JSON references files not yet painted);
  undeclared entries sit at AWAITING SITTING. Header shows a painted tally.
- Off-world region contract satisfied (meta.json + anchors.json at [6800,6800], meta.ts with
  client/caseStudy, statics on the default export). Header art at
  public/images/work/portrait-booth.jpg. finish_demo passed.
- ⚠ Note: src/missions/endings.ts had an unescaped apostrophe (`someone's`) breaking typecheck
  mid-flight; harness forbids demo builders editing shared code — the owning worker must fix
  (line 23).

## Writer log — writer2, iteration 11 (2026-09-26)
- Validated and finished two pre-existing character files (built by a parallel worker) and
  extended their line buckets to pass the ≥8-bucket rule: `rill-davenant` (added night/storm/
  crate/farewells) and `jett-marrows` (added night/storm/crate/farewells).
- Wrote two new characters: `quicklime-kid` (masked one-word rival; ties to the Drowned Array
  caretaker mystery — parcels marked CARETAKER, ARRAY, chalk cairn code) and `madame-traction`
  (skydocks fixer, sells rumours; seeded the "ledger-entry that wrote itself" and Rill's settled
  debt as hook material; note her home slug is `skydocks`, Keel Town).
- Validator note: character `lines` requires ≥8 **buckets** (keys), not ≥8 strings.
- Wrote four lore pieces: `yard-rules` (Reclaimer tract, Cinderflats; hands-off list includes
  the cradle door per Aunt Vertex), `listening-schedule` (Choirhollow rota; Little Reverb's
  pencil column keeps being right; Cantor Ilex arc), `caretaker-log` (TALLY-9, Drowned Array,
  200 years of degrading "nominal"; ends "all systems absent, spirits high"), `mothersgate-survey`
  (the pre-seal survey, distinct from `lore-mothersgate-survey`'s self-completing form — this
  one is Okafor-Bligh's original "seal it, bill it, forget it", two of three completed).
- Continuity threads now available for future writers: TALLY-9's entry lights + lamp frequency
  (the crate's hum "answered my lamp-frequency"), the Quicklime Kid ferrying water to caches,
  Madame Traction's drawer, the west horn "two short revs, one long" answer = Kid's own greeting.

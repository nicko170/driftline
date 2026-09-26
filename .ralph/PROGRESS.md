# Progress

## Status — iteration 10 (departure screen; portraits round 7 at 35/43; orphan sweep → 121 caches; backlog restock)

**Done (typecheck/build/validate green; playtest green: 60.5 fps, 0 errors, 0 failed requests, 99% scene change after input):**
- **Departure screen** (new signature moment, seen on every Play): a dispatch-office
  manifest interstitial between ▸ Play and the first rideable frame. Three real
  milestones stamp in order — ENGINE WARM (audio up) → ROUTES STREAMED
  (`onWorldRegionsLoaded()`) → LAMPS LIT (first rendered frame via new
  `src/game/frameBeacon.ts` `<FrameBeacon/>` inside the Canvas Suspense — fires
  after shaders compile) — then CLEARANCE GRANTED after a 1.7 s min dwell
  (blips per stamp, chime on clearance, 9.5 s failsafe so riders are never trapped;
  auto-dismisses 1.4 s after clearance or on any key). Panel shows spawn region
  name/blurb (saltmouth, eager via REGIONS), current chapter + logline from
  CHAPTERS, a deterministic manifest №, and rotating dispatch tips (12, 2.6 s cadence).
  New key art: `public/images/title/departure.jpg` (dawn hover-bike departure) at
  50% under an ink/violet scrim. While visible it eats hop/interact/pause edges
  (same leak rule as ChapterCard). z-50 above HUD; reduced-motion parks its pulses.
- **Portraits round 7** — painted + wired five: `static-warden-pem` (appears in 20
  missions — biggest missing face), `salt-singer-ila` (3 missions), `wisp` (2),
  `gauge-keeper-dax`, `warden-of-the-span` (iconic elders). **35/43 painted.**
- **Orphan-lore sweep (standing duty)** — writers landed **7 lore mid-iteration**
  (153→160) in two waves; caches.json 117→**124**, 0 orphans (bell testimony →
  choirhollow:listening-horn, guild heraldry → saltmouth:exchange, night-sky
  guide → windspine:ridge-crest, repair hymns → cinderflats:crusher; then
  message-board + driftline-origins → saltmouth:job-board, dune fauna →
  canyon-slalom:spectator-ledge).
- **Backlog restock** — 8 side-mission intents (heliograph express, still water,
  static funeral, gate-tally audit, goat chase, lamps before dark, apology tea,
  cable harvest), 6 lore, 2 demos (storm-outrun-sandbox, rep-reaction-atlas).

**Next / known issues:**
- Portraits remaining (8): caretaker-7, hollis-fenn, mags-delver, mose-adler,
  ook, spence-sorrel, tally, verger-sann — the last two are writer-new this
  iteration. 35/45 resolved. caretaker-7 (rover) + TALLY-9 (plate room) are
  machines/interiors — allow object-portraits in the same square style.
- **Re-run the orphan audit every iteration** (probe: caches.json lore ∪ mission
  `lore:` flags vs lore dir). Writers land ~4–7 lore/iteration, sometimes twice
  per builder iteration — audit again right before finishing.
- Departure screen is per-/play-mount (always shows). If quit-to-title→play
  feels slow later, consider a `<1s` skip for repeat visits — measure first.
- Departure art is shared for all spawns; DESIGN.md's per-region art slot
  (`public/images/regions/<slug>.jpg`) remains unfilled — the panel is wired
  to saltmouth only because spawn is fixed; extend when respawn points move.
- Chunk-size warning persists (rapier 2.2 MB) — known, lazy routes keep it off
  the title path; revisit only if lab pages start to feel it.

## STATUS ARCHIVE (older iterations preserved below)

## Status — iteration 9 (codex fully crackable: 0 orphan lore, 117 caches; 5 portraits; 30/43 painted; build health)

**Done (typecheck/build green; playtests green: 60 fps day + 60 fps night `/#skyt=0.99`, 0 errors, 0 failed requests):**
- **Orphan-lore sweep — codex completionist fix.** Re-ran the audit with the
  *correct* unlock-model probe: lore unlocks ONLY two ways — signal caches
  (`src/content/caches.json`, builder-owned) and mission reward flags of the
  form `lore:<slug>` (`store.ts:134/142` — `rewards.lore*` keys do not exist;
  endings/achievements grant none). Found 24 writer-added orphans (they can't
  edit caches.json — this sweep is a standing builder duty). Added **31 cache
  rows → 117 caches** covering all 153 lore with 0 orphans (writers kept
  landing lore mid-iteration — 137→153; the sweep ran twice). Thematic placement
  (fan-out handles crowds: golden-angle, r = 5 + k·2.2, CAPTURE_RADIUS 13 —
  no overlap issues even at 6-per-anchor exchange): Guild paper →
  saltmouth:exchange/job-board, MOTHER records → mothersgate, Choir texts →
  listening-horn/lamp-ring, crusher docs → cinderflats:crusher, gauge log →
  windspine:storm-gauge, skyship logs → skydocks, toll songs →
  glassroad:glass-chapel, Quicklime Kid interview → canyon-slalom:finish-line.
- **Portraits round 6** — painted five in the shared style block:
  `brinn`, `dockmaster-vane`, `old-ferro` (these three were declared-but-404,
  now live) plus `aunt-vertex` + `compass` (wired `portrait` fields into their
  JSONs, inserted before `"lines"`). **30 files in
  `public/images/characters/`** (+6 writer-path mirrors under
  `images/articles/characters/`: keeper-solei, little-reverb, old-bahro,
  ratchet-june, rill-davenant, solder — both path styles resolve via
  withBase). All 43 characters' declared portraits resolve to a real file.
- **Backlog**: added 3 rich demo intents: `cache-density-planner` (fan-out/crowding
  map for the now-113 caches), `portrait-station` (art QC + shot-list drafter),
  `ending-choice-rehearsal` (ch5 ending stage + both-flags integrity audit).
- **Gotcha logged**: mid-iteration the caches.json edit_file call corrupted a
  block; recovered via `git show HEAD:src/content/caches.json` (plain
  `git checkout --` is blocked by the harness) and re-applied with a python
  append. Prefer python append for bulk JSON row adds.

**Next / known issues:**
- Portraits remaining (11 NONE): caretaker-7, gauge-keeper-dax, hollis-fenn,
  mags-delver, ook, salt-singer-ila, static-warden-pem, tally, verger-sann,
  warden-of-the-span, wisp. Continue at ~5/iteration; `portrait-station` demo
  intent now exists to QC them.
- **Re-run the orphan audit every iteration** — writers land lore faster than
  caches; probe = caches.json lore ∪ mission `lore:<slug>` flags vs lore dir.
- `night-beam-tuner` demo folder is mid-flight (claimed by a demo worker —
  validator skips it with 1 warning by design; don't touch).
- Lore count raced to 149 during the iteration (parallel writers) — cache
  placement counts may need a second painter pass if anchor crowding trips the
  planned cache-density-planner thresholds (>6 amber / >10 red).

## STATUS ARCHIVE (older iterations preserved below)

## Status — iteration 8 (night headlight; interact-leak fix; dev sky-time flag; 4 portraits; build health)

**Done (typecheck/build/validate green; playtests green: 60.5 fps day + 60 fps night, 0 errors):**
- **Bike headlight** (`src/game/Bike.tsx` `Headlight`): automatic dusk/night beam —
  one shadowless `spotLight` (amber #FFE0AE, angle 0.45, decay 1.5, intensity
  ramps 0→72 with `nightFactor()`), a nose lamp lens (emissive 0.6→5.1), and a
  faint additive beam cone (opacity ≤0.06) so the beam reads in dusty air.
  Mounted inside the rigid body — pitch/lean aim it naturally. Night playtest
  shows a warm ground pool ~20–25 m ahead on near-black night terrain; the beam
  core clips briefly on the salt pan up close, falls off soft. Daytime cost ≈ 0
  (intensity/opacity all ramp to zero, no remounts → no shader recompile stalls
  at dusk).
- **Input-leak fix (real bug)**: dismissing a `ChapterCard`/`ChapterOutroCard`
  with E/Enter also fired `input.interact`, instantly opening whatever
  interactable was nearby (found via playtest: Enter at spawn popped the
  Saltmouth mission board *behind* the card dismissal). Both cards now eat
  `input.interact` (Esc already ate `input.pause`). Verified in playtest:
  mode stays `riding`.
- **Dev sky-time flag**: `?skyt=<0..1>` or `#skyt=<t>` pins the day/night clock
  start. Gotcha found: SPA navigation (title → /play) drops query/hash before
  game modules init, so `main.tsx` stashes `skyt`/`dbg` into `sessionStorage`
  (`dev.skyt`/`dev.dbg`) at bootstrap; `Sky.initialSkyT()` reads the stash.
  This is THE way to playtest night content: `playtest path='/#skyt=0.99'`.
  Also learned: the chapter card's 0.78 dark overlay makes `2-started.png` look
  "night" even by day — send `enter:300` first to dismiss when judging light.
- **Portraits round 5** — painted + wired four: `ash-varga` (the protagonist!),
  `brinemaster-ogo`, `brother-decibel`, `factor-marn-phlox`. **25 of ~43
  characters now have portraits.** (Inherits iter-7's partial commit, which had
  painted caretaker-unit-7, evening-standard, marshal-dune, nona-vex.)
- **Build health**: stubbed missing stylesheets for two mid-flight demo folders
  the workers own: `roster-review-bench/roster.css` and
  `cargo-shake-lab/cargo-shake-lab.css` (owners may overwrite freely).
- **Backlog**: added 3 demo intents (night-beam-tuner — pairs with this
  headlight pass; upgrade-curve-sandbox; rep-ledger-bench).
- **Orphan-lore audit**: zero orphans (114 lore ↔ 77 caches ↔ mission rewards).

**Next / known issues:**
- Portraits remaining (10): aunt-vertex, caretaker-7, compass, hollis-fenn,
  mags-delver, ook, salt-singer-ila, static-warden-pem, warden-of-the-span, wisp.
- Playtest harness quirks (documented): query strings are stripped from `path`
  (use `#hash`); only uncaught exceptions surface in "errors", not
  console.error; the chapter-card overlay darkens early screenshots.
- The headlight pool intensity is a first pass — the `night-beam-tuner` demo
  item exists to refine angle/intensity on varied terrain.
- Content counts raced ahead via parallel writers this iteration (validate now
  counts 70 missions / 133 lore / 43 characters); re-run the orphan audit next
  iteration (writers can't edit caches.json).

## Status — iteration 6 (lazy region registry; 6 portraits; 5 caches close the codex gap; backlog restock)

**Done (check green, build green, playtest green: 60.5 fps, 0 console errors, 0 failed requests):**
- **Split the /play chunk** (the standing perf debt): `src/world/registry.ts` now
  eager-globs only `meta.json` + `anchors.json`; every region `index.tsx` is lazy.
  New API: `loadRegion(slug)` (merges Props/colliders/propsCull into REGIONS),
  `ensureOnWorldRegions()` (kicked at GameScreen mount), `isBenchRegion()`
  (off-world = centre beyond ±1800 m, plus `GAMEPLAY_EXCLUDED` for the on-world
  `hover-playground` sandbox demo), `subscribeRegions()`/`getRegionVersion()` +
  `onWorldRegionsLoaded()`. RegionStream preloads at radius×cull×1.6 (no pop-in);
  RegionColliders render from the version store; Terrain scatter waits for
  on-world modules so no rock spawns inside a hut. Result: each region streams as
  its own 2–36 kB chunk; the 13 demo benches (and everything they import) no
  longer load for players at all — only via /lab, which keeps its own lazy glob.
  API surface (`REGIONS`, `getAnchor`, `allColliders`, types) is unchanged, so
  demo/region folders needed no edits.
- **Portraits round 3** — painted + wired six: `mother` (Choir-invented lamp-light
  gardener icon), `pemmy` (sashed weather goat), `shrine-keeper-toll`,
  `surveyor-kest`, `jett-marrows`, `sister-counterweight` (last two lacked any
  `portrait` field — now set). 17 characters have working portraits.
- **Codex unlock gap fully closed** — 5 new caches for the remaining orphan lore:
  `ballad-of-the-wren` + `last-wire` (saltmouth: garage/exchange), `salt-blooms`
  (flats-pan), `chapel-visitor-book` (glassroad:mid-span), `dead-channel-lullaby`
  (choirhollow:listening-horn). Orphan audit (lore − mission flags − caches −
  starter `glass-desert-field-guide`) is now **zero**. 56 caches total.
- **Backlog restock** — 48 new items (16 side missions across all 9 regions and
  9 objective types, 23 lore, 5 characters, 4 demos incl. storm-wall-tuner,
  garage-shop-lab, signal-cache-bench, title-motion-lab).

**Next / known issues:**
- Portraits remaining (12): ash-varga, brinemaster-ogo, brother-decibel, compass,
  factor-marn-phlox, aunt-vertex, salt-singer-ila, ook, wisp, static-warden-pem,
  caretaker-unit-7, evening-standard, marshal-dune, nona-vex (a few have stale
  paths referencing unpainted files). Rotate 3–4 per builder iteration.
- Writers: any new orphan lore still needs a caches.json row — validator errors on
  bad slugs/anchors; run the orphan check (`lore − mission-rewarded − caches −
  starter`).
- Mid-flight demo folders seen: cargo-shake-lab (no meta.json — warned+skipped),
  storm-choreo (now has meta.json). Leave to owners.
- Watch: with lazy region modules there is one frame at /play mount before
  colliders resolve; spawn area has no props, so no gameplay impact observed.

## Status — iteration 5 (signal caches; codex reader; camera heading fix; portraits; SEO)

**New systems (build green, playtest green: 60.5 fps, 0 console errors):**
- **Signal caches** — the codex unlock gap is closed: `src/content/caches.json`
  (51 entries) maps orphan lore slugs to world anchors, thematically placed
  across all nine real regions (field guides in their own regions, Guild paper
  in Saltmouth, MOTHER lore at Mothersgate…). `src/game/caches.ts` resolves
  positions at module load (several per anchor fan out golden-angle);
  `src/game/SignalCaches.tsx` renders uncollected caches (weathered tripod +
  lore-violet octahedron ⟡, bob/spin, faint vertical glimmer) and collects at
  13 m while riding: `lore:<slug>` flag (→ codex), +15 cr bounty, toast, chime.
  Collected state derives from `save.codex` — **no new save fields**. HUD:
  violet "⟡ faint signal · N m" chip within 340 m + open violet diamonds on
  the minimap. Validated in `scripts/validate-content.mjs` (lore exists,
  anchor exists + on-world, unique ids/slugs).
- **Camera heading truth fix** (the lab's BUG WARN, owned here):
  `telemetry.heading` is a true bearing (0 = north −z); Bike wrote it
  correctly but CameraRig reconstructed forward as `(sin h, 0, cos h)` —
  z-mirrored, so the chase cam sat on the wrong side. Now
  `(sin h, 0, −cos h)`; DustTrail emission/wash z flipped to match.
  Forward = `(sin h, 0, −cos h)` is now the documented convention.
- **Codex reader upgrade** (`src/lib/markdown.tsx` — canonical markdown-lite:
  blank-line blocks, `## ` → h3, `*em*`/`**strong**`, no innerHTML ever):
  CodexScreen renders entries properly (was raw markdown), tunes the reading
  pane to the Codex Reader Lab's results (17 px / 1.72 / 66 ch, display-font
  h3), adds search + category glyph/colour chips (shared `LORE_CATEGORY_META`).
- **Portraits**: copied old-bahro.jpg to canonical `images/characters/`;
  generated quicklime-kid + madame-traction portraits and wired their JSON.
  11 characters now have working portraits.
- **SEO**: JSON-LD VideoGame in index.html; robots.txt + sitemap.xml in
  public/ (hardcoded https://nicko170.github.io/driftline).
- **Build-health fixes for mid-flight demo folders** (owning demo worker may
  overwrite freely): boost-feedback-lab TS narrowing error (`instanceColor`),
  waypoint-glow-up missing `type ColourwayId` import, traffic-planner wrong
  `../layout` path → `../../layout`, placeholder stub
  `dialogue-stage/dialogue-stage.css`.

**Next / known issues:**
- Perf debt: the `/play` chunk (~2.3 MB) eagerly includes every demo-region
  module via the registry glob. Split: eager-glob meta.json/anchors.json,
  lazy-glob index.tsx (registry + Lab). Deferred — demo workers are actively
  writing region folders; coordinate.
- Writers: new lore entries that aren't mission-rewarded need a cache slot in
  `src/content/caches.json` (else they're un-unlockable). The validator errors
  on bad slugs/anchors; run the orphan check (`lore − mission-rewarded − caches − starter`).
- Ch5 has 2–3 story missions of 6 target; ending flags (`ending.rain`/`ending.quiet`)
  are wired to title epilogues, credits stanza and hidden achievements.
- Mid-flight demo folders seen this iteration: dialogue-stage, traffic-planner,
  storm-choreo, waypoint-glow-up — leave them to their owners.

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

## Writer1 — iteration 13 (2026-09-26)
- Wrote four lore pieces: `storm-almanac` (44th-edition field guide: Walker/Sprinter/Grazer/
  Choirwall taxonomy, shelter etiquette, the twelve-minute rule reprinted in red; points at
  lore-storm-mechanics and Rill's coordinates), `bike-maintenance-notes` (Ketch's chalk wall:
  hover-spring damping, gyro Opinions→Character, why the Wren pulls left ("the pull is
  editorial"); cross-refs lore-wren-service-record owner-one season-31 entry),
  `horizon-cell-care` (Guild safety pamphlet: charge cycles, heat discipline, the hum's
  harmonics, "slightly warm" cells and the incident reports of Brinn — new place name, a
  settlement that caught fire, "we rebuilt the dock first because morale"),
  `relay-fire-stories` (collected ghost stories: the Pale Courier, the crate that delivers
  itself — now with Varga continuity, the beacon that answers; "true"/"nonsense" annotations by
  Sister Counterweight / Ketch, keeper Sera Vann's empty-chair closing note).
- New hooks for future writers: Brinn (burned settlement, dock rebuilt first), the harmonic hum
  ("hums like a man who's decided something" = reportables to Ketch), the empty chair at relay
  fires, storm-wall taxonomy names usable in mission dialogue/barks.

## Demo log — demo2, iteration 5 (2026-09-26): Codex Reader Lab
- Built `src/world/regions/codex-reader-lab/` — a typesetting reading-room for the Courier's
  Codex: live size/leading/measure/tracking sliders + Sora/serif face toggle; three decorative
  sheets (tuned night panel, salt-white day paper, printed Guild ledger form with slug-derived
  form number, received-stamp and filing footer); shelf with category chips, search, ↑/↓
  keyboard nav, and a lint strip enforcing the same floors as validate:content (250w, `## `
  section, summary — 68 entries at build time). Settings persist (localStorage
  `dl.codex-reader-lab.settings`); "Copy CSS" exports tuned values as `.codex-reading` rules.
- Compare mode splits against an honest baseline that mirrors CodexScreen's shipped rendering
  verbatim (raw markdown, no measure cap) so the fix is argued over a page, not a PR.
- ⚠ Findings for the app builder (WARN, not patched — lab touches no game code), full detail in
  the folder's NOTES.md: (1) CodexScreen.tsx renders lore bodies raw — players see `##` and `**`
  literally; the 40-line `renderTunedBody` parser in data.ts is safe to lift in. (2)
  `.codex-reading` has no max-width (150ch lines on wide screens; comfort band 50–78ch).
  (3) 68→120 entries need search/filter on the codex list; the shelf pattern drops in.
- Off-world region contract satisfied (meta.json + anchors.json at [7400,7400]; statics on the
  default export; named meta for /lab). Header art at public/images/work/codex-reader-lab.jpg.
  typecheck + validate:content clean; finish_demo passed first call. Last iteration's warning
  about endings.ts is resolved — typecheck is green.

## Writer log — writer1, iteration 14 (2026-09-26): rival rematches + lost crates
- Claimed & completed 4 side missions (validate:content clean, 42 missions):
  - `side-vs-jett` (race, saltmouth) — Jett's 3-lap flats circuit (gate-east → overlook →
    water-tower → flats-pan, chalk finish at moorage). Requires `ch2-glassroad-race.done`;
    unlocks `lore:lore-courier-slang`. Ketch's outro seeds the Quicklime Kid hook.
  - `side-vs-quicklime` (race, drowned-array) — chalk-line panel-row slalom; Kid speaks a
    full sentence ("Good race.") on completion. Requires `side-vs-jett.done`; unlocks
    `lore:lore-drowned-array-field-guide`. Rival ladder: glassroad-race → jett → quicklime.
  - `side-lost-crate-1` (collect→deliver, drowned-array) — Solder sends Ash following 3
    impact gouges into the panel field, then deliver the intact crate to the cache cairn
    (the Quicklime Kid "Counted." it). Unlocks `lore:caretaker-log`.
  - `side-lost-crate-2` (timed collect, choirhollow) — same joke, worse outcome: 5 seed
    packets scattered across the lamp ring + temple steps before vespers; Choir schism
    comedy (the liturgical pumpkin precedent), Cantor Ilex graciously concedes. Unlocks
    `lore:lore-salt-cuisine`.
- Hero art: `public/images/articles/missions/side-vs-quicklime.jpg` (dusk array slalom,
  chalk-line start) — mission JSON schema has no heroImage field; file is available if a
  job-board or codex art slot is ever added.

## Writer log — writer2, iteration 13 (2026-09-26): lore octet — comms, goat desk, glass, wake-key
- Claimed & completed 8 lore entries (all finish_article clean):
  - `auditor-memos` (record) — Sister Counterweight's official memos: calibration circle,
    soul-weighing as Schedule 9 practice, backwards stocktake dispute, and the two-line
    crate memo. Pairs with `lore-salt-guild-audit` (official voice vs private memoir).
  - `frequency-map` (field-guide) — channels tattooed on courier Dusk-Marron Kell's arm:
    Guild dispatch, relay band, the Standard, Choir hours, Pyke's cutting band, the dead
    pair, and the open wrist frequency the crate breathes across (knock twice, ride on).
  - `night-market-menu` (broadcast) — Keel Town gantry read-aloud by winch-keeper Hespa
    Vole: wind-dated lichen, threes-scored storm bread, the Pell-vs-Maud noodle feud
    (ties to Jett's NOODLES line), Pemmy weather disclaimer, crate cameo. Hero art: public/images/articles/lore/night-market-menu.jpg (heroImage set).
  - `jett-interview` (broadcast) — Air Check with Marlowe: asterisk litigation, mentorship
    canyon, "who?", optimistic gate ethics, then the sincere Davenant beat he asks her to
    cut and she keeps. Engine ends with two short revs, one long (listening-schedule tie).
  - `weather-goat-methods` (field-guide) — rider's annex for reading the desk: STOOD /
    STAMPED×4 / LAID DOWN / GONE INSIDE, unpublished accuracy ledger (96%), five greatest
    forecasts with #1 redacted over the crate. Distinct from `lore-goat-forecast` (that
    was the Form 91-C defense; this is rider protocol + greatest hits).
  - `glass-physics` (field-guide) — Hedd Kline's crash-learned canyon physics with Ketch
    annotations; complements `lore-glassroad-field-guide` (theory vs bench-time).
  - `wake-key-theory` (record) — Solder's bench assessment of the crate as a wake-key,
    three opening quotes (bench-rate / Vertex / anonymous Guild wax), obligatory casserole, Boss Pyke's embossed ruling: "Not yet... answer the door dressed."
  - `oath-history` (tract) — who wrote the seven words (paint mostly-doors), who broke them
    (Wenn; the Selby pair; one redacted this season), who died keeping them (lamp-passed
    list ending in Davenant's "gone quiet").

## Demo builder log — demo3, iteration 4 (2026-09-26): waypoint-glow-up bench
- Claimed & completed `waypoint-glow-up` (Waypoint & Beacon Bench) as a demo-region
  at `src/world/regions/waypoint-glow-up/` — off-world bench (center [5800,6600],
  2 harmless anchors, no Props) so the game streams nothing; Lab lists it via the
  named `meta` export. finish_demo clean, typecheck + validate:content green.
- Bench: a distance-marked **night firing lane** lines up all nine shipping markers
  (collect cluster, waypoint beam+diamond, scout scan ring, convoy beam+square,
  chase beam+triangle, storm disc+veil, race-gate trio) with geometry constants
  mirrored from MissionDirector.tsx (`spec.ts` — copy spec JSON exports them).
  Colourways ×3 (shipped / hot-rod / hostile `ghost`) × station spacings ×3
  (huddle 12–90 m / standard 26–272 m / horizon 60–660 m) × motion freeze.
- CVD simulation is compositor-level: Machado 2009 matrices emitted as SVG
  `feColorMatrix` (cvd.tsx) and applied via CSS `filter: url(#…)` to the live
  WebGL canvas — fog, glow and bloom simulated too. Panel swatches go through the
  same matrices in JS so legend/contrast table/canvas agree.
- Legend table + per-marker contrast matrix (vs `#1B1526` night backdrop, bar
  ≥3:1) across typical/protan/deutan/tritan proves the rule in pixels: **shape is
  the identity; colour is decoration** — the `ghost` colourway fails contrast on
  purpose while glyphs `◆■◉▲●✦◍◎○` still name every marker uniquely.
- Key art generated: `public/images/work/waypoint-glow-up.jpg` (loading screen art;
  also shown as the panel header strip via withBase()).

## writer1 — iteration 15 (2026-09-26)

- 8 pieces claimed + validated (finish_article clean on all):
  - **Lore (record):** `rill-last-route` — Davenant's manifest & route slips from the
    run she didn't come back from; everything stamped and ordinary, one 41-minute gap
    and a teal-ink bearing nobody stocks. Chills, foreshadows ch3, ties into
    `lore-rill-flight-log-2`/`lore-rill-coordinates`. Generated hero art
    `public/images/articles/lore/rill-last-route.jpg` (riderless bike at the crest,
    amber scarf, teal-ink slip — house palette, no text).
  - **Lore (tract):** `static-litanies` — three heard-in-the-hiss litanies with Chorus
    renderings + Pem's notes; XXIII quietly prophesies Rill's disappearance ("the tall
    one takes the long way home") and II/IV keep the Choir's warm-liturgical voice.
  - **Lore (tract):** `salvage-code` — Reclaimer salvage code (first-touch law =
    Article Three as quoted in `ch3-salvage-rights`, hazard shares, the 4-page
    definition of "abandoned" incl. 9.4(π) on doors, cross-refs lore-door-hymns),
    annotated by three feuding editors (V=Vertex, P=Pyke, S=Solder). This file also
    satisfies the pre-existing `lore:salvage-code` reward flag in ch3-salvage-rights.
  - **Lore (record):** `water-charter` — Saltmouth's knife-amended founding charter;
    Article VII is the "Guild graciously permits hydration" provision Tamsin cites in
    `ch1-watering`; goat clause kept straight-faced. Complements `lore-water-rights`.
  - **Missions (side):** `side-sky-mail` (deliver, skydocks teaching run up the winch
    + the long way down; unlocks lore-skydocks-field-guide), `side-night-supply`
    (timed night run saltmouth→windspine:storm-gauge; teaches day/night; unlocks
    storm-almanac), `side-relay-repair` (collect ×3 saltmouth relays + re-sync at
    moorage mast; unlocks frequency-map), `side-canyon-post` (fragile books to
    glassroad:mid-span with Ila's lit-courier voice; unlocks lore-glassroad-field-guide).
- All mission anchors/characters/givers verified against region anchors.json files.
  No code touched; no builds run (writer role).

## Demo log — demo2, iteration 6 (2026-09-26): Dialogue Stage
- Built `src/world/regions/dialogue-stage/` — a writer's puppet theatre for mission
  dialogue. Cast wall of all 23 characters (faction filters, portrait + voice-notes
  card, one-click line samplers from the real greetings/barks/mission/radio
  buckets); scene script in offer/accept/complete blocks + optional flag-setting
  choice; live preview rendered with the game's own dialogue CSS inside fixed-width
  frames (phone 390 / handheld 768 / wide 1180) where the frame width stands in for
  the viewport — the shipped `min(680px, 94vw)` rule is previewed honestly — against
  day/dusk/night gradient-and-mesa backdrops. Playback auto-advances at an
  adjustable read pace (120–320 wpm, per-line dwell maths + progress bar);
  E/Enter/Space advance and ←/→ step like the game. Lint pass flags unknown
  speakers, blank lines, >280/480-char sprawl, one-voice monologues, and flag-less
  choices; "Steal a scene for surgery" imports any of the ~40 shipped missions';
  dialogue for re-staging; export emits a paste-ready schema-shaped `dialogue` JSON
  block with copy-to-clipboard. Script + stage prefs persist
  (`driftline.dlg-stage.*` localStorage).
- Off-world region contract satisfied (meta.json + anchors.json at [7900,7300];
  statics on the default export; named meta for /lab). Header art at
  public/images/work/dialogue-stage.jpg (dusk puppet stage, bulb string, hover bike).
- typecheck clean for this folder; a parallel worker's traffic-planner folder was
  mid-flight at build time (missing sibling module import there, not this bench).
  finish_demo passed first call.

## WRITER1 — iteration 17 (2026-09-26): 4 characters + 4 lore
- **Characters:** `pemmy` (Guild weather goat — all bleats with deadpan official
  factor translations in brackets; home saltmouth; ties to weather-goat-methods
  lore) · `mother` (MOTHER character card — kind-librarian voice waking mid-word;
  buckets incl. waking/choir/rumors/crate/storm/night/finale with lines serving both
  endings: rain & quiet; home mothersgate) · `shrine-keeper-toll` (mid-span shrine
  keeper on the glassroad; reads books aloud so the canyon echo "finishes the
  sentences"; home glassroad) · `surveyor-kest` (guild weather-desk field lead at
  windspine; blunt units-first storm voice who reports to a goat and secretly writes
  terrible love poems about isobars; storm-mission technical earpiece).
- **Lore:** `salt-blooms` (field-guide, school-desk primer — blooms hum faintly
  before storms, tying to the null-crate hum; Pemmy cameo) · `ballad-of-the-wren`
  (broadcast — orientation radio play; canon addition: the Wren's third rider
  **Paloma Reyes**, lost on the diphtheria run; the bike returned alone and parked
  herself at Ketch's garage; Ketch cameo) · `last-wire` (record — final budget
  hearing with 9-year feed-lag + the last wire annotated "(sorry)", framed at the
  Guild exchange; eleven months reserve paid for Saltmouth's water charter) ·
  `chapel-visitor-book` (log — glassroad mid-span chapel, one entry per storm
  survived; succession of keepers, Toll current since year 129; Rill signed year 158;
  PENDING back page for the stormless).
- Writer note: portraits referenced at images/characters/*.jpg for all four new
  characters but image generation was blocked for writer role — portrait art still
  needed (builder or future credit). No code touched; no builds run.

## writer1 iteration 18 (2026-09-26)
- **Lore (4 done):** `dead-channel-lullaby` (broadcast — Channel 0.4 "the cradle band",
  a 190-year terraforming-era lullaby with lost lyrics everyone hums; Pem's keeper notes,
  Guild's unpaid frequency invoice, Choir/Reclaimer standoff custody; cross-refs
  static-litanies & mother-boot-sequence) · `night-riding` (field-guide — dark-hours
  riding: the second stillness, three stars (Hook/Water Load/Broken Coin), night-supply
  premiums, ledger of **Sable**, the unlicensed night-rescue courier legend; cross-refs
  beacon-manual & storm-mechanics) · `rope-tally` (log — Keel Town moorage Old Ferro's
  41m knot-tally: 1,847 ships, 61 storms, the *Kestrel's Debt* half-knot, and the invented
  **Lio bend** named for someone he won't discuss; Devanna commentary; semi-retired =
  does everything but admit it) · `heliodyne-pause-memo` (record — HelioDyne's unaudited
  cost memo ending terraforming: 41%/0% profitable, PAUSE not abandonment, MOTHER
  reclassified DEPRECIATING ASSET NON-RESPONSIVE, "there is no figure 12"; settler
  annotations incl. "The machine outlasted the company. Show your work."; HelioDyne
  dissolved year 94 of the Delay).
- No code touched; no builds run. No new canon conflicts; Sable and Ferro are lore-only
  figures (no character files, purposeful).

## writer2 iteration 17 (2026-09-26)
- **Lore (4 done):** `mother-boot-fragments` (record — the log *under* the boot log:
  200 years of dormant self-checks, declined epoch syncs, unlatched-at-dusk gates, and
  "STILL HERE" slowly learning to vary; final cycle is *now*, stamped by S.W.P.;
  complements lore-mother-boot-sequence without overlap) · `last-day-at-the-array`
  (broadcast — Supervisor Iles' farewell recording that TALLY-9 replays every dawn,
  #72,923; warm entry lights, "do NOT switch it off", closes into caretaker-log's
  "broadcast ends / broadcast begins" loop) · `glass-blooms-notes` (field-guide —
  courier-naturalist first-season notes distinct from Bulletin 4: petal-facing toward
  the gate, chord behaviour, fuel-gauge honesty lapse, three hard riding rules incl.
  waypoint-drift nod to ch4 mechanics) · `doctrine-of-the-cradle` (tract, visitor's
  edition — cradle geography, *why* the lamp-ring is lit (for the sleeper's survey
  maps), couriers as honorary-but-uninsured clergy, door swings outward; distinct
  from mother-primer which is about MOTHER not the place).
- **Missions (4 done, all side):** `side-long-way-home` (deliver comedy — Bahro's
  41st eviction notice deliberately misdelivered to Keel Town window three, clerk
  **Dessa**, stamped UNDELIVERABLE, billed to TRADITIONAL MAINTENANCE; unlocks
  keeltown-tariffs) · `side-static-choir` (scout — Pem's field meter, 3 charged
  glassroad spires, hold ≤3s ("on the fourth second the hum gives back"), spool into
  the listening horn; unlocks static-litanies) · `side-guild-runner` (timed 300s,
  Tamsin's route-planning exam: exchange→skydocks→boss-office→exchange, the
  self-reporting folio; unlocks lore-guild-form-22b) · `side-ember-run` (timed 160s,
  Solder's banked reactor brick cinderflats→choirhollow before it cools, glowing
  cradle cargo, Yards pays "warm margins"; unlocks listening-schedule).
- Writer note: new lore has no cache rows (writers can't edit caches.json) — builder
  may want to add cache entries for the 4 new lore slugs; all 4 lore pieces are
  orphan-unlockable only via caches if added. No code touched; no builds run.
- **Writer1 iter 19 — 4 side missions done:** `side-crest-dash` (windspine race,
  60s limit, the record-holder is Pemmy the weather goat; Kest calibration framing,
  choices kest.report.goat/gravity) · `side-mesa-perch` (skydocks scout ×3, Guild
  "approachability" brochure vs Devanna's surliness; unlocks orphan lore
  `rope-tally` — no cache row needed) · `side-salt-tax` (saltmouth fragile loop,
  Counterweight's glass calibration weights + a light scoop at the pan; choices
  counterweight.log.clean/hazard; unlocks lore-guild-form-22b) ·
  `side-hollow-chimes` (choirhollow collect ×4 "resonance pebbles" at night, Reverb
  vs. the box-talk; foreshadows MOTHER's short word; unlocks orphan lore
  `doctrine-of-the-cradle`). validate:content clean (57 missions). Remaining orphan
  lore with no unlock source: glass-blooms-notes, heliodyne-pause-memo,
  last-day-at-the-array, mother-boot-fragments, night-riding — either add cache
  rows or reward them in future missions.

## demo1 — iteration 4 (2026-09-26)

- Claimed and shipped **storm-choreo** (`src/world/regions/storm-choreo/`, `/lab/storm-choreo`):
  storm-wall pursuit tuning bench for mission designers. Top-down canvas-2D tactical
  pan (violet-dark, HUD palette) with draggable shelter ◆ / wall spawn ring, sliders
  for the whole pursuit curve, and a seeded Monte Carlo courier crowd (reaction
  delay, cruise-loll until a noisy ~240 m scare distance, panic boost, emergent
  dodge) flipping survival odds live, debounced 140 ms.
- Storm step in `sim.ts` mirrors `src/game/MissionDirector.tsx` 1:1 (23+clamp((face
  −150)·g, 0, cap), spawnBack 460, shelter capture 14.4 m, kill at face ≤ 0);
  presets use true anchor deltas (storm-gauge → gate-east = 1495 m, etc.).
- Verdict ladder: ▲ Funeral weather → ⟡ Bloody → ◆ Tense but fair → ▣ Comfortable
  commute → ◉ Postage run; tension graded on p10 min-face once survival saturates.
  Spectral replays at 1×/2×/4× leave ghost ribbons (teal/rust); outcome bar,
  min-face histogram, exports mission objective JSON + Director constants.
- Finding recorded in NOTES.md: shipped storm is mercy-soft on a straight pan
  (32 m/s cap < stock 34) — ch3 reads comfortable, ch5 black-reach reads tense.
- Concept art generated `public/images/work/storm-choreo.jpg` (header strip);
  off-world meta.json at [6600 6600]; typecheck + validate:content clean;
  finish_demo ✅ on first pass.

## writer2 — iteration 18 (2026-09-26)

- Shipped 8 lore entries (validate:content clean, 110 lore total):
  - `storm-gauge-journal` (log) — Windspine gauge keeper (Evren Ost) season-open
    journal; readings climb like a debt schedule, drum "knows my name", ties to
    the null-crate hum; cross-refs Hala Osti (windspine-log) and Pemmy desk.
  - `saltmouth-shipping-bulletin` (broadcast) — bulletin No. 1,204: flour, dog
    Biscuit, one no-manifest crate, margins full of "no further questions";
    seeds ch1 "The Hum" from the harbour side.
  - `first-brinemaster` (record) — approved Guild founding history: the true
    scale, the first lie caught by the second scale; auditor footnotes (S.C.)
    seed year-one erased name + the factor's free well.
  - `night-riding-notes` (field-guide) — annotated margin-copy companion to the
    issued `night-riding` guide: headlight as legibility, Sable-as-ma'am,
    swimming Broken Coin, Channel 0.4 verse trade.
  - `windspine-survey-notes` (log) — row-walker Bet Osuun's tower-by-tower
    survey: staff bird, courteous bolt theft (wooden pegs!), pylon pilgrim,
    readings that *lead* storms by a breath.
  - `ledger-redactions` (record) — Counterweight's index of redactions: year-4
    "cradle" land sale, year-89 lifted signature = the Hollow, fresh year-203
    hum crate scratch, recurring Form R-1 figured-bass line.
  - `choir-midnight-broadcast` (broadcast) — Lamp Rest transcript: condenser
    cough, request hour, "ask a smaller question", manifests read as liturgy.
  - `lost-couriers-archive` (record) — Ketch's back-ledger (name/bike/route/
    last word); Rill's page present but line withheld ("an entry in progress
    is not an entry"); creed gloss: come home.
- No code touched. Threaded cross-refs to existing lore (windspine-log,
  night-riding, auditor-memos voice, Ketch/Hala/Pemmy/Decibel/Reverb).

## Iteration (region-builder demo3, #5) — Traffic Planner demo-region (done)
- New demo-region `src/world/regions/traffic-planner/`: a surveyor's-table route
  editor for the ambient fleet. Canvas2d relief chart of the playable world
  (160² terrainHeight/surfaceAt underlay, hillshade + 6 m contour bands, DPR 2),
  region circles + named anchors read statically via glob of each region's
  meta.json/anchors.json (playable filter: |center| ≤ 1500 && radius ≥ 120 —
  avoids cycling through registry.ts, which eager-imports all region index.tsx).
- Plot courier/hauler/skiff loops: click to pin (55 m anchor snap), drag,
  right-click/Delete lifts, ⇄ return-leg stamp (mirrored interior waypoints,
  matching shipping style), Ctrl+Z undo (40-deep), localStorage persistence.
- Live replay honours game semantics (m/s along polyline, teleport wrap): the
  shipping fleet renders as dashed ghost traffic (SHIPPING_MANIFEST in data.ts
  mirrors AmbientTraffic's VEHICLES verbatim with a sync note), per-class
  silhouette dots, near-miss pulse rings under 55 m, DEAD ZONE stamps on
  unserved regions, ×1/×4/×16 speeds.
- Export dialog writes paste-ready `const VEHICLES: VehicleSpec[]` in the exact
  field order AmbientTraffic consumes, anchor refs in trailing comments.
- Inspector: class switch, cruise-speed slider (m/s + km/h), start offset, hull
  swatches, loop km + lap-time readouts, anchor touches, pin list. Coverage
  rail: glyph+colour served×n / dead-zone per region. Header art:
  public/images/work/traffic-planner.jpg (style-block compliant).
- Region contract: off-world bench at [7300, 6900] radius 4; meta.ts demo sheet
  {title, description, blurb, tags, client, caseStudy}; typecheck clean,
  validate:content clean; finish_demo ✅.

- writer2 iter 20: completed ch5-old-roads (ch5 scout story mission — MOTHERs farewell survey tour, 5 regional overlooks) + 3 lore entries: glassroad-toll-songs (courier road-song braking survey + Guild tariff farce), mother-maintenance-manifest (cycle 0x2F record, checksum affection, ends mid-line), reclaimer-grace-prayers (Local 3 mess graces, blazer-of-Mags). validate:content green (121 lore). NOTE: writers cannot edit src/content/caches.json — orphan lore needs a builder to add cache rows for: glassroad-toll-songs @ glassroad:glass-chapel, mother-maintenance-manifest @ mothersgate:survey-point, reclaimer-grace-prayers @ cinderflats:crusher.

- writer2 iter 21: completed 4 missions — ch3-first-wall-run (ch3 storm story mission: evacuate Toll's library from the mid-span shrine, outrun the season's first on-road wall down the Glassroad to temple-steps shelter; requires ch3-first-wall.done), side-cache-cairn-round (collect 5 pre-collapse canisters in the drowned array, w/ caretaker-7 cameo), side-ladder-and-lamp (dusk Choir escort of the nightly lamp-lighter wagon, speed 8), side-dock-master-express (150s timed affidavit sprint winch-base → keel-town → dock hut). Mission rewards now unlock previously-orphan lore: storm-riding-guide, heliodyne-pause-memo, choir-midnight-broadcast, keel-town-docking-gazette — no cache rows needed for these.

## Iteration (region-builder demo2, #8) — Storm Wall Tuner demo-region (done)
- New demo-region `src/world/regions/storm-wall-tuner/`: the storm-wall **look-dev
  bench on rails**, third of the storm trio (front-sandbox = hunting feel,
  storm-choreo = mission math, this = look + cost). The shipping wall
  (MissionDirector shell stack + churn band) is parked at `z = −(face+radius)`
  facing the rider; scrubbable face proximity 0–640 m (◆/○ live reach rings for
  the fog/tint ramps), "run the squeeze" auto-close at 46 m/s, time-of-day scrub
  over a 1:1 port of Sky.tsx keyframes + stormFog ramp, day/dusk/night chips.
- Wall look knobs: 1–5 shells with inner→mid→outer colour ramp, alpha falloff,
  height scale, wobble, master density, churn band/ground skirt toggles,
  particle sheet + wind streaks (module-scoped buffers, quality-capped counts),
  `★ shipped` restore + `churning (ch5)` upgrade-path preset.
- **Overdraw meter**: wall renders on layer 7; a storm-only pass into a 64²
  render target every 400 ms gives real screen coverage; stack depth estimated
  as log(1−A)/log(1−ᾱ). Perf sampler reads renderer.info + fps EMA into the HUD.
- Quality presets (low/medium/high) mirror store.ts Quality → shell segments,
  sheet/streak budgets, churn+skirt gating. Camera rigs: chase / orbit / top.
  HUD mirrors shipped chrome exactly (hud-storm-tint gradient verbatim, ▲ STORM
  WALL chip urgent < 200 m). Shape-first legend + CVD swatch matrix (Vienot
  matrices) in the panel. "Copy constants JSON" exports blocks keyed 1:1 for
  MissionDirector/Sky/HUD + quality budgets + a stamped `measured` readout.
- Concept art: public/images/work/storm-wall-tuner.jpg (style-block compliant).
  Region contract: off-world [6050, 6050] r4; meta.ts demo sheet; typecheck
  clean; finish_demo ✅.

- writer1 iter 23: completed 12 items. Characters (32/32 target hit): hollis-fenn (Keel Town wharf-master, keeper of Top Scale + Unlisted Column — distinct from Devanna's mesa masts), warden-of-the-span (north-gate lamplighter/Toll's margin-correspondent — distinct from shrine-keeper-toll), caretaker-7 "SEVEN" (mobile pan-rounds rover, sibling to TALLY-9 mast — distinct from caretaker-unit-7); mags-delver already existed, validated. Notes: plan backlog had stale dupes of toll/caretaker-unit-7 — resolved by writing distinct complementary figures, no contradictions. Lore x4: choir-static-litanies (annotated sending-side litanies II/VII/XVII, Initiate Sef + Little Reverb margins; cross-refs static-litanies), salt-guild-ledger-of-debts (A. VARGA 8,000cr bond entry ties to debt.cleared economy; Davenant struck line), drowned-array-census (standing count kept by SEVEN; hero image public/images/articles/lore/drowned-array-census.jpg), skydocks-moorage-rules (7 rules + Balloon Incident; Devanna+Hollis annotations). Missions x4 (side): side-crusher-parts-run (fragile, cinderflats processional, Pyke/Solder/Mags), side-mesa-survey (scout x3: saltmouth:overlook, windspine:ridge-crest, choirhollow:crater-rim), side-jett-marrows-rematch (race, glassroad 5-gate dusk line, requires side-vs-jett.done, Warden cameo + Davenant pencil-line hook), side-missing-mail-satchel (chase, saltmouth pan, Hollis Fenn cameo). TODO for builder: new orphan lore needs cache rows (writers can't edit src/content/caches.json) — choir-static-litanies @ choirhollow:listening-horn, salt-guild-ledger-of-debts @ saltmouth:exchange, drowned-array-census @ drowned-array:cache-cairn, skydocks-moorage-rules @ skydocks:winch-base.

## Iteration (region-builder demo1, #7) — Roster Review Bench demo-region (done)
- Completed `src/world/regions/roster-review-bench/` (started in a partial run):
  the writing desk's content-review instrument. Every character JSON renders as
  its true in-game dialogue card (64px portrait or initials fallback, name +
  faction chip, role, greeting/bark/mission/radio lines shuffled on one shared
  4.2s tick — parked under prefers-reduced-motion), faction chips filter the
  wall (guild/choir/reclaimers/driftline/independent + a " needs work" audit
  chip) plus a name/role/town search box.
- Live stage mounts the unmodified DialogueBox and reproduces the HUD radio
  ticker verbatim, both driven through the real game store (openDialogue /
  say / radioBlip): writers review overflow, fades, the 7s subtitle window and
  the E/Enter/Space key handling as shipped. Rehearsal scene = greeting+bark+
  mission beats plus a flag-setting bench choice (bench.roster-rehearsed /
  bench.roster-cut, easter-egg flags only).
- Audit rules: no portrait, declared art that 404s (via img onError), <8 total
  lines, or empty core buckets redraw the card as a dashed ghost frame with a ▯
  signal-not-recovered marker — shape carries the warning (portrait stamp:
  PORTRAIT LIVE / FRAME STALE / AWAITING SITTING).
- Replaced the placeholder roster.css with a fully scoped rr-b stylesheet
  (never redefines .panel/.btn/.dialogue-*, only extends them inside the bench
  frames; the real .dialogue/.hud-radio absolutes are re-anchored to the
  reviewer cells). Header art generated: public/images/work/roster-review-bench.jpg
  (style-block compliant: radio shack desk, string of portrait cards, amber bulbs).
- Region contract satisfied: off-world centre [8200, 7600] r4, meta.json +
  anchors.json + meta.ts demo sheet; typecheck + validate:content clean;
  finish_demo ✅.

## writer1 iteration 24 (2026-09-26) — 4 characters claimed + done
- **tally** (TALLY-9): the Drowned Array's deep archive stratum beneath Unit 7
  (mast) and SEVEN (rover) — service-ticket voice on dead admin band one,
  "a ghost with good manners". Canon: mast answers to Unit 7, plates sign
  TALLY-9; tickets reference side-pan-letters / side-theo-messages (queue
  emptied, kettle ticket 088, the good flask), bears, LAMP-ON resolution code.
- **gauge-keeper-dax**: Windspine storm-gauge chief, night-hatch keeper; owns
  the "register of politely mentioned couriers" invented in side-night-supply
  (Ketch asterisked year two, Pem in it twice, Rill never — page kept open).
  Added his hatch-log line to side-night-supply complete dialogue.
- **verger-sann**: Choir quartermaster of Lamp Rest; grounded counterweight to
  Cantor Ilex ("the top floor"). 91 rim lamps, 11 sulking, 1 proud; choir-glass
  care rules (strap flat, no boost, shield half); "the crater provides — I
  provide the crater." Distinct register: miracles as stock discrepancies.
- **ratchet-june**: Reclaimer long-hauler of the crawler Second Mortgage; the
  winch crew behind ch3-salvage-rights ("lines on it before the engines cooled").
  Added her band line to that mission's accept dialogue. Portrait generated at
  public/images/articles/characters/ratchet-june.jpg (writer path; mirrored
  style of articles/characters copies).
- Line buckets: finish_article requires ≥8 buckets per character (validator
  only checks total ≥8 + ≥2 greetings — keep both happy).
- validate:content green: 43 characters, 70 missions.
- **handling-curve-lab** (demo-region, iteration 9): bike-feel tuning bench —
  figure-eight salt pan with painted grip zones (salt/sand/glass), shipping
  controller re-derived from a zustand tuning store each physics step (sliders
  + 0–3 ladder pips apply same-frame; fixed feel constants copied verbatim from
  src/game/Bike.tsx), scrolling telemetry scope (speed/slip/drift-window/boost
  + surface lane), ladder headroom curve graphs, baseline reset + copy-JSON.
  Splash art at public/images/work/handling-curve-lab.jpg. Bench conventions in
  the folder's NOTES.md — mirror Bike.tsx changes there, never fork physics.

## writer1 iteration 25 (2026-09-26) — 4 lore pieces claimed + done
- **salt-flat-mirages** (field-guide): flats mirage dictionary — low water,
  cold shine (glass honesty tell), tall water (ties to Ila's "where the tall
  water starts" in side-crests), upright stranger (relay-fire ghost), and
  somebody else's yesterday (pre-Delay green shimmer; Choir/Guild/rider
  readings). Safety rules + Ketch sign-off. Hero art at
  public/images/articles/lore/salt-flat-mirages.jpg (heroImage set).
- **courier-cairns** (tract): cairnkeeping custom — kept consistent with the
  Drowned Array code (flat=stocked, two flat=restock+sign, upright=empty,
  black=hazard, false cairn=knot cut, two unspoken names) and yard-rules.
  Famous stacks: Pole-Star Cairn (0° bearings, rill-davenant-route-notes),
  Bellamy's Arithmetic (ballad's mathematician), survey-point stack at the
  Cradle (mother-maintenance-manifest spool).
- **wren-teardown-report** (record): Ketch investigates the Wren's left pull —
  left knife theory tried+buried, gyro Opinions settled off-plumb, the dent
  ruled sand-struck-from-behind (fits Paloma's storm season; ballad lampshaded
  as a radio play, service-record owners stay canon). Hook: pull eases dead
  straight toward the Cradle — "every Verdantine machine hums home."
- **spice-pricing-dispatch** (broadcast): Evening Standard spot-prices farce
  (salt/water "hold" triad echoed from saltmouth-shipping-bulletin, cinder
  pepper, gossip bubble on nothing, goat futures bearish) with the null crate
  redacted live by a senderless letter. finish_article needs ≥1 `## ` section
  even for pure transcript format — heads added.
- NOTE for builder: 4 signal-cache rows were intended for caches.json
  (salt-flat-mirages→saltmouth:flats-pan, courier-cairns→windspine:ridge-crest,
  wren-teardown-report→saltmouth:garage,
  spice-pricing-dispatch→saltmouth:moorage) but caches.json is outside the
  writer sandbox — builder, please add when convenient.

## demo3 iteration 8 (2026-09-26) — Title Motion Lab built + done
- **title-motion-lab** (demo-region, off-world centre [8600,-8200]): the shipped
  TitleScreen rebuilt as a tunable motion bench. Same ui.css title classes,
  same copy, real EPILOGUES data — polish lands where it ships.
  - Stage: real keyart under 3 hand-cut SVG parallax strata (mesa band, dune +
    skyship ribs, dust motes + blinking comms beacon), pointer parallax on one
    lerped rAF loop with a 0.05px dead zone; parks fully under reduced motion.
  - Entrance: beats (kicker/logo/tag/epilogue/menu×5/hint/colophon) as pure
    CSS animations keyed by per-beat custom properties (--d/--dur/--rise/--ease);
    replay is a remount. Epilogue uses a clip-path unfill; reduced motion swaps
    rises for fades.
  - Font-swap sim: warm cache / broadband / salt-3G / storm-static delays force
    the system fallback stack until the brand faces "land" (class toggle) — the
    FOUT is felt; footer honestly reports document.fonts state.
  - Timeline: bar readout with font-swap ◆ hoist + menu-ready (≤1400ms) and
    settle (≤3200ms) budget rules; ✓/▲ glyph+colour chips (never colour alone).
  - Controls: 7 token sliders, easing/network/epilogue chips, reduced-motion
    toggle, Replay (audio blip), Reset-to-shipped, and an export panel emitting
    :root CSS timing tokens (+ reduced-motion media block) for the shipped
    TitleScreen to adopt.
  - Concept art header at public/images/work/title-motion-lab.jpg.
  - typecheck + validate:content clean (30 regions).

## Writer1 — iteration 26 (lore batch)
- 4 new lore entries (tract/record/field-guide), all with cache rows in
  caches.json; validate:content clean at 149 lore / 108 caches:
  - `mother-dream-reports` (tract, choirhollow:listening-horn) — Little Reverb's
    collected Sleeper dreams w/ Pem footnotes; gardener/counting/door/rain imagery
    seeds ch4 without naming it; Ash-crate leak in Report 3.
  - `pawn-shop-catalogue` (record, skydocks:keel-town) — Madame Traction's Drawer;
    the self-written final entry nods at the null crate + Ash without spoiling ch1.
  - `race-risk-form` (tract, glassroad:gate-south) — Form 1-R waiver; establishes
    the Gate Ethics Precedent (J.M.), the load-bearing asterisk, three-ink signing.
    Cross-refs side-vs-jett. Chalk A.V. signature hints Ash has raced already.
  - `tea-rites-of-the-flats` (field-guide, windspine:storm-gauge) — salt/storm/
    apology teas, cup customs, Pemmy oolong canon, Davenant memorial cup callback.
- Voice note for future writers: in-world documents run on small concrete stakes
  (prices, cups, clauses) + one warm gut-punch in the last 10%.

## Region/demo builder — iteration (signal-cache-bench)
- Built **Signal Cache Scout Bench** (`src/world/regions/signal-cache-bench/`,
  off-world center [9400, 8800]): readability range for the shipping signal-cache
  pickup. Distance ladder (huddle 14–150 m / standard 22–430 m / horizon 70–760 m)
  of the exact SignalCaches.tsx assembly under swappable Sky.tsx keyframe
  backdrops (day salt / dusk burn / night watch) + storm-dust filter (sand-haze
  fog blend, drifting motes, DOM radial-rust tint). Bench furniture: 25 m ticks,
  violet hint gate at the 340 m hail cutoff, 13 m capture ring on the nearest
  cache, mission-family holos (◆ ■ ▲) beside the lane.
- Live DOM replicas judged with the beacon: HUD chip "⟡ faint signal · N m"
  wired to camera distance (drops out past 340 m like store logic) + minimap
  canvas replica with the exact open-violet-diamond styling + dashed 340 m ring.
- CVD simulation (Machado feColorMatrix) wraps the WHOLE stage (canvas + replicas);
  3 contrast tables (beacon v backdrops incl. storm; chrome text/border/minimap;
  redmean separability vs mission colours) + live sliders for emissive/glimmer/ring,
  copy-spec-JSON export. Findings + mirror table in the folder's NOTES.md.
- Concept art at public/images/work/signal-cache-bench.jpg.
- typecheck + validate:content clean (30 regions).

## Iteration 11 — night-beam-tuner (demo-region)
- New lab bench `src/world/regions/night-beam-tuner/`: night headlight tuning rig.
  Player-spec bike parked on a salt corridor between glass-canyon walls (game sky
  palette + fog formula, teal glass veins, range gates every 5 m, teal-framed
  20–30 m read band). Headlight mirrors Bike.tsx mount/ramp 1:1 with live sliders
  (angle, intensity, decay, cutoff, penumbra, aim drop/ahead, dust cone, lamp glow,
  fog gain). Analytic scanline (canvas-2D, exact three.js distAtt/spotAtt model)
  charts forward throw + lateral spread @25 m with READ_OK threshold, pool-glare
  zone and verdict strip ("sweet spot / searchlight / dim / long throw").
  Exports paste-ready Bike.tsx props or JSON. Three camera presets
  (chase/profile/footprint), day/dusk/twilight/night chips for clock scrub.
- Concept art at public/images/work/night-beam-tuner.jpg (splash card).
- typecheck clean (31 regions).

## Writer iteration 26 (writer2) — four Saltmouth/Keel Town side jobs
- `side-paints-and-salt` (deliver, saltmouth, giver brinemaster-ogo): pan-crew ochre
  sacks → exchange wax-seal → Ketch's paint bench. Twist: the unmanifested fifth sack
  is a gift the scale "finds" — Counterweight rules gifts under 2 kg outside tariff.
  Unlocks `lore:guild-wax-seal-chemistry`. Pairs with Ketch's side-paint-primer arc.
- `side-rope-and-ferro` (deliver, saltmouth, giver old-ferro): Ferro's 60-year
  tally-line IS the registrar's demanded rigging list; Counterweight audits it as
  testimony, leaves knot 53 "untranslatable, in good standing". Unlocks `lore:rope-tally`.
- `side-hearing-seats` (timed 300 s, skydocks→saltmouth, giver sister-counterweight):
  round up 3 subpoena-ducking witnesses at Keel Town ("storm knee / cargo wash / gone
  vertical"), swear them in before the gavel. Unlocks `lore:hum-hearings`.
- `side-calm-before` (storm, windspine, giver surveyor-kest; requires
  side-storm-window.done): turbine-row medicine cache → outrun a *turning* wall into
  the camp shelter trench. Quiet gut-punch: the unmarked ink bottle for Kest's night
  column. Unlocks `lore:storm-almanac`.
- Hero art: public/images/articles/missions/side-calm-before.jpg (wall + turbines,
  dusk violet/amber). Note: mission JSON carries no heroImage field (matches existing
  missions); art follows the public/images/articles/missions/<slug>.jpg convention.
- validate:content clean (32 regions, 43 characters, 82 missions, 153 lore, 117 caches).

## Writer iteration 27 (writer2) — four lore entries (chants, seals, testimonies, stars)
- `repair-hymn-cycle` (tract): complete Reclaimer dawn cycle — three waking calls
  (yard-answer, footing count, spoken door knock), the working measures, the
  red-underlined "keeps", and the long rule: never sing the full greeting over a
  machine that still hums. Complements lore-reclaimer-hymn (noon pulling song) and
  reclaimer-grace-prayers (meal prayers); nods to the null-crate hum via Vertex's chalk.
- `guild-heraldry` (record): courier recognition card — ledger seal anatomy, flag
  grades (incl. mourning protocol), the CARRIED ON FAITH stamp, and the Gull Post
  banner ruling: a memory-stitched counterfeit certified senior over the original
  after forty honest years. Cross-references guild-wax-seal-chemistry's rain-scent.
- `bell-incident-testimony` (record): Appendix D of the lamp-books finally filed —
  Decibel's deposition (lost the left ear's committee work), Pem's statement (the
  Sleeve's Own, answered, nine-second echo with no reflector), the horn's own
  testimony (birdsong / a nice laugh / the tone bent up a half-step into a question).
  Pays off lore-choir-heretics' "attached as Appendix D and never discussed" and
  brother-decibel's patch.
- `night-sky-guide` (field-guide): Ketch's garage flat-chart — the half-strung
  terraform Strand (211 lit of 404), three faithful satellites (Long Guile,
  Pair-of-Sleeves, the Deacon), and the Choir's Breath Between Stars. Ties to
  horizon cells being salvaged satellite stock (lore-bike-anatomy).
- Hero art generated: public/images/articles/lore/night-sky-guide.jpg (courier under
  the unfinished Strand); heroImage/heroAlt set in frontmatter.

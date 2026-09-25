# BRIEF — DRIFTLINE

You are building, over a long unattended run, **DRIFTLINE**: a 3D open-world hover-bike courier
adventure, playable in the browser. Full creative control within this brief. The brief never changes;
your notes in `.ralph/` record how you execute it. Every iteration should leave the game **more fun,
more beautiful and still playable** — a working game at every commit beats an ambitious broken one.

## The pitch

> Kessa-9 was half-terraformed when the money ran out. Two centuries later, the survivors live in
> scattered settlements across the **Glass Desert** — salt flats, canyons fused to glass by old
> reactor burns, wind-farm ridges, skyship docks moored to mesas. Nothing moves between them except
> the couriers of the **Driftline**. You are **Ash Varga**, a new Driftline courier with a
> second-hand hover-bike, a debt, and — as of chapter one — a package that shouldn't exist.

Story in five chapters (you write it; keep it coherent in `.ralph/STORY.md`):
1. **First Run** — learn the bike and the trade in the hub town of **Saltmouth**; deliver the sealed
   "null crate" that nobody admits sending.
2. **The Glass Road** — the crate hums; factions start asking for it. The **Salt Guild** (traders),
   the **Choir** (a cult that worships the dormant terraforming AI "MOTHER") and the **Reclaimers**
   (scavengers stripping the old infrastructure) all want different things.
3. **Storm Season** — sandstorms close routes; alliances shift; a courier goes missing.
4. **Mother's Voice** — the crate is a key; MOTHER is waking; the desert itself begins to change.
5. **Last Delivery** — a final run with a choice that decides Kessa-9's future (at least two endings).

Tone: warm, weathered, hopeful; frontier-western meets solarpunk; humour in the dialogue.
All characters, factions and places are original and fictional.

## Gameplay (build it in this order of priority)

1. **The bike** — arcade hover physics that feel *great*: hover height with spring damping over
   terrain, boost (with a meter), drift/slide with a boost-on-exit reward, jump/hop, air control,
   collisions that bump rather than kill, a chase camera with speed FOV and subtle shake. Keyboard +
   mouse (WASD/arrows, Space hop, Shift boost), gamepad, and basic touch controls.
2. **The world** — a large procedural desert (heightfield from noise, dunes, salt flats, canyons),
   sky with a day/night cycle, fog/dust, and **regions** streamed in from `src/world/regions/<slug>/`
   (built by region builders; each exports metadata + anchors). Saltmouth is the hub.
3. **Missions** — a data-driven mission system loading `src/content/missions/*.json`: mission board at
   hubs, accept/track/complete/fail, waypoints + compass + minimap, objective types at least:
   `deliver` (A→B), `timed`, `fragile` (damage penalty), `escort`, `chase` (catch a target),
   `race` (checkpoints), `collect` (N items), `scout` (reach viewpoints), `storm` (outrun a storm).
   Rewards: credits, reputation per faction, upgrades, story flags that gate later missions.
4. **Dialogue & characters** — `src/content/characters/*.json`: portraits (generated illustrated art),
   voice/tone notes, line sets; a dialogue UI with choices that set flags; radio chatter while riding.
5. **Progression** — credits economy, garage upgrades (engine, handling, boost, cargo shield,
   paint), faction reputation, save/load (localStorage, versioned), a codex that unlocks
   `src/content/lore/*.md` entries as you discover them.
6. **Feel & polish** — title screen with key art, pause/settings (audio, graphics quality, controls,
   invert, accessibility: reduced camera shake, colour-blind-safe markers, subtitles always on),
   procedural WebAudio SFX (engine pitch follows speed, wind, boost, UI blips) and ambient music,
   particles (dust trails, sparks), post-processing tuned for performance, achievements, credits with
   the colophon: "DRIFTLINE was designed and built autonomously by Kimi K3 running on GreenThread."

## Content schemas (define them in code + `.ralph/ROUTES.md` on the first iteration)

The harness validates the basics; your `npm run validate:content` validates the rest (types,
references to regions/anchors/characters, chapter gating). Minimums the harness checks:
- **Mission** `src/content/missions/<id>.json`: `id, title, chapter (1–5 or "side"), type, giver
  (character id), region (region slug), summary, objectives (≥2, each with a type and target
  anchors), rewards, dialogue` (+ optional `requires`/`sets` story flags, `timeLimit`, `cargo`).
  Target 60: 6 story missions per chapter (30) + 30 side jobs.
- **Character** `src/content/characters/<id>.json`: `id, name, role, faction, home, bio, appearance,
  voice, lines (≥8: greetings, barks, mission lines, radio chatter)`, optional `portrait`.
  Target 32.
- **Lore** `src/content/lore/<slug>.md`: frontmatter `title, slug, cluster: lore, category, summary`,
  250+ words of in-world writing (logs, broadcasts, field guides, faction tracts, machine records).
  Target 120.

## Technical requirements

- **React + TypeScript + Vite**, **React Three Fiber**, `@react-three/drei`, **`@react-three/rapier`**
  for physics, `zustand` for game state, optional `@react-three/postprocessing`. HUD and menus are
  React DOM overlays. No server — a static web game.
- **Deployed to GitHub Pages at `/driftline/`**: support `BASE_PATH` (default `/`) via Vite `base`,
  and load every asset through a `withBase()` helper. The harness has added
  `.github/workflows/pages.yml`; keep it working. Emit `.nojekyll`.
- **Performance budget**: 60 fps on a mid laptop at "medium"; quality presets; instancing and merged
  geometry; stream/lazy-load regions; no per-frame allocations in hot paths.
- **`npm run build` must pass at the end of every builder iteration**, and **use the `playtest` tool**
  after building whenever you change gameplay, rendering or UI: fix console errors, blank scenes and
  unresponsive input before anything else. Provide `npm run typecheck` and `npm run validate:content`.
- Keep the game playable from a fresh load at every commit: title → play → ride → take a mission.

## Art direction

Stylised low-poly, flat or softly shaded, big readable silhouettes; sun-bleached palettes by day
(salt white, rust, teal glass, ochre), violet and neon-amber by night; dust, heat haze, long shadows.
Record the art direction in `.ralph/DESIGN.md` and keep it consistent across regions. Use
`generate_image` for key art (title screen), loading screens, character portraits (illustrated,
not photoreal) and region concept art — no text or logos in images.

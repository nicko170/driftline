# DRIFTLINE — Routes, Content Schemas & Pipelines

Deployed at GitHub Pages under `/driftline/` (workflow sets `BASE_PATH=/driftline/`,
`SITE_URL=https://nicko170.github.io/driftline`). Locally `BASE_PATH` defaults to `/`.
**Every asset URL goes through `withBase()`** (`src/lib/base.ts`). Router basename = BASE_PATH.

## Routes (React Router)

| path | component | notes |
| --- | --- | --- |
| `/` | TitleScreen | key art, menu (Play / Codex / Logbook / Lab / Settings / Credits) |
| `/play` | GameScreen | the game: R3F canvas + React DOM HUD overlays; boots through the **DepartureScreen** manifest (engine/routes/lamps stamps — see `.ralph/DESIGN.md`), clears on any key or 1.4s after clearance |
| `/codex` | CodexScreen | recovered lore entries (`src/content/lore/*.md`) |
| `/logbook` | LogbookScreen | lifetime ride stats + achievement ledger (persistent save data) |
| `/credits` | CreditsScreen | colophon incl. "designed and built autonomously by Kimi K3 running on GreenThread" |
| `/lab` | LabIndex | auto-discovers demos from `src/lab/*/index.tsx` AND demo-regions (see below) |
| `/lab/:slug` | LabDemo | renders one demo in a shell, wrapped in an error boundary |

SPA fallback: Pages serves `404.html` — we copy `index.html` to `404.html` in `postbuild`.
`.nojekyll` is emitted from `public/`.

**Dev/QA flags**: `?skyt=<0..1>` or `#skyt=<t>` pins the sky clock start (day/night
playtesting; 0.99 ≈ deep night). Captured into `sessionStorage.dev.skyt` at bootstrap
(`src/main.tsx`) because SPA navigation (title → `/play`) drops query/hash before the
game modules initialise. The playtest harness strips query strings from `path` — pass
the flag in the **hash**: `path: '/#skyt=0.99'`.

## Labs / demos (dual-source discovery)

Demos can live in **two places** — both are picked up automatically by `/lab`:
1. `src/lab/<slug>/index.tsx` (classic): default-exports a component, optional named
   `meta = { title, blurb, tags }`.
2. **Demo-regions** `src/world/regions/<slug>/index.tsx`: a React component default export
   that *also* satisfies the region contract (meta.json + anchors.json for a harmless
   off-world centre, attached as statics `mod.meta`/`mod.anchors`) and re-exports a named
   `meta` with a `title` — that's what makes the Lab list it. Pure world regions (no named
   `meta` export with a title) are never listed as demos.
The registry (`src/world/registry.ts`) eager-globs only meta.json/anchors.json;
index.tsx is lazy (see "Region contract" below), so demo-region folders compile-check
but never weigh down the `/play` chunk. `npm run validate:content` skips region folders
that have no meta.json yet (mid-flight parallel builds) with a warning instead of failing.

## Content pipeline

- Missions: `src/content/missions/<id>.json` — glob-eager imported by `src/missions/library.ts`.
- Characters: `src/content/characters/<id>.json` — glob-eager imported by `src/dialogue/library.ts`.
- Lore: `src/content/lore/<slug>.md` — glob-raw imported by `src/codex/library.ts`, frontmatter parsed in `src/lib/frontmatter.ts`.
- Signal caches: `src/content/caches.json` — lore recovery pickups in the world (see "Exploration" below).
- Codex bodies render through the markdown-lite renderer `src/lib/markdown.tsx` (`## ` → h3, `*em*`, `**strong**`).
- `npm run validate:content` → `scripts/validate-content.mjs` (plain node, no deps) checks all schemas + cross-references (regions, anchors, characters, flags, chapter gating). Must pass for build to be considered healthy.

## Region contract — `src/world/regions/<slug>/`

```
meta.json      { "slug", "name", "blurb", "center": [x, z], "radius", "danger": 0-3,
                 "climate"?: { "fogDensity"?, "skyTint"?, "groundTint"? } }
anchors.json   { "<anchorId>": { "pos": [x, z], "label": "...", "elev"?: number } }
index.tsx      default export: { meta, anchors, Props?: R3F component, colliders?: Box[] }
```

One shared world heightfield covers the whole map (2400×2400 m); regions are zones with
named anchors + streamed props. Anchor references use `"<regionSlug>:<anchorId>"`.
Ground anchors' Y resolves from the terrain function (`elev` overrides for docks/towers).
Registry: `src/world/registry.ts`. Colliders are fixed AABBs the bike bumps off.

**Region loading model (iteration 6):** `meta.json` + `anchors.json` are glob-eager
(anchors feed missions/caches/HUD/Sky at boot); `index.tsx` is glob-**lazy** —
`loadRegion(slug)` merges `Props`/`colliders`/`propsCull` into the REGIONS entry and
bumps `regionVersion` (subscribe via `subscribeRegions()`/`useSyncExternalStore`).
GameScreen calls `ensureOnWorldRegions()` at mount; RegionStream preloads anything
within radius×cull×1.6. Bench/off-world regions (centre beyond ±1800 m, or listed in
the registry's `GAMEPLAY_EXCLUDED` — currently `hover-playground`, a demo parked
on-world) are never loaded by gameplay; the Lab imports them via its own lazy glob.

## Mission schema — `src/content/missions/<id>.json`

```jsonc
{
  "id": "ch1-first-run",                  // unique, matches filename
  "title": "First Run",
  "chapter": 1,                            // 1-5 or "side"
  "type": "deliver",                       // deliver|timed|fragile|escort|chase|race|collect|scout|storm
  "giver": "tamsin-cho",                   // character id
  "region": "saltmouth",                   // home region slug
  "summary": "...",                        // 1-3 sentences for the job board
  "requires": { "flags": ["ch1-first-run.done"], "rep": { "guild": 10 } },  // optional gate
  "objectives": [                          // >= 2, executed in order
    { "type": "pickup",   "target": "saltmouth:job-board", "label": "Pick up the parcel" },
    { "type": "dropoff",  "target": "saltmouth:garage",    "label": "Deliver to Ketch" }
  ],
  "rewards": {
    "credits": 120,
    "rep": { "guild": 5 },                 // optional
    "upgrades": [],                        // optional upgrade ids
    "flags": ["ch1-first-run.done", "lore:salt-guild-charter"]  // lore:<slug> unlocks codex
  },
  "dialogue": {
    "offer":    [{ "who": "tamsin-cho", "text": "..." }],
    "accept":   [{ "who": "tamsin-cho", "text": "..." }],
    "complete": [{ "who": "tamsin-cho", "text": "..." }],
    "choices":  []                          // optional: {prompt, options:[{text, setsFlag}]}
  },
  "timeLimit": 90,                          // optional seconds (timed/race/storm)
  "cargo": { "fragile": true, "label": "null crate" }  // optional (fragile)
}
```

### Objective runtime semantics (MissionDirector)

| objective type | `target` | `targets` | runtime |
| --- | --- | --- | --- |
| `pickup`/`dropoff`/`deliver`/`goto` | anchor | — | reach the anchor under **SLOW** (20 km/h-ish) — HUD shows a SLOWER hint inside the radius |
| `collect` | anchor | — | `count` (≥2) pickups spawn scattered 6–28m around the anchor |
| `race` | — | ≥3 checkpoints | pass the torus gates in order |
| `scout` | anchor | — | get inside 26m, hold ≤7 km/h to scan for 3.2s (HUD progress) |
| `escort` | NPC spawn (opt) | ≥2 route anchors | hover-wagon crawls the route at `speed` (def 13 m/s); stay within 95m or fail after a 10s grace ("RETURN TO CONVOY") |
| `chase` | NPC spawn (opt) | ≥2 route anchors | skiff ping-pongs the route at `speed` (def 21 m/s, rubber-banded); get within 15m to catch |
| `storm` | shelter anchor | — | a sand wall spawns 460m behind you and hunts you at 23–32 m/s with fog/wind/screen tint; reach the shelter (no slow gate) before the face crosses you |

Fragile cargo: `cargo.fragile` starts a cargo-integrity bar (HUD); collisions above the
shield soak damage it; at 0% the run fails; payout scales `0.35 + 0.65 × integrity`.
Failed runs show a retry banner (`missionFailed { id, reason }` → "Retry the run").
Chapter progression is derived: a chapter completes when all its content-present story
missions are done (`src/missions/chapters.ts`); `save.chaptersSeen` gates the intro cards.

## Character schema — `src/content/characters/<id>.json`

```jsonc
{
  "id": "tamsin-cho",
  "name": "Tamsin Cho",
  "role": "Salt Guild factor",
  "faction": "guild",                      // guild|choir|reclaimers|driftline|independent
  "home": "saltmouth",                     // region slug
  "bio": "2-4 sentences.",
  "appearance": "one-paragraph visual for portrait prompts",
  "voice": "tone notes, catchphrases, insults of endearment",
  "portrait": "images/characters/tamsin-cho.jpg",   // optional, withBase()-able
  "lines": {                                // >= 8 lines total across buckets
    "greetings": ["...", "..."],
    "barks": ["..."],
    "mission": ["..."],
    "radio": ["..."]
  }
}
```

## Lore schema — `src/content/lore/<slug>.md`

Frontmatter (YAML-lite, parsed by `src/lib/frontmatter.ts`):
```
---
title: "..."
slug: "..."        # matches filename
cluster: "lore"    # literal
category: "field-guide | broadcast | tract | log | record"
summary: "1-2 sentences"
---
```
Body ≥ 250 words, in-world voice. **Unlock (only two paths exist)**: mission reward
flag `lore:<slug>` (`store.ts:134/142` — there is no `rewards.lore` key) or a signal
cache row in `src/content/caches.json` (builder-owned file). Endings/achievements grant
none. Builders: re-run the orphan audit each iteration —
`lore dir − (cache lore ∪ mission lore: flags)` — and add cache rows for the orphans.

## Progression systems (iteration 3)

- **Ride stats** — persisted `save.stats` (RideStats in `src/state/store.ts`): distanceM,
  topSpeedKmh, jumps, driftTimeS, bestDriftS, boostsUsed, stormsOutrun, missionsDone,
  airTimeS, biggestAirS. The physics loop accumulates into the mutable `ride` pending
  bucket in `src/game/rideStats.ts` and calls `flushRideStats()` every ~2s (Bike useFrame)
  and on mission completion — no per-frame zustand churn.
- **Achievements** — `src/game/achievements.ts` defines ACHIEVEMENTS (24 defs) with a
  `test(stats, save)` predicate; `evaluateAchievements()` runs after every stats flush,
  on mission completion and on GameScreen mount. New unlocks persist to
  `save.achievements`, chime, and queue a toast (`game.toasts`) shown by `AchToasts` in
  the HUD (4.8s, click to dismiss). Hidden defs (story endings) show as static until unlocked.
- **Logbook** — `/logbook` renders the stats panel + the full achievement grid.
- **Ambient traffic** — `src/game/AmbientTraffic.tsx`: 6 NPC vehicles (2 couriers, 2 guild
  haulers, 2 choir skiffs) cruise fixed polyline loops between settlements, hovering over
  the analytic terrain with bob + banked turns. Visual-only (no colliders); ~6 groups.

## Economy & story beats (iteration 4)

- **Guild exchange + debt** — third interaction spot (`saltmouth:exchange`, E to open,
  mode `'exchange'`). `save.payDebt(amount)` moves credits → debt (clamped, floored,
  returns actually paid). Clearing the 8,000 cr bond sets flag `debt.cleared`, grants
  +12 guild rep, barks tamsin-cho then ketch on the radio, fires the `clean-ledger`
  achievement, and unlocks the Guild Gold paint (`#FFC969`) at the garage
  (`src/ui/ExchangePanel.tsx`, `src/ui/GaragePanel.tsx`).
- **Chapter outros** — `CHAPTERS[n].outro` (`src/missions/chapters.ts`) is the debrief
  text. When a chapter's last story mission completes, MissionDirector sets
  `game.chapterOutro`; `ChapterOutroCard` shows it once `mode==='riding'` and no intro
  card is pending, tracks `save.outrosSeen` (persist, save version 3 — migrate backfills),
  dismisses with E/Enter/Esc.
- **Endings** — `src/missions/endings.ts`: EPILOGUES for `ending.rain` / `ending.quiet`.
  Content (ch5 missions/dialogue) sets the flag; TitleScreen shows the epilogue panel and
  CreditsScreen prints the stanza when a flag is present. Achievements `ending-rain` /
  `ending-quiet` fire on the flag.
- **Region climate blending** — Sky lerps fog colour/density, horizon tint and hemisphere
  ground tint toward a region's `meta.climate` (`fogDensity`, `skyTint`, `groundTint`) by
  proximity (squared falloff over radius+140 m skirt, ≤0.6 per zone, ≤1 total). Regions
  with centres beyond ±1800 m (lab benches) are ignored. Writers/region builders can set
  climate freely in meta.json.

## Exploration: signal caches — `src/content/caches.json` (iteration 5)

```jsonc
{ "caches": [ { "id": "cache-auditor-memos", "lore": "auditor-memos", "anchor": "saltmouth:exchange" } ] }
```

Derelict data obelisks: riding within 13 m (while riding) recovers the lore
entry (`lore:<slug>` flag → codex) and pays +15 cr. `lore` must match an
existing codex file; `anchor` is `<regionSlug>:<anchorId>` on a real (on-world)
region. Several caches on one anchor fan out automatically. Collected state is
derived from `save.codex` — no save fields. Editors adding orphan lore (not
mission-rewarded, not starter-unlocked) should add a cache row; the validator
checks slugs/anchors/uniqueness.

## Demo contract — `src/lab/<slug>/index.tsx`

Default-exports a React component; optional named export `meta = { title, blurb, tags }`.
Auto-listed at `/lab`. Demo builders only touch their own folder. **Demo-regions** are the
same but live in `src/world/regions/<slug>/` (see "Labs / demos" above). The Lab wraps each
demo in an error boundary so a broken bench never crashes the app.

## Scripts

`npm run dev` · `npm run build` · `npm run preview` · `npm run typecheck` ·
`npm run validate:content` · `npm run check` (typecheck + validate).

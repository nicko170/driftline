# DRIFTLINE — Routes, Content Schemas & Pipelines

Deployed at GitHub Pages under `/driftline/` (workflow sets `BASE_PATH=/driftline/`,
`SITE_URL=https://nicko170.github.io/driftline`). Locally `BASE_PATH` defaults to `/`.
**Every asset URL goes through `withBase()`** (`src/lib/base.ts`). Router basename = BASE_PATH.

## Routes (React Router)

| path | component | notes |
| --- | --- | --- |
| `/` | TitleScreen | key art, menu (Play / Codex / Lab / Settings / Credits) |
| `/play` | GameScreen | the game: R3F canvas + React DOM HUD overlays |
| `/codex` | CodexScreen | recovered lore entries (`src/content/lore/*.md`) |
| `/credits` | CreditsScreen | colophon incl. "designed and built autonomously by Kimi K3 running on GreenThread" |
| `/lab` | LabIndex | auto-discovers demos from `src/lab/*/index.tsx` (import.meta.glob) |
| `/lab/:slug` | LabDemo | renders one demo in a shell |

SPA fallback: Pages serves `404.html` — we copy `index.html` to `404.html` in `postbuild`.
`.nojekyll` is emitted from `public/`.

## Content pipeline

- Missions: `src/content/missions/<id>.json` — glob-eager imported by `src/missions/library.ts`.
- Characters: `src/content/characters/<id>.json` — glob-eager imported by `src/dialogue/library.ts`.
- Lore: `src/content/lore/<slug>.md` — glob-raw imported by `src/codex/library.ts`, frontmatter parsed in `src/lib/frontmatter.ts`.
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

Objective runtime types implemented so far: `pickup`, `dropoff`, `goto`, `collect`
(spawns `count` items near anchor), `race` (checkpoint list via `targets` array). Others
(`escort`, `chase`, `scout`, `storm`) validate at schema level; runtime lands in later iterations.

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
Body ≥ 250 words, in-world voice. Unlock: mission reward flag `lore:<slug>`.

## Demo contract — `src/lab/<slug>/index.tsx`

Default-exports a React component; optional named export `meta = { title, blurb, tags }`.
Auto-listed at `/lab`. Demo builders only touch their own folder.

## Scripts

`npm run dev` · `npm run build` · `npm run preview` · `npm run typecheck` ·
`npm run validate:content` · `npm run check` (typecheck + validate).

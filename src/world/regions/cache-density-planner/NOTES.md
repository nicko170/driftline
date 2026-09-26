# Cache Density & Fan-Out Planner — builder notes

Demo-region (off-world bench, centre [9200, 7600]). Built iteration 11.

## What it does

- Replays `src/game/caches.ts` fan-out exactly (`ang = k·2.399963`, `r = 5 + k·2.2`,
  first cache on-anchor) over the raw `content/caches.json` rows; a header parity
  badge diffs against the shipped `SIGNAL_CACHES` positions (max drift, skipped
  ids) so the sheet breaks red if the game's resolver ever changes silently.
- One SVG sheet in true metres: salt paper, 200 m graticule, marching-squares
  contours of the real shared `terrainHeight` (104×104 grid, 7 levels, saddles
  resolved by cell-centre average), region discs in faction colours, teal
  nearest-neighbour threads between anchors, brown survey crosses per anchor.
- Caches are open violet diamonds inside TRUE 13 m capture discs; diamonds are
  scaled by view width so they stay clickable at world zoom (discs stay honest).
- Crowding pips shape-first: ▲ amber past 6, ■ red past 10 (DESIGN.md
  thresholds). Diagnostics ledger shows outer ring, min sibling gap, cross-anchor
  nearest, and "spread to" suggestions (quietest same-region anchors).
- Cross-anchor overlap pairs (<26 m between foreign caches) listed + linked on
  the sheet in danger-red dashes.
- Sim lane: paste a row/object/array/`{caches:[…]}`, validated like
  `validate:content` (kebab id unique, lore slug exists, on-world anchor),
  pinned in hot amber; ghost rings + crowd grades recompute. Copy pins as JSON.
- Click a cache → codex-styled reading card with the real entry body
  (`renderLoreBody`), fan slot k, coords, spacing verdict.

## If you touch it

- Fan-out constants live in `data.ts` and mirror caches.ts — if you change the
  game resolver, change both or the parity badge goes red (that's the point).
- Region glyphs/colours are in `REGION_STYLE` (data.ts); new regions fall back
  to a rust surveyor style automatically.
- The map is pure SVG — no canvas, no R3F; keep it that way (DOM QA bench).

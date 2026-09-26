# Rep Reaction Atlas — builder notes

Off-world bench (center [9200, 7400]) — gameplay never streams it; Lab lists it
via the named `meta` export.

## What it does

- **Standings columns** — sliders + SVG needle gauges set guild/choir/reclaimers
  rep (−20…+120) with posture presets (✖ △ ▢ ◈ ❖ — the ledger bench's rails,
  reused verbatim). Each column answers what that standing moves tonight:
  radio airtime (shipped, with saturation note), board gates (runtime-ready),
  prices / tiered lines (gaps), guild-only debt barks.
- **The Saltmouth survey** — canvas2d map of every on-world band (shipping's
  own rule: radius + 260 m skirt, ±1800 m cut) with a closed 9-stop loop,
  courier dot, click-to-scrub and play/pause. Band transitions auto-spin the
  radio.
- **Radio deck** — restages the HUD ticker (`RADIO · <BAND>` / `LONG STATIC`,
  seeded voice+line per spin) plus the full voice ledger: exact weights
  (base 1 · +6 home · +1 driftline · +min(8, rep×0.12)), per-voice boost chips,
  share bars, and a seeded 400-roll Monte Carlo sanity chip.
- **Coverage matrix + flags** — surfaces × factions, live-scanned counts
  (missions' requires.rep usage, rep payouts incl. the ghost driftline key,
  tier-branched bucket count), copyable markdown claim sheet for writers.

## Key findings encoded in flags

- HOSTILE unreachable + radar-silent (all payouts ≥ 0, weight clamp max(0,·)).
- ~299 driftline rep paid into a key the `Faction` type never names.
- 0 of 85 missions use `requires.rep` despite schema/runtime/UI shipping it.
- No rep-branched lines, callouts or prices anywhere.
- Radio bonus saturates at rep 67 (KIN sounds like mid-friendly).
- hover-playground leaks into the band rule (GAMEPLAY_EXCLUDED unconsulted).

## Maintenance

If `src/ui/HUD.tsx` weight rules or band rule change, mirror them in
`data.ts` (`weighCast`, `bandAt`, `LINES_PER_MIN`). Survey route in
`data.ts:ROUTE_ORDER`.

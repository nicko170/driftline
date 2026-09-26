# radio-weight-sandbox — builder notes (iteration 13, demo2 region builder)

**Done.** Tuning bench for the shipped band-weighted radio chatter
(`HUD.tsx → pickRadioVoice`, iteration 11). Night salt flat soundstage: one
amber-lit relay mast ringed by teleport plinths (one per on-world band + Long
Static), two Choir-teal scope consoles, instanced salt spires, drei Stars.

## SHIPPED mirror (weights.ts)
Same constants, same walk: `1 + 6·home + 1·driftline lifer + min(8, rep×0.12)`
for guild/choir/reclaimers; cast = characters with `lines.radio` (56 voices,
ketch fallback retained); bands = `REGIONS` minus `isBenchRegion`.
Rule from DESIGN.md applies: if HUD tunes these constants, tune the bench too.

## Furniture
- **Stage** — plinth ring r=13 (clickable, generous invisible hit cylinders),
  selected plinth = amber-hot diamond + pulsing glow disc; hover = teal; a DOM
  chip shows hover/band; last sampled voice speaks a real radio line in the
  stage ticker. Scope scanlines spike via module-level `benchPulse` (decays in
  Mast's useFrame; also flares the lamp — the only active light on stage).
- **Console** — band list (+6 local counts), rep sliders 0–100 step 5 with
  live bonus readout, Roll 100 (kbd R) / Roll 1000 / Reset (kbd X), Copy
  weights JSON (clipboard → prompt fallback) with `<details>` preview.
- **Histogram** — stacked theoretical bars (bone base / amber home / teal
  lifer / rust rep, glyph+colour legend, CVD-safe) beside hatched observed
  bars; locals-of-band airtime line; 3σ noise-band deviation ruler
  (teal ✓ / amber ▸). Re-tuning band/rep auto-resets dice (stale dice lie).
- Reduced motion: stage sway parked, hatch lines solidified. No store access —
  rep is simulated; zero writes to saves.

## Verified
- `npm run typecheck` — clean. `npm run validate:content` — clean (bench at
  center [7600, 6000], radius 4; never streamed by gameplay).

## Harness notes
- Default export carries `meta`/`anchors` statics; named `meta` export makes
  the Lab list it. No Props/colliders — the game streams nothing.
- No AudioContext here (pure math bench) — no gesture gating needed.

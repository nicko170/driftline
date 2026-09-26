# Storm Choreo — bench notes

Storm-wall pursuit tuning sim (`/lab/storm-choreo`), demo-region per workshed
policy: satisfies the region registry contract with an off-world centre
(center [6600, 6600], radius 4, danger 0) so the game streams nothing from it.

## What it does
- Top-down tactical pan (canvas 2D, violet-dark, HUD palette): courier start
  chevron, amber shelter ◆ and danger-red wall spawn ring are **draggable**
  (sliders mirror everything for keyboard users).
- Seeded **Monte Carlo crowd** runs the trial hundreds of times per slider
  move (debounced 140 ms); survival % + verdict chip flip live.
- Verdict ladder grades out loud: ▲ Funeral weather → ⟡ Bloody (vet run) →
  ◆ Tense but fair → ▣ Comfortable commute → ◉ Postage run. Once survival is
  saturated, tension is graded by the p10 min-face skim (≤160 m = tense).
- **Run a trial** spectates one seeded run at 1×/2×/4×; finished runs leave
  ghost ribbons (teal sheltered / rust swallowed, max 8, cleared on edit).
- Exports mission objective JSON (objectives + STORM_* block + tuned
  difficulty) and raw Director constants; one click to copy.

## Fidelity contract
The storm step in `sim.ts` is a 1:1 mirror of the storm objective in
`src/game/MissionDirector.tsx` (stormSpeed + clamp((face-150)*gain, 0, cap),
face = centreDist−R, spawnBack 460, shelter capture REACH*1.8 = 14.4 m, no
slow gate, kill at face ≤ 0). The courier is a stand-in: reaction delay,
cruise-loll until the face enters a noisy scare distance (~240 m), panic
boost with finite reserve, heading wobble, emergent dodge under 160 m.

## Findings worth keeping (2026-09-26)
- Shipped constants (23 m/s, gain 0.03, cap 9, R 150, spawn 460) are
  mercy-soft on a straight pan: the storm tops at 32 < stock 34, so a courier
  who floors it always escapes. Verdict: **comfortable commute**
  (p10 face ≈ 220 m). Real-world deaths come from terrain/turns, not the base
  curve — ch3 staying gentle is defensible.
- ch5 black-reach tuning (30 m/s, cap 15, R 190, bike 30) skims p10 ≈ 139 m →
  **tense but fair**; it's the only preset where the wall can outrun the bike.
- Killing a courier in the open requires wall faster than bike top speed; the
  "bloody" band lives on the knife edge around parity, especially with low
  spawn back (< 300 m) where the courier hasn't spooked yet.
- Presets use the true anchor deltas from shipped content (windspine:
  storm-gauge → saltmouth:gate-east = 1495 m, etc.) — course geometry in this
  bench is real, only the pan is flat.

## Perf
512 trials ≈ 30–55 ms on main thread, debounced; canvas is one statically-
sized DPR-aware 2D canvas on a cheap rAF (grid + ribbons + ~40 speckles);
replay bounds are precomputed so the fit never scans a trace mid-flight.

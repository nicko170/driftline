# Upgrade Curve Sandbox — bench notes

**What it is:** a feel-economy grapher for the garage. Pips for engine / handling
/ boost (shipped ladder 0–3, `PART_COSTS` [400, 900, 1800]) redraw five ledger
figures + a live skidpad replay (current fit vs stock ghost, side-by-side lanes).

**Source of truth:** `physics.ts` quotes `src/game/Bike.tsx` constants inline.
If the bike is re-tuned, update PHYS there — graphs, skidpad and export JSON all
derive from it. `KMH = 3.4` matches the game's own display factor (ride stats).

**Findings baked into the design:**
- Stock never hits 100 km/h throttle-only (terminal ≈ 67); boost tape crests
  ~103 then *sags* when the tank runs dry — visible on Fig 01 and the skidpad.
- On the shipped ladder nobody crosses 100 unboosted; dream L4 is the first —
  the Fig 04 bars show the dashed hundred line clearing at L4.
- Drift-exit kick + meter refund are pip-independent (Fig 03). If handling
  should matter there, hook `kickCap`/`kickPerS` to a level.

**Dream ladder (0–5):** a flagged what-if — same linear gains, cost ×2 per step
past 1800 (3600, 7200). Teal/dashed everywhere it appears; never presented as
shipped. Switching back to shipped clamps pips at 3.

**Architecture:** React state owns `pips`/`ladder`; `bench` (module-level
mutable) mirrors them for the R3F frame loop (no zustand in hot path). Graphs
are canvas-2D with ResizeObserver redraws keyed on deps — no SVG churn.
Skidpad steps the identical integrator as `runLaunch()`.

Concept art: `public/images/work/upgrade-curve-sandbox.jpg` (splash).

# Handling Curve Lab — bench notes

Demo-region (off-world centre 7400/6600 → never gameplay-streamed). Splash art:
`public/images/work/handling-curve-lab.jpg`.

## The one rule

No fork of bike physics. `LabBike.tsx` is the shipping controller
(`src/game/Bike.tsx`) line-for-line; **fixed feel constants** (hover 1.25,
spring 6.5, boost multipliers ×1.8 accel / ×1.38 vMax, drift grip ×0.16,
reward window min(0.35, t·0.1), hop ceiling ×1.337, drag 0.55, air gravity 17)
are copied verbatim at the top of the file. The **opened** constants live in
`params.ts: BASELINE`; `effective(params, ladders)` re-derives the numbers with
the shipping upgrade formulas (engine +5 accel / +3.5 vMax, handling +0.22
steer / +1.6 grip scale, boost −0.035 drain / +0.02 regen). If Bike.tsx changes,
mirror it here — the bench's value is that it lies about nothing.

## Files

- `terrain.ts` — analytic figure-eight world: Bernoulli lemniscate distance
  field (closed-form |f|/|∇f|), glass-lane strips, banked sand ring, berm
  bounds. `ground()/groundNormal()/surfaceAt()/vertexColor()` are the single
  source of truth for paint AND physics AND surface grip.
- `params.ts` — zustand tuning store, slider defs, ladders, `isCustom()`.
- `telemetry.ts` — mutable `tele` + 8 s ring buffer (speed/slip/boost/drift/
  reward fill/surface lane). `pushSample()` runs once per rendered frame from
  `ChaseCam`; `clearRing()` on respawn.
- `LabWorld.tsx` — 720 m heightfield @ ~3.2 m cells, vertex-painted;
  instanced shards/pylons; gates (teal diamonds = glass lanes) + start gantry;
  bump-only colliders; dust trail tinted by live surface; motes.
- `LabBike.tsx` — controller + shipping bike model (rust/bone/teal glow).
- `Scope.tsx` — canvas strip: amber speed, rust slip, teal drift-window area,
  bone boost, surface lane. Zero allocations per frame.
- `Curves.tsx` — ladder headroom graphs (canvas, redrawn on store change):
  engine cruise/boost top speed, handling steer/grip, boost burst/refill
  seconds, drift kick vs time with ×1.875 cap and the reward window.
- `Panel.tsx` — ladders (pips 0–3), curves, grouped sliders, Baseline /
  Respawn / Copy settings JSON (clipboard with execCommand fallback).
- `Hud.tsx` — status chips incl. live grip multiplier on the painted surface,
  drift reward flash (banked boost + kick), speed/boost cluster.

## Conventions reused

Chase camera: dist 7.4 + speed-term, FOV 58 + min(14, speed·0.26)
(×1.22 boosting), shake decays at 2.2/s — matches hover-playground.
Shape+colour pairs everywhere (■ salt / ▲ sand / ◆ glass); the teal drift
chip and amber reward chip never rely on colour alone.

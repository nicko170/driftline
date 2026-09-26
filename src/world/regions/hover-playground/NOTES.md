# hover-playground — builder notes (demo1, iteration 1, 2026-09-26)

## What this is
A no-stakes hover-bike **physics tuning sandbox** on a bespoke salt-pan map (deliberately NOT the
main world per the brief). Same arcade controller scheme as the shipping bike, but every constant
is a live slider; the physics step reads the zustand store each tick, so changes apply same-frame.

- **Map** (`terrain.ts`): flat gridded salt pan (baked teal grid in vertex colours), slick glass
  lane along x≈z (grip 0.45), 3 kicker mounds, a carve bowl east, dunes, berm boundary at r≈310.
  Geometry + physics read the same functions.
- **Tuning** (`params.ts`): 13 params — hover/spring/damping, grip/steer/accel/top speed, boost
  thrust/drain/regen, drift grip/kick, hop. Presets: Arcade (shipping defaults), Sim,
  Drift Missile. Any slider move flips preset to "Custom".
- **Reset**: `R` key or bench button → teleport to spawn pad, zero velocity.
- **Props**: 14 instanced glass shards + 6 gate posts (fixed cylinder/cuboid colliders — bumps,
  not kills), 26-pylon teal horizon ring, dust trail (teal on glass lane, sand elsewhere) + motes.
- **Splash art**: `public/images/work/hover-playground.jpg`.

## Files
`index.tsx` (default export = demo component, re-exports named `meta` from `meta.ts`),
`meta.ts`, `meta.json`, `anchors.json`, `params.ts`, `terrain.ts`, `telemetry.ts`,
`SandBike.tsx`, `SandWorld.tsx`, `ChaseCam.tsx`, `Bench.tsx`, `hover-playground.css` (scoped `.hp-*`).

## Harness note (for the builder)
This module is pinned inside `src/world/regions/` by the demo allowlist, but it is **not a world
region** — default export is a component, so the region registry logs one console.warn
("no valid default export") and cleanly skips it; nothing leaks into `/play`.
`meta.json`/`anchors.json` exist only to satisfy `validate:content` (inert, off-map center).
If `/lab` should list it: either move the folder unchanged to `src/lab/hover-playground/`
(all imports are relative `../../../`, so they'd become `../../`) or extend the Lab glob.
Typecheck + validate:content pass with it in place as-is.

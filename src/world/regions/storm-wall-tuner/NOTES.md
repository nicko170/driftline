# Storm Wall Tuner — notes

Look-dev bench for the shipping storm (`/lab/storm-wall-tuner`), demo-region per
workshed policy (off-world centre `[6050, 6050]`, no props/colliders). Third of the
storm trio: **storm-front-sandbox** tuned how the wall *hunts*, **storm-choreo**
tuned the mission *math*, this one owns how the wall *looks* and what it *costs*.

## Files
| file | owns |
| --- | --- |
| `state.ts` | `SHIPPED` (1:1 mirrors of MissionDirector StormWall, Sky stormFog ramp, HUD tint), quality budgets, `lab` knobs, `rt` scratch, colour-ramp / CVD helpers, `exportPayload()` |
| `Wall.tsx` | 1–5 shell stack (inner→mid→outer colour ramp, opacity falloff, wobble), churn band, ground skirt, particle sheet (shader points, module buffers), wind streaks (world-space, camera-wrapped), the 64² overdraw readback + perf sampler |
| `Scene.tsx` | Sky.tsx keyframe port + storm-haze ramp, staging director (face smoothing, squeeze run, tint), salt-pan ground, rail tic posts, live fog/tint reach rings, mesas + teal spires, ghost rider, camera rigs (chase / orbit / top) |
| `Hud.tsx` | shipped chrome mirror — exact `hud-storm-tint` gradient + ▲ STORM WALL chip (urgent < 200 m) — plus perf/overdraw instruments and the face tape |
| `Panel.tsx` | stage / wall look / atmosphere / quality / measure / legend+CVD / export JSON |

## The overdraw meter (honest crib)
The wall renders on `LAYER_WALL` (7). Every 400 ms a storm-only pass renders
into a 64² render target; readback gives **real screen coverage** and mean
composited alpha. Stack depth is an *estimate*: `log(1−A)/log(1−ᾱ)` with `ᾱ`
the mean live per-layer alpha (shells + churn faces). Worst case = scrub face
to 0 (camera inside the shells, both faces of every cylinder paint).

## Shipped conventions honoured
- Wall arc `thetaStart = π/2, length π`, opening faces the rider (`+Z` local);
  the bench parks the wall at `z = −(face + radius)`, rotation 0.
- Fog: `target = clamp(1 − face/fogRange)`, eased at `fogEase`/s, colour lerps
  `skyLerp/horizonLerp` toward `#C98F4E`, density `+fogBoost`. All tunable.
- Tint: `min(cap, (1 − face/tintRange) · cap)` — HUD DOM gradient verbatim.
- Shape-first grammar: storm = ▲ chip + ● disc + wash; amber ◆ stays
  mission-only. Reach rings differ by shape AND colour (◇ amber fog, ○ rust tint).

## Usage
`C` camera rig · `P` run the squeeze (640 → 0 at 46 m/s) · `R` reset ·
`[`/`]` scrub proximity. `★ shipped` chip restores the stock treatment;
`churning (ch5)` stages the chapter-5 upgrade path (sheet, skirt, wobble, taller).

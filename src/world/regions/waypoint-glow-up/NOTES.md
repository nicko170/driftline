# Waypoint & Beacon Bench — notes

Purpose: the shipping mission markers (MissionDirector.tsx) had never been
legibility-tested as a family. This bench lines all nine markers up on a
distance-marked **night firing lane** (worst case: violet fog + emissive glow),
cycles them through **colourways × station spacings**, and runs colour-blind
simulation to prove the design rule with pixels:

> shape is the identity; colour is decoration (never colour alone).

## How the CVD sim works

- `cvd.tsx` holds Machado/Oliveira/Fernandes (2009) matrices at severity 1.0.
- They are emitted as `<filter><feColorMatrix>` SVG defs and applied to the
  WebGL canvas wrapper via CSS `filter: url(#wgl-cvd-…)` — the compositor
  simulates the **live scene**, fog, glow and bloom included, at zero draw cost.
- The panel simulates swatches in JS with the same matrices (`applyMatrix` in
  `spec.ts`), so the legend, the contrast table and the canvas agree.

## What to check on the range

- `ghost` colourway collapses every hue toward bone-grey: the contrast table
  will light up red, and the glyphs (`◆ ■ ◉ ▲ ● ✦ ◍ ◎ ○`) still uniquely name
  every marker. That's the accessibility proof.
- `horizon` spacing puts the storm veil at 380–660 m in night fog — the disc
  footprint + churn silhouette must read even when the veil subsurface doesn't.
- `motion` off freezes t=0 for clean screenshots of every state.

## Constants provenance

`spec.ts` mirrors MissionDirector.tsx (beam height 60, ring reach 8 × 0.7/0.92,
holo at +4.2 m, race-gate torus r6/tube 0.4, collect hover 1.6 m, scatter
6–28 m). "Copy spec JSON" exports exactly this, plus measured contrast ratios,
so palette changes in the game can be re-imported and re-benched here.

## Region contract

Off-world bench per workshed policy: center [5800, 6600], radius 4, two
harmless anchors, no Props/colliders — the game streams nothing from it.
Lab listing comes from the named `meta` export in `meta.ts`.

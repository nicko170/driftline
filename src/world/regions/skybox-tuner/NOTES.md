# skybox-tuner — builder notes (iteration 1, demo3)

**Done.** Skybox & Day Cycle Tuner: scrub the day/night cycle (palette keyframes mirrored
from `src/game/Sky.tsx`) over a bare dune vista; sliders for cycle speed, fog density,
sun gain, star factor; live hex swatches; Copy JSON → clipboard (matches Sky.tsx keyframe rows).

## Files
- `index.tsx` — default-exported panel component carrying `meta`/`anchors` statics so the
  world registry + content validator accept it as a harmless **off-world** region
  (center [5000,5000], radius 4, no Props, no colliders → zero game impact, no console warn).
- `meta.json` / `anchors.json` — required by `scripts/validate-content.mjs` (region contract).
- `meta.ts` — demo sheet meta `{ title, description, tags, client, caseStudy, blurb }`.
- `palette.ts` — keyframes, alloc-free `sampleInto`, `sampleHex`, `tuner` live state, `exportPayload`.
- `Scene.tsx` — gradient sky dome (custom shader, BackSide sphere), sun disc + halo,
  directional/hemisphere rig with shadows, faceted dunes (`toNonIndexed` + face normals),
  salt spires/mesas/dead turbine silhouettes, hand-rolled stars + dust motes (controllable opacity).
- `Panel.tsx` / `panel.css` — leva-less slider panel, on-brand (amber diamonds, rust-deep borders).

## Verified
- `npm run typecheck` clean for this folder (pre-existing errors in HUD.tsx/MissionDirector.tsx
  belong to a parallel worker's in-flight edit).
- `npm run validate:content` clean for this folder (hover-playground errors are another worker's).
- Concept art: `public/images/work/skybox-tuner.jpg`.

## Perf notes
- No per-frame allocations: module-level scratch palettes/colors; Stars/dust never remount at runtime.
- `pixelRatio` capped via `dpr={[1, 1.75]}`, shadow map 1024.

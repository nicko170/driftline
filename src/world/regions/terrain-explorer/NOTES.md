# Heightfield Explorer — notes

Fly-through of the world heightfield in false colour. Also a worldgen-correctness
bench: the cached replica is verified against the live `terrainHeight()` at every
load (Δ badge in the panel; ~3 µm from float32 caching).

## Files
- `index.tsx` — demo shell; Canvas + header card + panel; F toggles fly-cam;
  default export carries `meta`/`anchors` statics so the region registry accepts it
  as an off-world no-props bench (center [6500, 5400]).
- `meta.json` / `anchors.json` — validator contract, off-world.
- `meta.ts` — demo sheet meta `{ title, description, tags, client, caseStudy, blurb }`.
- `heightfield.ts` — each named terrain feature cached in its own `Float32Array` over a
  res² world grid (chunked async build, progress to the store). `combineHeight()`
  mirrors `src/lib/terrain.ts` term order exactly → layer toggles recombine in ~10 ms
  with zero noise recompute. Seed = domain shift of the noise layers only.
- `state.ts` — zustand store (layers, colour mode, overlays, exag, res, seed, stats).
- `Scene.tsx` — terrain mesh (in-place position/colour rewrite), route ribbons,
  region masks (rings + labels via drei Html), drei Grid, orbit ↔ fly camera.
- `Panel.tsx` / `terrain-explorer.css` — controls + scoped styles (te- prefix).

## Colour modes
- **Height bands** — false-colour hypsometric ramp quantized to 6 m bands + contour
  darkening; hillshade from finite-difference slope so relief reads.
- **Surface grip** — game-real `surfaceAt()` kinds (salt 1.05 / sand 1.0 / glass 0.5).
- **Game palette** — shipped `vertexColor()` verbatim, contours optional.

## Perf
- res 224 default = ~50k verts; noise build chunked over frames (~1 s), apply ~10 ms.
- Options up to 352² (~125k verts); grid cached per (res, seed), layers/modes re-apply.
- No per-frame allocations in fly-cam or scene; ribbons/rings rebuild only on
  `appliedVersion` bumps.

## Getting here
The loading card art is `public/images/work/terrain-explorer.jpg` (rendered in the
header chip via `withBase`).

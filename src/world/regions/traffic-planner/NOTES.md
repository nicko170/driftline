# Traffic Planner — build notes

**What it is.** A surveyor's-table route editor for the ambient traffic fleet
(`src/game/AmbientTraffic.tsx`). Top-down relief chart of the playable world
(canvas2d), region circles and named anchors stamped from the region JSON
files, click-to-plot loop legs with anchor snapping, live dot replay against
the shipping fleet (mirrored as ghost traffic), near-miss pulses, dead-zone
stamps, and one-click export of the exact `VehicleSpec[]` manifest format.

**Workshed policy notes.**

- The folder satisfies the region contract: `meta.json`/`anchors.json` are a
  harmless off-world bench (center [7300, 6900], radius 4); `index.tsx`
  default-exports the component with `meta`/`anchors` statics and re-exports
  the demo sheet from `meta.ts` — that's what lists it in `/lab`.
- It does **not** import `src/world/registry.ts` — that registry eager-imports
  every region `index.tsx`, so importing it back would cycle. Instead
  `data.ts` globs `../*/meta.json` and `../*/anchors.json` (the same source
  files the registry streams) and filters to playable regions
  (`|center| <= 1500` and `radius >= 120` — excludes hover-playground's 60 m
  pocket bench and every lab's radius-4 off-world stamp).
- `SHIPPING_MANIFEST` in `data.ts` mirrors `VEHICLES` from AmbientTraffic
  verbatim (iteration-3 fleet). The table reads the game, not vice versa —
  **update the manifest here when the shipped fleet changes.**

**Format contract.** Exported code is paste-ready over `const VEHICLES` in
`src/game/AmbientTraffic.tsx`: same field order (`kind, speed, phase, color,
glow, hover, route`), integer metres, anchor references in trailing comments.
The replay honours game semantics: m/s along the polyline, teleport-wrap home,
no terrain-height math (the game hovers follow the heightfield, invisible at
map scale).

**Map conventions.** North up (world −z is up; z south = screen down), paper
relief underlay sampled from `terrainHeight`/`surfaceAt` (160² grid, hillshade
+ 6 m contour bands, regenerated on resize, DPR-capped at 2). Glassroad =
teal line, Windspine = rust hatch, boundary = dashed rule at ±1200.

**Interaction.** Click = append pin (snaps within 55 m of a named anchor —
`SNAP_RADIUS_M`), drag pins, right-click (or Delete key on selected pin) lifts
a pin, click a line selects its route, Ctrl+Z undo (40-deep), Esc deselect /
closes export. Routes persist to localStorage
(`driftline.lab.traffic-planner.v1`).

**Accessibility.** Class chips and coverage use glyph + colour, never colour
alone (courier ◆ dart, hauler ▣ deck, skiff ▲ hull+mast); every canvas
interaction has a DOM equivalent (pin list with per-pin lift buttons in the
inspector); focus-visible outlines everywhere interactive.

**Files.** `data.ts` (math, presets, manifest, random gen, export) ·
`MapCanvas.tsx` (underlay + interaction + replay) · `index.tsx` (composition,
toolbar, rail, export dialog, persistence, keyboard) · `traffic-planner.css`.

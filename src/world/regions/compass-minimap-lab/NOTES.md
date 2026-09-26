# compass-minimap-lab — builder notes (demo2, iteration 3, 2026-09-26)

## What this is
The HUD navigation bench. A fake 1200 m test pan (pure canvas 2D, no R3F) with draggable
**player / waypoint / convoy / chase / storm** anchors drives three linked instruments:

1. **HUD mirror** — the shipping compass pill + projected waypoint diamond rendered with the real
   game classes (`hud-compass`, `hud-marker`, …) from `src/ui/ui.css`, fed by `navmath.ts`, which
   mirrors the exact formulas in `src/ui/HUD.tsx` (window 0.9 rad, `left = 50 + (off/0.9)*48`) and
   `src/game/CameraRig.tsx` (chase-cam dist/height/FOV, marker clamp 0.04–0.96 / 0.06–0.9, +3.5 m
   hoist, behind ⇒ hidden). A ghost `◇` renders at the *unclamped* projection so the clamp is
   visibly doing work.
2. **Minimap × 4 skies** — one painter (`world.ts drawLabMinimap`, structured like HUD's
   `drawMinimap`) at four candidate palettes (day/dusk/night/storm, `palettes.ts`), with a live
   WCAG contrast table (measured, not asserted). Tightest pair today: day/chase at 6.2:1 — all ≥3:1.
3. **CVD proof strip** — the marker legend re-rendered through deutan/protan/tritan matrices
   (Machado 2009), proving the shape rule: **shape + colour, never colour alone**.

**Invariant suite** (`checks.ts`, 10 checks): window-edge strictness, tick bounds over a 2π sweep,
diamond≡tick parity, 4000-case marker-clamp fuzz (raw projections reached ±6e7 without escape/NaN),
behind-hide, distance finiteness, per-surface shape uniqueness, contrast ≥3:1 across palettes,
bearing sanity, and a **WARN-level handedness audit**:

> ⚠ `Bike.tsx:234` writes `heading = atan2(fwd.x, −fwd.z)` (true bearing, 0 = north) but
> `CameraRig.tsx:28` reconstructs forward as `(sin h, 0, cos h)` — mirrored in z. The
> compass/minimap chain is internally consistent with the bearing form; the camera flips it.
> Flagged for the app builder; the lab deliberately does not patch game code.

**Export**: "copy constants JSON" emits the compass/marker constants + palettes with measured
contrasts and grades, ready to drop into the game if per-time-of-day minimap palettes are adopted.

## Files
`index.tsx` (default export = demo, re-exports named `meta` from `meta.ts`), `meta.ts`, `meta.json`,
`anchors.json`, `navmath.ts`, `palettes.ts`, `cvd.ts`, `world.ts`, `checks.ts`, `WorldCanvas.tsx`,
`HudMirror.tsx`, `MinimapLab.tsx`, `CvdStrip.tsx`, `ChecksPanel.tsx`, `panel.css` (scoped `.cml-*`).
Key art: `public/images/work/compass-minimap-lab.jpg` (header backdrop, loaded via `withBase()`).

## Harness notes
- Off-world region contract like dust-lab: default export carries `meta`/`anchors` statics,
  `center [6200, 6200]`, `radius 4` — registers quietly, draws nothing in-world.
- A coordinating worker dropped placeholder stubs + moved the off-world centre to [6200, 6200]
  mid-iteration; kept their centre, replaced the stubs with the full panels.
- If `/lab` should list it: extend the Lab glob (same situation as hover-playground per its NOTES).
- `npx tsc --noEmit` and `npm run validate:content` both clean.

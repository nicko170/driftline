# Portrait Station — bench notes

**What it is:** QC booth for the `public/images/characters/*.jpg` pipeline.
Reads every `portrait` declared in `src/content/characters/*.json`, develops
the film through a 96×96 canvas readback (`pixels.ts`) and grades four checks
(`data.ts: gradeAnalysis`): warm-key share, faction-chip hue drift, silhouette
readability (Sobel edge density + ring/face separation), and the true 64px
`object-fit: cover` dialogue crop legibility (face-disc luminance σ + edge
density at 64). Overall letter = 2/1/0 per pass/warn/fail, 0–8: ≥8 A
GALLERY, ≥6 B HANG-READY, ≥4 C TOUCH-UP, else REPAINT.

**Differentiation from sibling benches:** `portrait-booth` = contact sheet +
re-roll prompt; `roster-review-bench` = live dialogue-card rendering of the
JSON; this station = pixel-readback grading, side-by-side, context hang, CVD
pass, corrective shot lists.

**Honesty checklist:**
- The 64px preview matches `.dialogue-portrait img` exactly (64×64, cover,
  10px radius, 1px panel border).
- CVD = Vienot-Brettel-Mollon 1999 dichromat matrices in linear light
  (gamma 2.2 round-trip via LUT); `compass-minimap-lab` uses Machado 2009 —
  both are fine, they answer to different citations.
- All status is glyph + colour (✓/!/✕, ●/▲/■/✕); the tally is numeric too.
- Analyses cache per id, run 4-at-a-time; the tally fills in as film dries.

**Knobs worth tuning** (`pixels.ts` / `data.ts`): KEY_BAND window, silhouette
sweet zone (edge 3.5–16%, sep ≥0.12), drift pass ≤38°, 64px pass (σ ≥ 0.085
&& edges ≥ 2.8%). If portraits migrate to a different shipped size, update
both the crop render and `CROP`.

Header art: `public/images/work/portrait-station.jpg` (generated).

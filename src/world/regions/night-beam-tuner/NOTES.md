# Night Beam Tuner — dev notes

A lighting bench for the DESIGN.md night rule: *"read the road 20–30 m ahead
without the salt pan turning into a searchlight pool."* The player-spec bike
(static, parked) sits on a salt corridor walled by glass canyon; its headlight
matches `src/game/Bike.tsx` mount points, cone length and the dusk ramp
`on = clamp((nightFactor(t) − 0.12) / 0.35, 0, 1)` exactly.

## Files
- `beam.ts` — shared live state, shipped-constant baseline, the exact three.js
  spotlight attenuation math (distAtt / spotAtt mirror the lights GLSL), the
  analytic ground-illuminance sampler, tuning verdicts, and the export payload.
- `Scene.tsx` — sky/light rig on the game's palette keyframes (dome shader,
  sun, hemi, stars, dust, game fog formula × fogGain), vertex-coloured canyon
  terrain, static bike + parameterised headlight, range gates every 5 m,
  teal 20/30 m read-band frames, instanced rocks + teal glass veins,
  three lerping camera presets (chase / profile / footprint).
- `Panel.tsx` — HUD slider rail; glyph chip per control (shape carries meaning,
  colour is decoration); day/dusk/twilight/night presets; verdict strip;
  Copy Bike.tsx props / Copy JSON / Reset shipped.
- `Scanline.tsx` — canvas-2D overlay (~11 Hz) charting forward illuminance
  (amber curve, teal read band, red pool zone, dashed READ_OK threshold,
  read-die triangle) plus lateral spread at 25 m. "LAMP OFF" ghost by day.
- `meta.ts` — demo sheet `{ title, description, tags, client, caseStudy, blurb }`.
- `meta.json` + `anchors.json` — harmless off-world bench (centre [5200, 5200]),
  so the region registry and content validator stay happy; gameplay never
  streams this module.
- Concept art: `public/images/work/night-beam-tuner.jpg`.

## Calibration note
`READ_OK = 0.02` (relative lux) is picked so the shipped beam at full night
reads ~27 m on the centreline and pool glare lands ~×1.5–2 — matching the
"reads 20–25 m ahead" wording in DESIGN.md. Verdicts: glare > 2.4 →
searchlight (bad); read < 20 m → dim (bad); read > 34 m → long-throw (warn);
else sweet spot (good).

Keys: none — all input is the slider rail. No audio. Off-world, so no
colliders/props contract; the module registers only `meta` + `anchors` statics.

# Boost Feedback Lab — notes

**Iteration 3, demo1.** A boost-feel bench (lab, not a world region).

## What it is

A ghost telemetry model rides a treadmill speed strip — the bike stays at the
origin and the ground/posts/gates/mesas/streaks scroll past — so a scripted run
is pixel-repeatable and camera math stays trivial. Hold **Shift/Space** (or the
on-screen button) to boost; **T** runs the tape (9 s scripted run, boost held
2.0–6.4 s, meter drain real); strobe alternates shipped ↔ candidates every
2.2 s; **M** mutes.

## The four channels

- **FOV**: shipped kick (game's ×1.25 binary step) / punch-in / speed-blend /
  elbow ease. Punch size slider.
- **Shake**: shipped silence / saturate / ramp / gusty. Amplitude slider;
  reduced-shake toggle forces zero (accessibility).
- **Pitch**: shipped step (+26 Hz) / bloom / turbo-lag / strained song. Own
  `BoostSynth` (self-contained WebAudio) — deliberately NOT the game singleton
  so candidate mappings can deviate.
- **Boost bar**: shipped linear bar (pixel-faithful: reuses the game HUD's
  global classes from ui.css) / charge cells (8 segments, tick on drain) /
  halo ring / tach sweep.

## Side-by-side

SVG chart over the tape for the focused channel: shipped dashed, selection
solid amber, other candidates ghosted, teal meter drain line, shaded boost
window, peak-Δ pill. Combined with the strobe, this is the A/B rig: feel it in
the scene, verify it on the chart, export with **copy preset JSON**.

## Engineering

- All per-frame work is allocation-free (module-level scratch objects);
  instancing + modulo recycling; one small ShaderMaterial for the ground
  (uScroll wrapped at 600 000 m — a multiple of 20/100/300 so dashes, ticks and
  tint bands align seamlessly at the wrap).
- Feel model constants mirror stock `src/game/Bike.tsx` (vMax 36/×1.38,
  accel 24/×1.8, drain 0.26, regen 0.07); HUD m/s→km/h uses the game's ×3.4.
  Camera follow recipe mirrors `src/game/CameraRig.tsx`.
- Region-registry contract: off-world meta (center [5800,5200], radius 4,
  danger 0), meta/anchors statics on the default export — game streams nothing.
- Concept art: `public/images/work/boost-feedback-lab.jpg` (splash + loading).
- Checks: `npm run typecheck` ✓ · `npm run validate:content` ✓ (0 errors).

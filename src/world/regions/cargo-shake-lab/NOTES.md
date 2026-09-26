# Cargo Shake Lab — bench notes

Tuning bench for the fragile-cargo chain. Off-world (centre 8600,8000 — never
streamed into gameplay); listed at `/lab/cargo-shake-lab`.

## What it mirrors (verify before trusting the export)

- `src/game/Bike.tsx` ~L256: `impactAbsorb = shield × 6`, collision damage
  `max(0, impulse − 9 − absorb)`, only above 9 m/s.
- `src/game/MissionDirector.tsx` ~L39/: `FRAGILE_DMG = 0.012`, cargo damage
  only when `telemetry.impact > 0.5` (the graze floor), payout scale
  `0.35 + 0.65 × integrity`, integrity ≤ 0 fails the mission.
- Those constants live in `sim.ts` as `SHIP` — update both together if the
  game chain changes.

## Model choices

- The pan is a treadmill (bike parked at origin, course scrolls through) so
  camera math and the scripted hits are pixel-deterministic. Events fire when
  their distance marker crosses the bike; hop/land pairs play real ballistics
  (`RUN_V` 22 m/s, `GRAV` 18, hops tuned to land on their scuff marks).
- Ghost A is analytic, not simulated: `predictRun` + `ghostIntegrityNow()`
  compute its integrity from the stashed param set at the same course
  distance, so A/B is always fair and chart/scene/export all agree.
- `runPts`/`feed` are ring-buffer-ish module arrays; UI polls at ~10 Hz.
- Splash art at `public/images/work/cargo-shake-lab.jpg`.

## Ergonomics

R run/stop · G ghost replay · A stash params as ghost A · 1–5 sequence ·
M mute. Reduced-motion kills camera shake, halves bounce/wobble and disables
the auto-loop. Loop toggle lives in the Session section.

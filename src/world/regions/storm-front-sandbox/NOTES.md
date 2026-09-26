# Storm Front Sandbox — bench notes

**Purpose.** `src/game/MissionDirector.tsx`'s storm objective is a hunting sand wall
(base 23 m/s + rubber-band kick, 150 m radius, 3 counter-rotating fog shells). The ch3/ch5
storm missions need their *feel* tuned — how tall, how fast, how hungry — and feel can't be
read off constants. This bench runs the same hunting math with every constant exposed, plus
the upgrade path (churning particle sheet, wind streaks, density-scaled fog, procedural
rumble), so a tuned JSON drops straight back into the director.

## Layout of the folder

| file | role |
| --- | --- |
| `state.ts` | `lab` (panel state), `SHIPPED` (MissionDirector constants), `bike`/`storm`/`stats`/`sim` runtime scratch, `panHeight`, `releaseStorm`/`recallStorm`, presets, `exportPayload` |
| `Bike.tsx` | simple arcade hover-bike (WASD/arrows, Shift boost, Space hop), soft pan rim, hover bob |
| `Storm.tsx` | hunting director (mirrors MissionDirector 1:1), wall shells + churn skirt + 1500-slot particle sheet (shader points, ring-buffer respawn), wind streaks |
| `Scene.tsx` | violet-dusk sky dome (horizon smudge glows toward the wall), FogExp2 proximity modulation, pan mesh, shelter arch (goal), storm-gauge mast, chase/wide camera rig |
| `audio.ts` | brown-noise rumble + wind hiss + crackle scheduler, all synthesized, throttled ~8 Hz |
| `Hud.tsx` | DOM overlay: face meter, speed tape, status pill, flash messages, full-screen ochre tint — all ref-written from one rAF, zero re-renders |
| `Panel.tsx` / `panel.css` | sliders, presets, Copy JSON |

## Semantics that must stay mirrored with MissionDirector

- `face = dist(bike, stormCentre) − R`; kill when `face ≤ 0` (no slow gate — you dive for shelter).
- chase speed = `base + clamp((face − 150) × rubberband, 0, catchCap)`.
- intensity = `1 − face / feelRange` drives fog, tint, shake-in-game, audio, streaks.
- Wall group convention: local `+Z` opening faces the player (`rotation.y = atan2(dx, dz)`);
  shells are open cylinders spanning θ ∈ [π/2, 3π/2]. The particle sheet spawns on the same arc.

## Perf

- No per-frame allocations: particle buffers, colors, vectors are module-level scratch.
- Shell radius/height changes are pure mesh scale — no geometry rebuilds.
- Sheet: 1500 slots CPU-advected; fog is one FogExp2 color/density write per frame.

## Tuning notes from the bench session

- Default shipped feel (23 m/s base, 34 m/s bike) gives a ~6 m/s escape margin over the
  490 m spawn→shelter run — comfortably tense, good for "first wall".
- "Black reach (ch5)" (30 + 0.045 band, 190 m radius, 300 m tall, bike 30): survivable only if
  line changes are clean; reads as a finale. Wall height above ~250 reads mountainous at chase
  cam — that's the ch5 look.
- Density > 1.3 with turbulence > 1 starts hiding the shelter ring; if ch5 ships those numbers,
  bump the shelter ring emissive, not the density down.

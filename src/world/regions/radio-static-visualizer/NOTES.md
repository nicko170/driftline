# radio-static-visualizer — builder notes (iteration 2, demo3)

**Done.** Audio-reactive art toy: a recovered "Band Seven" longwave set. Dial the
76–104 band, hold to listen; a choir-teal cathode scope (canvas 2D, phosphor
fade-persistence, three-pass glow stroke) traces whatever the set hears.

## Stations (all synthesized, one lazily-created AudioContext)
- **80.3 Storm band** — brown-noise rumble through a wandering lowpass + scheduled
  crackle bursts (Reclaimer weather-watch).
- **88.1 Choir static** — airy band noise + beating hymn chord (220/221.6/329.6)
  through tremolo, slow swell and a 21ms slap echo.
- **94.7 Guild dispatch** — triangle telegraph beeps (740/988 Hz), random bursts,
  occasional dash.
- **101.9 Band Zero** — 42 Hz sub + faint 5th, 9-second filtered-noise breath
  (inhale/exhale envelope sweeps band 240→900 Hz), double heartbeat each cycle.
- Tuner static bed follows the dial band-pass centre and owns whatever share of
  the mix the stations don't (smoothstep skirt, 1.8 MHz).
- **Ghost harmonics**: every 8–25 s while locked (strength ≥ 0.55) a lone sine a
  fifth-ish up swells for 2–5 s; the scope draws a 5-frame-delay echo trace and
  an in-world whisper line fades in ("the seed vaults remember rain…").

## Files
- `index.tsx` — layout/orchestration; default export carries `meta`/`anchors`
  statics (off-world bench, center [5600,5600], radius 4 → zero game impact).
- `meta.ts` — demo sheet `{ title, description, blurb, tags, client, caseStudy }`.
- `meta.json` / `anchors.json` — region contract for validate:content.
- `engine.ts` — WebAudio voices, schedulers, rate-limited automation w/ 5 Hz
  housekeeping (cancelScheduledValues) so the automation list never grows.
- `Scope.tsx` — canvas scope; ResizeObserver, dpr ≤ 2, preallocated 2048-sample
  scratch + 6-frame ghost delay ring; idle wander trace when the set is cold.
- `Dial.tsx` — drag/wheel rotary knob (station diamonds at their angles) +
  keyboard-accessible sr-only range input.
- `rsv.css` — scoped `.rsv-*` styles, design tokens only, reduced-motion guard.

## Controls
Drag knob / wheel (shift = coarse) / `←`→` fine, ↑↓ coarse / `1–4` stations /
hold pad or `space` to listen / `L` latch toggle.

## Verified
- `npm run typecheck` — clean for this folder (and repo-wide).
- `npm run validate:content` — clean (15 regions incl. this bench, 0 warnings).
- Concept art: `public/images/work/radio-static-visualizer.jpg`.

## Harness notes
- AudioContext requires a gesture: engine is created on first pointerdown-capture
  anywhere in the demo (or space/L). Everything is inert (idle scope trace only)
  until then — registry eager-imports the module into /play with no side effects.

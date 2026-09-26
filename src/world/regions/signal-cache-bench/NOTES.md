# Signal Cache Scout Bench — dev notes

Workshop tool, not a game region (center [9400, 8800] — off-world; the game
never streams it).

## What it mirrors

| bench constant | shipping source |
| --- | --- |
| `SHIPPED.core/tripod/ring/glimmer` | `src/game/SignalCaches.tsx` geometry |
| `captureRadius 13` / `hintRange 340` | `src/game/caches.ts` |
| `CHIP.text/border` + chip replica DOM | `.hud-signal` in `src/ui/ui.css`, `HUD.tsx` L226 |
| `MINIMAP.*` + canvas replica | `drawMinimap` in `src/ui/HUD.tsx` L323 |
| `BACKDROPS` day/dusk/night | keyframes t=0.50 / 0.78 / 0.00 in `src/game/Sky.tsx` |
| `STORMS` sand `#C98F4E` blends | `_sandHaze` storm lerp in `Sky.tsx`; storm tint language in DESIGN.md |

`coreLit(emissive)` is an honest look-dev approximation (violet → white as
emissive climbs), not a renderer inverse — the tables say so.

## Measured findings (at shipped tuning)

- Core glow vs sky: comfortable everywhere except **storm-wall fog** — violet
  on `#C48A5A-ish` sand barely clears the relaxed bar. During storm missions
  the ground ring + HUD chip + minimap ◇ carry detection; if a tuning pass
  ever bumps `glimmer` from 0.09 → ~0.13, dusk/storm rows improve without
  hurting the night silhouette.
- Glimmer deliberately fails its 1.25 bar in most backdrops — it is a
  *motion* aid (bob 1.7 rad/s + spin), not a luminance beacon. Correct.
- Chip text `#B8A7E8` on the panel composite passes 4.5:1 in all CVDs.
- Minimap open ◇ at 90% alpha passes 3:1 against the ink disc even over
  midday-salt underlay; under CVDs hue separation narrows but the open
  diamond vs filled mission marks still differ by shape.
- Separability: violet vs amber `#FFB454` narrows under deuteranopia
  (luminance does the work); ⟡ octahedron vs ◆ diamond glyphs disambiguate.
  Violet stays reserved for codex finds — DESIGN.md holds.

## If you edit the shipping cache

1. Update `SHIPPED` / `CHIP` / `MINIMAP` here to match.
2. Open the bench, run ladder `standard` × storm `wall`, check tables 1–2.
3. `copy spec JSON` pastes straight into design notes.

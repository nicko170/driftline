# DRIFTLINE — Design System

One-line: **frontier-western solarpunk**, sun-bleached by day, violet + neon-amber by night.
Stylised low-poly, flat or softly shaded, big readable silhouettes, long shadows, dust and heat haze.

## Palette (CSS custom properties in `src/ui/ui.css`)

Day (salt flats):
| token | hex | use |
| --- | --- | --- |
| `--salt` | `#F3EEE2` | flats, hulls, HUD cards |
| `--bone` | `#E4D7BE` | secondary surfaces, text on dark |
| `--sand` | `#D9A45B` | dunes, warm mid-tones |
| `--ochre` | `#B07C3A` | trims, wayline |
| `--rust` | `#B3502E` | accents, bikes, roofs |
| `--rust-deep` | `#7E3320` | shadowed rust, borders |
| `--teal` | `#2E8C8C` | fused-glass glass, water towers |
| `--teal-bright` | `#57C4B8` | glow accents, holo markers |

Night:
| token | hex | use |
| --- | --- | --- |
| `--violet` | `#2A2140` | night sky mid |
| `--space` | `#14101F` | night sky top, panel bg |
| `--amber` | `#FFB454` | neon signage, waypoint glow, HUD accent |
| `--amber-hot` | `#FFC969` | boost meter, interact prompts |
| `--ink` | `#1B1526` | deepest bg |
| `--danger` | `#E4572E` | storm, warnings |

Faction colors: Salt Guild `ochre #B07C3A`, Choir `teal-bright #57C4B8`, Reclaimers `rust #B3502E`, Driftline (couriers) `amber #FFB454`.

## Typography

- Display: `"Chakra Petch"` (600/700) — logo, titles, HUD numbers.
- Body/UI: `"Sora"` (400/600) — dialogue, menus.
- Loaded via Google Fonts `<link>` in index.html with `ui-sans-serif/system-ui` fallback. Numerals tabular in HUD.

## HUD & UI language

- HUD overlays are React DOM, pointer-events none except interactive panels.
- Panels: 1px rust-deep border, `background: color-mix(in srgb, var(--space) 82%, transparent)`, backdrop-blur 6px, 10px radius, amber corner ticks on primary panels.
- Waypoint markers: vertical beam (amber) + diamond hoist; colour-blind-safe: waypoint = amber diamond, objective-complete = teal square; shapes differ, never colour alone (accessibility requirement).
- Buttons: uppercase display font, 2px offset underline on hover, focus-visible outline `var(--amber)`.
- Camera shake always respects `settings.reducedShake`; subtitles are always on (no toggle).

## 3D style rules

- `flatShading` everywhere; geometry from primitives/extrusions, no textures in-world (vertex colours + emissive only).
- Terrain: single heightfield, vertex colours by height/slope/region mask (salt white flats → ochre dunes → teal glass canyon floors).
- Sun: warm `DirectionalLight` with follow shadow camera; hemisphere sky/ground fill. Day→dusk→night palette lerp, stars at night.
- Fog: `FogExp2`, density rises at night/dust; dust motes + bike dust trail via recycled `Points`.
- Props: instanced (rocks, salt spires, shrubs, turbines). Everything storm-proof readable at 200m.

## Key art & portraits (`generate_image`)

- Style block for ALL generated images: *"Stylised low-poly 3D illustration, warm flat shading, frontier-western solarpunk; sun-bleached salt-white desert, ochre dunes, teal glass formations, rust-red machinery; long shadows, dusty air; no text, no watermark, no logo."*
- Title key art: `public/images/title/keyart.jpg` (landscape).
- Loading/region concept art: `public/images/regions/<slug>.jpg`.
- Portraits (illustrated, head-and-shoulders, painted-not-photoreal): `public/images/characters/<id>.jpg`. Reference from HUD via the character JSON `portrait` field, loaded with `withBase()`.

## Motion

- UI transitions ≤180ms ease-out; menus fade+4px rise; no layout shift.
- Bike feel targets: hover bob ~2Hz at idle, drift lean ≤14°, boost FOV 60→74, hop land squash 90ms.

## Progression & world-life language (iteration 3)

- **Log toasts** (achievements): top-centre panel, amber border, teal kicker "LOG ENTRY
  UNLOCKED", amber-hot title, bone description; icon is a *shape glyph* from the HUD set
  (◆ ▲ ◉ ✦ ⟡ ▣ …), colour is decoration — never the only signal. 220ms slide-in, click to dismiss.
- **Logbook**: `/logbook` screen — stats panel (sand labels, amber-hot tabular values) beside
  an achievement grid; locked cards ghost at 55%, hidden story cards show `▯▯▯ signal not recovered`.
- **Ambient traffic**: NPC vehicles use the same flat-shaded prim language as the player bike;
  couriers wear rust/amber (Driftline), haulers ochre/grey deck with bone cargo (Guild), skiffs
  teal with bone sail panels (Choir). Under-glow planes in faction colour mark them at distance.
- **Portraits** (canonical): `public/images/characters/<id>.jpg` — illustrated low-poly
  head-and-shoulders, square crop, warm flat shading, long-shadow desert backdrop, painted finish.

## Mission/moment language (iteration 2)
- **Waypoint beams** colour by objective: amber default/`pickup`/`dropoff`/`race`; teal for escort/scout; danger-red `#E4572E` for chase/storm. HUD keeps shape+colour pairs (amber diamond objective, teal square convoy, rust triangle chase target, red disc storm on minimap).
- **Storm wall**: 3 nested open cylinder shells (sand `#C98F4E`→`#8A5335`, opacities 0.22→0.05) + churn band; screen tint = radial rust gradient from bottom; fog lerps sand and densifies with proximity.
- **Chapter cards**: full-screen violet-dark overlay, teal kicker "Chapter N", big salt display title, amber ◆◆◆ rule; dismissible with E/Enter/Esc.
- **Board ribbons**: chapter pips 26px; done = teal outline, current = solid amber with glow; locked postings dashed ghost rows with reason text in sand.
- **Fragile cargo bar** in the mission tracker: teal→red under 35%; payout note at completion.

## Economy & story-beat language (iteration 4)

- **Guild Exchange**: ledger sheet — big tabular outstanding figure (salt 42px), debt
  progress bar in ochre→amber, seal chip `◈` dashed sand while on the books → solid amber
  glow ring when CLEAR TITLE. Payment buttons chunky; "All I can" is the primary action.
- **Chapter outro**: same chapter-card language as intros, but the kicker is amber
  ("Chapter N complete — debrief") instead of teal; card gains a 1px amber top border.
  Debrief voice: past-tense, warm, one image + one hook forward.
- **Ending epilogue** (title screen): panel card under the tagline, teal kicker
  "LAST DELIVERY — MADE", amber-hot ending title, bone body text; also a teal-left-rule
  stanza on the credits screen.
- **Guild Gold paint** (`#FFC969` amber-hot) is an earned paint, never in the free row —
  unlocks with `debt.cleared`.
- **Region climate**: skylight should feel different per region — teal haze in the Choir
  crater, dusk violet in the canyon slalom, denser dry air at Mothersgate. Blends by
  proximity; the base day/night keyframes always dominate.

## Night riding (iteration 8)

- **Headlight**: automatic with `nightFactor()` (from Sky) — no manual toggle; it
  fades in through dusk (ramp `(nf − 0.12) / 0.35`). One shadowless spotlight
  (amber-white `#FFE0AE`, angle ~0.45, decay 1.5, peak intensity ~72), a nose
  lamp lens, and a whisper-faint additive beam cone (#FFD9A0, ≤0.06 opacity).
  Night ground should stay near-black violet with a warm pool reading 20–25 m
  ahead; the salt pan may clip briefly at point-blank — acceptable, headlights
  bloom. Never add a second shadow-casting light at night; lamps stay emissive.
- **Dev sky flag**: `?skyt=<0..1>` / `#skyt=<t>` (stashed to sessionStorage at
  bootstrap in main.tsx because SPA nav drops query/hash) pins the clock start —
  the canonical way to playtest night content, e.g. `/​#skyt=0.99`.

## World collection language (iteration 5)
- **Signal caches** (codex pickups): weathered tripod (`#5C4632` timber) holding a
  floating **lore-violet octahedron** `#9A86D0` (emissive, bob+spin), faint violet
  ground ring and a whisper-thin vertical glimmer so they read at range against the
  sky. Violet under-glow = the record/library glyph ⟡ and is reserved for codex
  finds — never used by mission markers (amber/teal/rust/red stay mission-only).
- HUD hint chip "⟡ faint signal · N m" in violet chip styling; minimap draws
  nearby uncollected caches as open violet diamonds. Toast on recovery uses the
  ⟡ icon — shape carries meaning (accessibility rule holds).
- **Codex reading pane**: 17px / 1.72 / 66ch measure, display-font `h3` section
  heads with a faint amber rule; category chips are glyph + colour (▲ field-guide,
  ◉ broadcast, ▣ tract, ✦ log, ⟡ record) — tuned in the Codex Reader Lab.
- Heading convention (documented once): `telemetry.heading` is a true bearing,
  0 = north (−z); world forward = (sin h, 0, −cos h). Camera, dust and HUD all
  follow this.

## Performance budgets

- 60fps mid laptop at Medium: pixelRatio ≤1.5, shadow 1024, scatter ≤ ~2k instances, fog-over-draw minimal, no per-frame allocations in the render or physics hot paths (module-level scratch objects only).

# Garage Shop Flow Lab — builder notes

**What it is.** Ketch's garage purchase flow rebuilt out-of-game on a scripted
wallet, side by side with a pristine mirror of the shipped `ui/GaragePanel`.
Built iteration 6 (demo1). `/lab/garage-shop-lab`.

**Why.** The shipped garage teaches nothing: disabled buttons carry no reason,
a purchase silently changes one number, the 8,000 cr bond only exists at the
Exchange, the swatch row marks 'selected' with a colour ring alone, and Tab
walks every swatch. The bench demonstrates each gap and closes it.

**Decisions.**
- The wallet (`wallet.ts`) is a pure-function mirror of the save store:
  PART_COSTS [400, 900, 1800], 3 levels, `payDebt` floor+clamp, and the
  debt-clears-title → Guild Gold rack rule. `checks.ts` logic suite asserts
  store parity (exact-balance buy, 1-cr-short denial, overpay clamp).
- BaselineShop reuses production class names (`.sheet.garage`,
  `.garage-part`, `.paint-swatch`…) so it renders exactly the shipped UI —
  the only override is `.gsl-stage .sheet { width:100% }` because `.sheet`
  is sized viewport-relative and lives inside a frame here.
- Buy affirm (tuned): counting wallet figure (`AnimatedNumber`, ease-out
  420 ms, reduced-motion → snap), amber box-shadow press
  (`--gsl-affirm-ms`), rotated FITTED ◈ stamp, newest pip pops after
  35% of the affirm + stagger. Unavailable buttons use `aria-disabled`
  (not `disabled`) so they stay focusable/clickable — clicking a denied
  button gives the 300 ms translateX shake + spoken reason; the reason is
  always on-card (tooltips are mobile-invisible).
- Debt callout placements: `ledger` (full Exchange-maths card in the grid,
  pays through the same wallet), `strip` (one-line ochre rule under the
  header), `none` (baseline behaviour). Default `ledger`.
- Swatch rack (tuned): roving tabindex — one tab stop, ←→↑↓ + Home/End
  inside, `aria-pressed` for selection, ✓ glyph + ring (shape + colour,
  never colour alone). Locked Guild Gold = dashed ghost cell with ▨,
  keyboard-discoverable via `aria-disabled`, reason narrated.
- A11y suite (`runDomChecks`) runs live against each mounted stage:
  baseline fails `disabled-why`, `deny-visible`, `shape`, `debt` by design —
  that diff is the pitch. Live-region check stays `pending` until you transact.
- Copy CSS exports rules named for the real garage classes with the knob
  values baked in — a superset paste into `ui.css`.

**If editing.** Keep wallet.ts maths byte-identical to store.ts when the
game's economy changes (the logic checks will catch drift). Sounds come
from the real `audio` engine (chime / low blip) so the audition is honest.
Concept art: `public/images/work/garage-shop-lab.jpg`.

/**
 * cssExport — assembles the tuned garage rules as a drop-in block for
 * src/ui/ui.css, with the knobs (affirm duration, pip stagger) baked in.
 * Names target the REAL garage classnames (.garage-part, .paint-swatch…)
 * so the paste is a superset, not a rename exercise.
 */

export interface CssKnobs {
  affirmMs: number;
  pipStagger: number;
}

export function buildCssExport(k: CssKnobs): string {
  return `/* ============ garage — tuned purchase flow (from /lab/garage-shop-lab) ============ */

.garage { --affirm-ms: ${k.affirmMs}ms; --pip-stagger: ${k.pipStagger}ms; }

/* part card: relative so the FITTED stamp can land on it */
.garage-part { position: relative; overflow: hidden; }
.garage-part-head strong { display: inline-flex; align-items: center; gap: 8px; }

/* the fitting affirm: brief amber wash + stamp press */
@keyframes garageBought {
  0% { box-shadow: 0 0 0 0 rgba(255, 180, 84, 0); }
  22% { box-shadow: 0 0 0 2px rgba(255, 180, 84, 0.75), 0 0 22px rgba(255, 180, 84, 0.35); }
  100% { box-shadow: 0 0 0 1px rgba(255, 180, 84, 0.15); }
}
.garage-part.bought { animation: garageBought var(--affirm-ms) ease-out; }

.garage-stamp {
  position: absolute; right: 12px; top: 10px;
  font-family: var(--font-display); font-size: 11px; letter-spacing: 0.22em;
  color: var(--amber-hot); border: 1px solid color-mix(in srgb, var(--amber) 70%, transparent);
  border-radius: 4px; padding: 2px 8px; transform: rotate(-6deg);
  background: color-mix(in srgb, var(--space) 70%, transparent);
  animation: garageStamp calc(var(--affirm-ms) * 0.5) cubic-bezier(0.2, 1.6, 0.4, 1);
  pointer-events: none; text-transform: uppercase;
}
@keyframes garageStamp {
  from { opacity: 0; transform: rotate(-6deg) scale(1.7); }
  to { opacity: 1; transform: rotate(-6deg) scale(1); }
}

/* pip stagger: the new level lights a beat after the deal closes */
.garage-pips i.on.garage-pip-pop {
  animation: garagePipPop 260ms ease-out backwards;
  animation-delay: calc(var(--affirm-ms) * 0.35 + var(--pip-stagger));
}
@keyframes garagePipPop {
  from { transform: scaleY(0.3); filter: brightness(2); }
  to { transform: scaleY(1); filter: none; }
}

/* denial: shake + on-card reason (tooltips are mobile-invisible) */
@keyframes garageDeny { 20%, 60% { transform: translateX(-2px); } 40%, 80% { transform: translateX(2px); } }
.garage-part.denied { animation: garageDeny 300ms ease-out; }
.garage-deny-reason { display: block; margin-top: 6px; font-size: 12px; color: var(--danger); }

/* buy button: primary when affordable, self-explaining when not.
 * aria-disabled (not disabled) keeps it focusable+clickable so users can
 * ask WHY — click gives the shake + spoken denial reason. */
.garage-buy { width: 100%; }
.garage-buy[aria-disabled="true"] { opacity: 0.62; }
.garage-buy[aria-disabled="true"]:hover { transform: none; border-color: var(--panel-border); }

/* swatches: selection is glyph + ring, never colour alone */
.paint-swatch.selected::after {
  content: "\\2713"; /* ✓ */
  color: var(--salt); font-weight: 700; font-size: 15px;
  text-shadow: 0 1px 3px rgba(20, 16, 31, 0.9);
}
.paint-swatch:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }

/* locked Guild Gold: discoverable ghost cell, reason on the label */
.paint-swatch.locked {
  cursor: help; opacity: 0.5; border-style: dashed;
  border-color: color-mix(in srgb, var(--amber) 45%, transparent);
  position: relative;
}
.paint-swatch.locked::after { content: "\\25A8"; /* ▨ */ color: var(--salt); opacity: 0.8; }

/* debt callout strip under the header (variant B) */
.garage-debt-strip {
  margin: 0 0 14px; font-size: 12.5px; color: var(--sand);
  border-left: 3px solid var(--ochre); padding-left: 12px;
}
.garage-debt-strip strong { color: var(--amber-hot); font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  .garage-part.bought, .garage-part.denied, .garage-stamp, .garage-pips i.on.garage-pip-pop { animation: none; }
}`;
}

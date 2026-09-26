/**
 * Handling Curve Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Handling Curve Lab',
  description:
    'An interactive tuning toy for the Driftline hover-bike feel. A figure-eight salt pan painted with readable grip zones — salt ×1.0, sand ×0.8, glass ×0.5 — that the real telemetry surface reports live while you ride. Live sliders (acceleration, top speed, grip per surface, drift-exit boost, hop impulse, boost economy) apply same-frame to a test bike driven by the shipping controller constants; the engine/handling/boost upgrade ladders (0–3) are drawn as pips directly on the bench curve graphs so designers can see the headroom between stock and maxed builds. A scrolling scope plots speed, lateral slip, the drift reward window and the boost meter; baseline reset and copy-settings-JSON make findings portable.',
  blurb:
    'Tune the shipping bike feel live on a figure-eight salt pan with painted grip zones — sliders apply same-frame, upgrade ladder pips sit on the curve graphs, and a scope strips speed / slip / drift window / boost.',
  tags: ['tool', 'feel', 'physics', 'tuning', 'r3f'],
  client: 'Driftline game feel',
  caseStudy:
    'Bike-feel arguments (“is glass too slippery?”, “does the boost ladder pay?”) were invisible without a shared rig. This bench keeps one rule — reuse the shipping controller (Bike.tsx constants and upgrade formulas, never a fork) — and exposes every constant as a same-frame slider, with the 0–3 upgrade ladders rendered as pips on the curve graphs so stock-to-maxed headroom reads at a glance. The eight-shaped pan is painted honestly: every colour on the ground is the grip coefficient the physics reports on the scope.',
};

export default meta;

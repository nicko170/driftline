/**
 * Upgrade Curve Sandbox — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Upgrade Curve Sandbox',
  description:
    'A feel-economy grapher for Ketch\'s garage. Tick upgrade pips for engine coils, gyro cage and boost cell and watch the ledger redraw: 0–100 km/h launch curves (throttle and boost tape, stock ghosted beside the current fit), terminal speeds, boost drain/recharge duty, the drift-exit kick curve — and what every step costs in Guild credits. A ghosted flat-shaded bike replays the scripted launch on a mini salt skidpad, with the 100 km/h gate pulled to wherever the current fit actually crosses. Stock/sport/gold presets, a flag-marked "dream" 0–5 ladder what-if, delta readouts vs stock, and a JSON export of the tuned constants — all computed from the exact numbers shipped in src/game/Bike.tsx.',
  blurb:
    'Garage feel-economy grapher: tick upgrade pips, watch launch / boost / kick / cost curves redraw against shipped Bike.tsx constants, with a ghosted skidpad replay and delta ledger vs stock. Stock · sport · gold presets, dream-ladder what-if, JSON export.',
  tags: ['tool', 'economy', 'upgrades', 'feel', 'canvas-2d', 'r3f'],
  client: 'Driftline game feel',
  caseStudy:
    'Every garage credit should feel bought, and "does it" was a vibes argument. This bench turns the shipped constants (accel 24+5e, vMax 36+3.5e, drag e^−0.55t, drain 0.26−0.035b, regen 0.07+0.02b, kick min(4.5, 2.4t)) into five ledger figures plus a physical replay, so a pip\'s worth is a picture: stock riders literally never see 100 km/h without boost (terminal 67), the launch curve sags when the tank runs dry, and the drift kick pays nothing for any spend — three findings you can read off the paper in one glance.',
};

export default meta;

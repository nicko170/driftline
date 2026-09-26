/**
 * Waypoint & Beacon Bench — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Waypoint & Beacon Bench',
  description:
    'Night-range marker test: every shipping mission marker (beam/diamond, convoy square, chase triangle, storm disc, collect cluster, race-gate trio) lined up on a distance-marked firing lane, cycling colourways and spacings, with a compositor-level colour-blindness simulation (SVG feColorMatrix over the live canvas) plus a per-marker CVD contrast matrix. Proves the accessibility rule with pixels: shape is the identity, colour is decoration.',
  blurb:
    'Line up every waypoint and beacon on a night range, swap colourways and distances, then run protan/deutan/tritan simulation to prove the shape-not-colour rule.',
  tags: ['hud', 'accessibility', 'cvd', 'r3f', 'markers'],
  client: 'Driftline accessibility strike team',
  caseStudy:
    'DESIGN.md promised colour-blind-safe markers (shape + colour, never colour alone) but nobody had looked at all nine markers under simulation at once. The bench renders the shipping geometry from MissionDirector.tsx on a night firing lane and applies Machado 2009 matrices as SVG feColorMatrix filters over the live canvas — so fog, glow and bloom are simulated too, not just flat swatches. A contrast matrix measures each marker against the night backdrop under all three deficiencies, and the hostile "ghost" colourway (hues collapsed to bone-grey) demonstrates that glyphs still uniquely name every marker when colour fails entirely.',
};

export default meta;

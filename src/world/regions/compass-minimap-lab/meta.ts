/**
 * Compass & Minimap Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Compass & Minimap Lab',
  description:
    'HUD navigation bench: a fake 1200 m pan with draggable waypoint/convoy/chase/storm anchors drives the real compass pill and projected waypoint diamond, four candidate minimap palettes with measured WCAG contrast, and a colour-blind-simulation strip proving the shape language. An invariant suite fuzz-tests the shipped formulas; tuned palettes export as JSON.',
  blurb:
    'Drag anchors on a fake pan; test compass ticks, marker clamping and four minimap palettes with live WCAG contrast and colour-blind proof.',
  tags: ['tool', 'hud', 'accessibility', 'canvas2d'],
  client: 'Driftline HUD team',
  caseStudy:
    'The HUD nav math (compass window, diamond clamp, minimap draw) lived untested inside HUD.tsx/CameraRig.tsx. This bench mirrors those exact functions, sweeps them with 4000-case fuzz checks, and renders every marker under deutan/protan/tritan matrices — settling the accessibility rule (shape + colour, never colour alone) with pixels, not promises.',
};

export default meta;

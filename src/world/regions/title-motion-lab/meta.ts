/**
 * Title Motion Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Title Motion Lab',
  description:
    'A motion bench for the screen every player meets first: the shipped TitleScreen rebuilt beat by beat — kicker, logo, tagline, epilogue panel, menu drumbeat, hint, colophon — with every delay, duration, rise and easing exposed as a token. The key art sits under three hand-cut SVG parallax strata that follow the pointer through one lerped rAF loop; a network simulator delays the brand faces (Chakra Petch/Sora) to warm-cache, broadband, salt-flat 3G or storm-static speeds so the flash-of-fallback-text can be judged honestly. A timeline readout draws every beat as a bar with menu-ready and settle budgets, and the export panel emits the finished timing tokens as CSS custom properties the shipped screen can adopt verbatim. Reduced motion is a first-class chip, not an afterthought.',
  blurb:
    'The title-screen entrance as a tunable instrument — key-art parallax strata, beat-by-beat menu choreography, epilogue reveal, font-swap states under simulated slow networks, and exportable CSS timing tokens.',
  tags: ['tool', 'motion', 'title', 'accessibility'],
  client: 'Driftline front-of-house',
  caseStudy:
    'The title screen ships static, and every future polish pass risked guess-timing. The bench rebuilds the exact shipped markup (same ui.css classes, same copy, same epilogue pipeline) so tuning lands where it ships. Entrance beats are pure CSS animations driven by per-beat custom properties — replay is a React remount, no animation library. Parallax is one rAF loop that lerps pointer offsets into two CSS variables and writes styles only past a 0.05px dead zone, parking entirely under prefers-reduced-motion. The font simulation is honest: a class forces the fallback stack until a timer lands the brand faces, so the FOUT is felt, not described. Export emits :root tokens plus a reduced-motion media block; budgets (menu actionable ≤1400ms, settled ≤3200ms) render as ✓/▲ glyph-and-colour chips, keeping the no-colour-alone rule.',
};

export default meta;

/**
 * Signal Cache Scout Bench — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Signal Cache Scout Bench',
  description:
    'Readability range for the exploration pickup that ships in SignalCaches.tsx — a weathered tripod holding a floating lore-violet octahedron with a whisper glimmer — lined up on a distance ladder against day, dusk and night backdrops plus a storm-dust filter. Live replicas of the shipping HUD hint chip (⟡ faint signal · N m) and the minimap open-diamond sit on top of the canvas so 3D beacon and 2D chrome are judged together; protan/deutan/tritan simulation (SVG feColorMatrix) and contrast tables grade the emissive, glimmer and ring thresholds while sliders tune them. Separability against every mission-marker colour is measured too, because violet is reserved for codex finds.',
  blurb:
    'Put the signal cache (tripod + violet octahedron) on a distance ladder against day/dusk/night and storm dust, tune its glow live, and grade it — plus its HUD chip and minimap diamond — with CVD simulation and contrast tables.',
  tags: ['exploration', 'readability', 'accessibility', 'cvd', 'r3f'],
  client: 'Driftline exploration & accessibility strike team',
  caseStudy:
    'DESIGN.md reserves lore-violet #9A86D0 for codex finds and forbids colour-only signage, but the cache pickup had never been audited end-to-end: the octahedron\'s emissive 1.5, the 0.09-opacity glimmer and the 13 m capture ring were tuned by eye on a sunny salt flat, and nobody had watched them against a dusk horizon, a night sky or a storm wall. This bench renders the shipping assembly from SignalCaches.tsx on a distance ladder that runs past the 340 m hail cutoff, swaps the sky for the real day/dusk/night keyframes from Sky.tsx, and lays sand-haze storm fog over the top. The shipping HUD chip and minimap diamond are rebuilt as live replicas — the chip even drops out past 340 m like the real store logic — so 3D beacon and 2D chrome pass or fail together, under Machado CVD matrices applied to the whole stage. Sliders for emissive, glimmer and ring opacity feed contrast tables that grade against honest bars, and the separation table proves the violet stays distinct from every mission colour — and when it nearly doesn\'t under deuteranopia, that the ⟡ glyph and open-diamond shape still name it.',
};

export default meta;

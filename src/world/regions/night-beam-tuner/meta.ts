/**
 * Night Beam Tuner — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Night Beam Tuner',
  description:
    'Lighting bench for DRIFTLINE night riding: the player-spec bike parked on a salt corridor between glass-canyon walls, its headlight riding real-time sliders — angle, intensity, decay, cutoff, aim, cone dust, lamp glow. An analytic scanline charts ground illuminance; export paste-ready props for src/game/Bike.tsx.',
  blurb:
    'Tune the headlight against a real night rig. Sky clock scrub, beam sliders, illuminance scanline, Bike.tsx-ready export.',
  tags: ['tool', 'lighting', 'night', 'r3f'],
  client: 'Driftline art direction',
  caseStudy:
    'Nail the DESIGN.md night rule — "read the road 20–30 m ahead without turning the salt pan into a searchlight pool" — by tuning the exact spotlight attenuation model the renderer uses, then copy the constants straight into the bike.',
};

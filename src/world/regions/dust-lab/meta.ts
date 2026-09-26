/**
 * Dust & Particle Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab-style cards.
 */
export const meta = {
  title: 'Dust & Particle Lab',
  description:
    'Particle sandbox: tune the driftline dust trail live — count, size, lifetime, turbulence and the salt/sand/glass surface colours — while a ghost hover-bike auto-laps a test circuit crossing all three pans. Exports the tuned constants as JSON ready to drop into src/game/DustTrail.tsx.',
  blurb:
    'Tune the bike dust trail live — count, size, lifetime, turbulence, surface colours — while a ghost bike laps salt, sand and glass pans. Copies tuned JSON.',
  tags: ['tool', 'particles', 'tuning', 'r3f'],
  client: 'Driftline art direction',
  caseStudy:
    'The game recycles one fixed Points buffer (src/game/DustTrail.tsx). This bench runs the same ring-buffer emitter with every constant exposed — plus the upgrade path (per-particle size / age fade / turbulence) as a custom shader — so feel gets dialled in before a rebuild.',
};

export default meta;

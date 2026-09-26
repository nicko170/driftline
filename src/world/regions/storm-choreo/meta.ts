/**
 * Storm Choreo — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Storm Choreo',
  description:
    'Storm-wall pursuit tuning sim for the DRIFTLINE storm objective: restage the run on a scrolling top-down tactical pan — shelter anchor, spawn offset, pursuit curve and wall radius on sliders — while a seeded Monte Carlo courier crowd (reaction delay, heading wobble, panic dodge, finite boost) flips survival probability live. Difficulty verdicts from POSTAGE RUN to FUNERAL WEATHER, min-face histograms, spectral replays with ghost ribbons, and one-click mission objective JSON straight into the content pipeline.',
  blurb:
    'Restage a storm run on a tactical pan and watch survival odds flip live over hundreds of seeded Monte Carlo couriers. Exports tuned mission objective JSON.',
  tags: ['tool', 'simulation', 'storm', 'mission-design', 'canvas2d'],
  client: 'Driftline mission team — ch3/ch5 storm objectives',
  caseStudy:
    'The shipped storm (src/game/MissionDirector.tsx) hunts the player at 23 m/s with a rubber-band kick, a 150 m face and a 460 m spawn-back — good numbers that had never argued for themselves. This bench runs the exact pursuit math against a noisy courier stand-in, hundreds of trials per slider move, and grades the result so ch3-first-wall can ship tense-but-fair and ch5-storm-of-storms can ship bloody on purpose.',
};

export default meta;

/**
 * Storm Front Sandbox — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Storm Front Sandbox',
  description:
    'A wall-of-sand simulator for tuning the chapter 3 and 5 storm missions: a rolling storm front — curved fog shells plus a churning particle sheet — hunts a simple hover-bike across a dusk pan while speed, rubber-banding, radius, wall height, density and turbulence are all live-editable. Reach the shelter arch before the face crosses you; copy the tuned constants straight into src/game/MissionDirector.tsx.',
  blurb:
    'Tune the hunting sand wall live — speed, density, turbulence, wall height — and try to outrun it to the shelter arch on a simple bike. Copies tuned JSON.',
  tags: ['tool', 'simulation', 'storm', 'tuning', 'r3f'],
  client: 'Driftline ch3/ch5 storm missions',
  caseStudy:
    'The shipped storm (src/game/MissionDirector.tsx) chases the player at 23 m/s with a rubber-band kick and a 150 m wall radius, rendered as three counter-rotating fog shells. This bench runs the same hunting math with every constant exposed — plus the upgrade path (turbulent particle sheet, wind streaks, density-scaled fog bloom, procedural rumble) — so ch3/ch5 storm beats can be felt and dialled before a rebuild.',
};

export default meta;

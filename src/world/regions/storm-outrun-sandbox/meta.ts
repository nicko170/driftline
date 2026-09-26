/**
 * Storm Outrun Sandbox — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Storm Outrun Sandbox',
  description:
    'A storm-mission tuning stage: a scripted ghost courier (stock Bike.tsx feel constants) rides a fixed 1160 m salt-pan course to a shelter arch while the shipping StormWall hunts it with the exact MissionDirector formula. Every storm constant is live — chase base speed, rubber-band reference/gain/cap, spawn-back distance, wall radius, plus the Sky fog ramp, the HUD screen-tint ramp and the audio setStorm wind mix. Pass A always runs shipped constants, pass B the candidate sliders; both are evaluated as deterministic tapes and replayed side-by-side as ghost lines on a tactical track map, while the 3D stage plays either pass (or both walls at once). A WCAG contrast table audits the storm chip and danger disc against the screen-tint overlap at four face distances. Exports a JSON spec whose keys map 1:1 onto MissionDirector / Sky / HUD / audio storm parameters.',
  blurb:
    'Scripted ghost courier vs the shipping StormWall on a dusk pan — tune chase, rubber-banding, spawn distance, fog ramp, screen tint and wind mix live; A/B both passes as ghost lines; export 1:1 MissionDirector JSON.',
  tags: ['tool', 'storm', 'tuning', 'mission-director', 'feel', 'r3f'],
  client: 'Driftline mission team — ch3/ch5 storm objectives',
  caseStudy:
    'Three sibling benches cover the storm’s edges: storm-front-sandbox lets you *ride* the wall, storm-choreo Monte-Carlos the mission math, storm-wall-tuner look-devs the shells. None answered the question a mission designer actually asks: “if I change these numbers, does a *plausible* courier live?” This bench fixes the rider instead of the player — a scripted ghost on stock bike constants over a fixed course — so two fully deterministic tapes (A shipped, B candidate) can be replayed side-by-side as ghost lines and compared by escape margin, not vibes. The same knob set also drives the shipped fog ramp, screen tint and wind mix, and a contrast table guards HUD legibility while those get tuned. The copy-out JSON maps 1:1 onto the shipped storm parameters.',
};

export default meta;

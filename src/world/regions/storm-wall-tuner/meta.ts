/**
 * Storm Wall Tuner — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Storm Wall Tuner',
  description:
    'Storm wall look-dev bench: the shipping wall (nested fog shells, churn band, fog ramp, screen tint) staged on a fixed rail with scrubbable face proximity, time-of-day and quality presets. A 64² readback measures real screen coverage and translucent stack depth while you tune shell count, opacity falloff, colour ramp, wobble and particle density — then "Copy constants JSON" emits drop-in blocks for src/game/MissionDirector.tsx, Sky.tsx and the HUD tint, plus per-quality budgets.',
  blurb:
    'Look-dev the storm wall on rails: scrub proximity and time-of-day, measure overdraw on a live readback, export tuned constants JSON for MissionDirector/Sky/HUD.',
  tags: ['tool', 'look-dev', 'storm', 'vfx', 'overdraw', 'r3f'],
  client: 'Driftline ch3/ch5 storm missions — art & perf',
  caseStudy:
    'Three sibling benches cover the storm: storm-front-sandbox tuned how it hunts, storm-choreo tuned the mission math, this one tunes how it *looks* and what it costs. The wall is pinned to a rail so proximity, time-of-day and quality presets are scrubbable without riding; a 64² readback on a storm-only layer measures screen coverage and translucent stack depth live, because translucent shells are the frame-time risk. Exported JSON maps 1:1 onto the shipped fog ramp (Sky.tsx), screen tint (HUD) and shell stack (MissionDirector.tsx).',
};

export default meta;

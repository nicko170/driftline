/**
 * Demo/lab metadata for the slalom region. The world registry itself reads
 * meta.json + anchors.json; this file documents the module for tooling.
 */
export const meta = {
  title: 'Canyon Slalom Time Trial',
  blurb: 'An eight-gate slalom down the Glass Road canyon: slick teal glass, amber gates, dusk light.',
  description:
    'A race venue streamed into the open world: a ~1.6 km time-trial course down the fused-glass ' +
    'canyon of the Glass Road. Paired rust pylons and holo diamonds mark a weaving line over the ' +
    'lowest-grip surface in the game, teaching boost-and-drift control. Start/finish gantries, a ' +
    "timing marshal's post and a spectator ledge dress the course; every gate is a named anchor so " +
    'race missions can reference them as checkpoints.',
  tags: ['region', 'race', 'time-trial', 'canyon', 'instancing'],
  client: 'DRIFTLINE — the Driftline courier league (in-world)',
  caseStudy:
    'Converted a standalone time-trial brief into a streamed world region so the same slick canyon ' +
    'serves free-roam, story missions and race contracts. All gate positions derive from the shared ' +
    'Glass Road polyline, so anchors, visuals and Rapier colliders never disagree. Pylons, caps, ' +
    'crossbars and chevrons are three instanced draws; the only per-frame work is eight rotating ' +
    'diamond markers.',
};
export default meta;

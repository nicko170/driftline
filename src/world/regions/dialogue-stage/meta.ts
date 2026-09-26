/**
 * Dialogue Stage — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Dialogue Stage',
  description:
    'A dialogue-scene staging bench for DRIFTLINE writers. Cast any of the 20+ characters from src/content/characters (portraits, voice notes and line buckets included), write the offer / accept / complete beats plus an optional flag-setting choice, and watch the scene play in a pixel-honest copy of the in-game dialogue box — at phone, handheld and wide frame sizes against day, dusk and night desert backdrops. Playback auto-advances at a readable pace with a per-line progress bar; a lint pass flags unknown speakers, blank lines, over-long speeches and flag-less choice options; the exporter emits a paste-ready "dialogue" block that matches the mission schema exactly. Existing missions can be pulled in straight from src/content/missions and re-staged.',
  blurb:
    'Write, time and stage a dialogue scene in the real in-game dialogue box — all characters, three frame sizes, day/dusk/night backdrops, lint pass, and a copy-the-JSON export.',
  tags: ['tool', 'dialogue', 'writing', 'react'],
  client: 'Driftline writer’s room',
  caseStudy:
    'Dialogue in DRIFTLINE ships as hand-written JSON inside mission files (`dialogue.offer/accept/complete/choices`), and until now nobody saw a line until they booted the game, accepted the mission and clicked through it. Width bugs hid in phone viewports (the box sizes to 94vw), nobody could feel the pacing of an eight-line block, and the choice flags were typo-prone. The stage renders the dialogue with the game’s own CSS on three frame widths standing in for viewports, plays the scene at an adjustable reading speed with real per-line timing maths, lints against the same floors a writer would hit at validate-time (unknown speakers, blank text, sprawl), lets any shipped mission be imported for surgery, and exports the edited scene as schema-shaped JSON the writer pastes straight back into the mission file.',
};

export default meta;

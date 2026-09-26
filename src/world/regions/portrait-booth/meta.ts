/**
 * Portrait Booth — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Portrait Booth',
  description:
    'A contact-sheet viewer for every Driftline character: a filterable grid of painted portraits with faction-coloured framing, a lightbox carrying bio, voice notes and sample lines, and a re-roll prompt composer that stitches each character\'s canonical appearance text into the shared art style block — so a missing or stale portrait can be re-generated with one copy. Doubles as a live art-gap tracker: declared-but-missing art flags itself in the wall.',
  blurb:
    'Every Driftline face on one wall — portraits, voice notes, faction framing, and a one-copy prompt composer for re-rolling missing art.',
  tags: ['tool', 'art', 'characters', 'react'],
  client: 'Driftline casting office',
  caseStudy:
    'Portraits are painted by parallel workers against characters/*.json, so the wall and the art drift apart: frames reference files that don\'t exist yet (or ever). The booth reads the character library directly, colour-frames each entry by faction, detects declared-but-missing files at load time, and composes the exact re-roll prompt (shared style block + appearance text) with a copy button — turning an art-gap audit from a grep-and-guess chore into a wall you can walk.',
};

export default meta;

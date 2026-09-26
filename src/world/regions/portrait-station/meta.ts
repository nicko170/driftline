/**
 * Portrait Station — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Portrait Station',
  description:
    'The character-art quality booth for DRIFTLINE\'s forty-plus painted portraits. Every face from src/content/characters hangs on Ketch\'s pegboard wall and runs through automated canvas readback QC: a luminance histogram graded against the warm-key band, saturation and hue drift measured against the sitter\'s faction palette chip (guild ochre, choir teal, reclaimer rust, driftline amber, independent bone), an edge-contrast silhouette readability score, and the real 64px dialogue-card crop exactly as shipped — plus a grayscale accessibility pass with Vienot (1999) deutan/protan/tritan simulations. Two portraits grade side-by-side with deltas, a context hang shows the portrait beside three same-faction wall neighbours and flags pairs that read alike from the door, and the shot-list desk drafts a corrective generate_image prompt from the character\'s appearance/voice JSON whenever a sitting needs a repaint.',
  blurb:
    'Every painted portrait on the pegboard, graded by real pixel readback — warm-key histogram, faction-palette drift, silhouette score, the true 64px crop, a CVD pass, side-by-side grading and a paste-ready re-sitting shot list.',
  tags: ['tool', 'art', 'characters', 'qc', 'canvas'],
  client: 'Driftline casting office',
  caseStudy:
    'Portraits are painted in parallel against characters/*.json, and until now QC was a savvy eyeball: nobody could say whether a face sat in the warm key, whether a Choir portrait had drifted Guild-ochre, or whether the likeness survived the 64px dialogue crop until a player opened the box. The station reads each JPEG through an offscreen canvas and grades what the game will actually show: a 16-bin luminance histogram against the warm-key window, chroma-weighted hue drift versus the canonical faction chip, a Sobel edge-density plus ring-versus-centre separation score for silhouette readability, and a 64px cover-crop legibility check with grayscale and Vienot-matrix CVD passes. Side-by-side grading settles "which sitting do we keep", the context hang catches two portraits that read identical from across the garage, and every warn or fail photocopies itself into a corrective line on the shot list the painter pastes straight into the paint tool.',
};

export default meta;

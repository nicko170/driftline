/**
 * Roster Review Bench — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Roster Review Bench',
  description:
    'A content-review instrument for the writing team: every character JSON rendered as its true in-game dialogue card — portrait (or initials fallback), faction chip, role, and greeting/bark/mission/radio lines shuffled on a timer — beside a live stage that mounts the actual DialogueBox and HUD radio ticker through the real game store. Faction filters and name search on top; cards missing portraits, or carrying fewer than eight lines, redraw themselves as dashed ghost frames with a ▯ signal-not-recovered marker. Shape carries every warning — colour never stands alone.',
  blurb:
    'Every voice on the Driftline rendered as its real dialogue card — cycling lines, live DialogueBox + radio ticker, and ghost-frame flags for missing art or thin sheets.',
  tags: ['tool', 'writing', 'characters', 'review'],
  client: 'Driftline writing desk',
  caseStudy:
    'Mission JSONs reference characters by id, and the writing team needed to judge how a voice actually lands in the box — not how it reads in an editor. The bench reads the live character library, renders each card with the game\'s own CSS classes and portrait pipeline, shuffles one line per bucket on a shared tick so the wall never goes static, and mounts the unmodified DialogueBox and radio ticker through the real zustand store so overflow, fades and key handling are the shipped behaviour. Audit rules (missing/portrait 404, under eight lines, empty core bucket) repaint a card as a dashed ghost frame with a ▯ marker — the wall doubles as a completeness report.',
};

export default meta;

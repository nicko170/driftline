/**
 * Codex Reader Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Codex Reader Lab',
  description:
    'A typography reading-room for the Courier\'s Codex. Every lore entry from src/content/lore sits on a filterable, searchable shelf with a live lint pass (words, sections, summaries — the same floors the content validator enforces). The reading pane typesets the selected entry live: size, leading, measure and tracking sliders, Sora/serif faces, and three decorative sheets — the tuned night panel, a salt-white day paper, and a printed Salt Guild ledger form complete with form number and received stamp. A compare mode splits the page against an honest render of what the codex ships today, and a copy-CSS button exports the tuned values back to the real .codex-reading pane.',
  blurb:
    'Typeset the codex live: measure, leading, size and face on a night sheet, day paper or printed Guild form — with a lint pass over all 60+ entries and a copy-the-CSS export.',
  tags: ['tool', 'typography', 'codex', 'react'],
  client: 'Driftline reading room',
  caseStudy:
    'The codex grew past sixty entries before anyone read two of them back to back: the shipped pane prints markdown raw (## headings and asterisks show as literal characters), pins one 15px/1.65 style with no measure cap, and offers no way for writers to see their entries the way players will. The lab reads the real library module, mirrors the shipped rendering verbatim for a split "current vs tuned" compare, and turns the typography decisions — measure band, line pitch, face, sheet flavour — into sliders with the verdict maths (comfort-band measure, read time) printed alongside, so the fix is argued over a page, not a pull request.',
};

export default meta;

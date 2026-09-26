/**
 * Rep Ledger Bench — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Rep Ledger Bench',
  description:
    'A balance-review instrument for the reputation economy. Reads every mission JSON live and renders the rep economy as a field-survey chart: chapter-to-faction flow ribbons on canvas2d (Salt Guild ochre ◆, Choir teal ◉, Reclaimers rust ▲, Driftline amber ✦ — glyph + colour, never colour alone), standing-tier rails from wary to kin with story-only vs completionist markers, a net-rep-per-chapter waterfall, and faction-journey sparklines for a playthrough that does everything. Flags factions stranded below their next rail and story missions whose rep deltas fight each other across a feud line, and exports a copy-paste rebalance table for the writers\' ledger.',
  blurb:
    'The whole reputation economy drawn as a field-survey chart — chapter-to-faction flow ribbons, tier rails, a per-chapter waterfall, completionist sparklines, stranded-faction flags and a copy-ready rebalance table.',
  tags: ['tool', 'balance', 'reputation', 'missions', 'factions'],
  client: 'Driftline balance desk',
  caseStudy:
    'Mission JSONs pay reputation across four factions, but nothing showed whether the numbers add up to a legible world: whom the story alone can befriend, whom only side jobs can, and which deliveries quietly pay both sides of a feud. The bench reads the live mission library, models a story-only and a completionist playthrough, and draws the answer four ways on canvas2d — a chapter-to-faction flow sheet, threshold rails with story-vs-completionist markers, a per-chapter waterfall on one shared scale, and completionist journey sparklines against tier bands. Audit rules fire as shape-marked flags: factions that can never reach kin even at 100%, factions the story leaves below friendly, and story missions paying ≥5 rep to both ends of a tension pair. A one-click export copies the whole ledger as a rebalance table for the writers\' shared sheet.',
};

export default meta;

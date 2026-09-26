/**
 * Cache Density & Fan-Out Planner — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Cache Density & Fan-Out Planner',
  description:
    'A top-down survey sheet for the signal-cache collection layer: all 100+ caches plotted at the exact positions caches.ts resolves for them — golden-angle fan-out (2.399963 rad, r = 5 + k·2.2 m) with true 13 m capture discs — over a marching-squares contour survey of the real shared heightfield. Region filter chips in faction colours, teal nearest-neighbour threads between anchors, ghost rings showing where the next fan slots would land, and amber ▲ / red ■ crowding warnings (shape pips, never colour alone) past the DESIGN.md thresholds of 6 and 10 per anchor. Paste a new caches.json row and it pins onto the sheet live with full validation (unique id, existing lore slug, on-world anchor) so writers can watch a placement land, push an anchor over a threshold, or clear a cross-anchor overlap before they commit. Click any diamond for a codex-styled reading card with the entry, its fan slot, and its spacing verdict.',
  blurb:
    'The whole signal-cache layer on one survey sheet: real fan-out positions, true capture discs, crowding pips, ghost slots — paste a caches.json row and watch it land before you commit it.',
  tags: ['tool', 'qa', 'exploration', 'svg', 'react'],
  client: 'Driftline exploration & content QA strike team',
  caseStudy:
    'The signal-cache layer passed 115 caches across 9 regions with placement driven entirely by a deterministic fan-out formula — but nobody had ever seen all of them at once. Saltmouth\'s exchange anchor quietly accumulated 10 caches (outer ring at 27 m, capture discs stacking into a single sweep zone) while whole anchors in Drowned Array sat empty; the content validator checks slugs and uniqueness, not geometry. This planner replays caches.ts exactly (with a live parity check against the shipped resolver), draws every capture disc at true metres over honest terrain contours, grades crowding against the DESIGN.md thresholds with shape-first warnings, finds cross-anchor overlaps where one ride-through would trip two entries, and lets a writer paste a candidate row and see the sheet re-light — warnings, threads and ghost slots recomputing — before the row ever touches content/caches.json.',
};

export default meta;

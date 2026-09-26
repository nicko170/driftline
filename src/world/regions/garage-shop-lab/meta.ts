/**
 * Garage Shop Flow Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Garage Shop Flow Lab',
  description:
    'Ketch\'s garage purchase flow rebuilt out-of-game on a scripted wallet. Audition every buy-button state (affordable / need-more / fitted), a tuned buy-affirm animation with a counting wallet, staggered level pips and a FITTED stamp, three debt-callout placements (ledger card, header strip, none), and the paint swatch grid — including the locked Guild Gold cell — at phone, tablet, laptop and full widths. A DOM-driven keyboard-a11y pass runs live against both the shipped baseline and the tuned rebuild side by side, and a copy-CSS button exports the tuned rules, ready for ui.css.',
  blurb:
    'Rebuild the upgrade shop on a scripted wallet: buy-affirm animation, debt callout, paint grid at phone→desktop widths, live a11y pass, copy-CSS export.',
  tags: ['tool', 'ui', 'economy', 'a11y', 'react'],
  client: "Ketch's Garage / Salt Guild Exchange",
  caseStudy:
    'The shipped garage (ui/GaragePanel.tsx) works but teaches nothing: a disabled button says nothing, a purchase changes one number silently, the 8,000-credit bond is invisible until you visit a different building, and the swatch row loses its selection the moment it unfocuses. This bench runs the pristine baseline beside a tuned rebuild on one scripted wallet, so every gap is demonstrated rather than argued — disabled buttons that explain themselves, a count-down wallet plus pip stagger and stamp as the buy-affirm, an inline ledger with the Exchange payment maths, roving-tabindex swatches with arrow keys and an aria-live receipt line. The a11y suite scores both variants live so the diff is quantified, and Copy CSS hands the fix back to the game as a drop-in block.',
};

export default meta;

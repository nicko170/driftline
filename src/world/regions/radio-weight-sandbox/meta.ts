/**
 * Radio Weight Sandbox — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Radio Weight Sandbox',
  description:
    'Tuning bench for the shipped band-weighted radio chatter (HUD pickRadioVoice). Step onto a night salt flat soundstage — one amber-lit relay mast ringed by teleport plinths, one per on-world band — pick a band, set simulated faction rep, roll a hundred imaginary transmissions, and watch the observed histogram lean against the theoretical weights. Locals should speak loudest at home; rep favourites should earn airtime; long-range voices should never quite go silent. One desert, one sky.',
  blurb:
    'A relay mast on a night pan, ringed by plinths — one per band. Pick a band, fake some rep, roll a hundred chatter picks and check the histogram against the math.',
  tags: ['radio', 'chatter', 'weights', 'reputation', 'lab-bench'],
  client: 'DRIFTLINE — dispatch relay audit (in-world)',
  caseStudy:
    'The bench re-implements the exact shipped weight math (base 1, +6 home-band, +1 Driftline lifers, +min(8, rep×0.12) faction favour) against the live character and region registries, then samples it with the same cumulative-walk pick the HUD uses. Stacked theoretical bars (bone base / amber home-band / teal lifers / rust rep) sit beside hatched observed bars, with a 3σ noise band so a tuner can tell signal from dice weather. Zero store coupling — rep is simulated, never written.',
};
export default meta;

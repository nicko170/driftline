/**
 * Cargo Shake Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Cargo Shake Lab',
  description:
    'A tuning bench for the fragile-cargo system: a ghost hover-bike runs canned bump sequences (small rock, gantry leg, hard landing, storm clip, full gauntlet) down a salt test pan while a large cargo-integrity gauge, a damage-per-impact scatter chart and the payout curve update live. Sliders drive the shipped constants — FRAGILE_DMG, impact threshold, shield soak per level — presets capture story-balance / punishing / forgiving, and a ghost replay A/Bs a stashed param set against the current one on the same deterministic course. Exports the chosen preset as JSON for MissionDirector tuning.',
  blurb:
    'Tune fragile-cargo damage on a ghost-bike test pan — scripted bumps, live integrity gauge, impact scatter and payout curve, ghost A/B replay, copy-JSON export.',
  tags: ['tool', 'balance', 'missions', 'economy', 'r3f'],
  client: 'Driftline mission tuning',
  caseStudy:
    'The fragile-cargo chain ships as three constants split across two files (Bike.tsx absorbs 9 m/s plus 6 per shield level; MissionDirector.tsx multiplies what’s left by 0.012 and pays 0.35 + 0.65 × integrity). Nobody could answer “how much should a gantry clip cost?” without playing a full delivery. This bench mirrors the chain exactly, drives it with deterministic scripted hits, and makes the trade-offs visible: the scatter chart shows which impacts even register, the payout curve shows where a sequence lands, and the ghost replay makes a proposed change arguable in one run instead of one playtest.',
};

export default meta;

/**
 * Ending Choice Rehearsal — demo meta. Demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Ending Choice Rehearsal',
  description:
    'A rehearsal stage for the Chapter 5 finale: the choice at the Door that sets ending.rain or ending.quiet. One scrollable timeline mounts the shipped dialogue box (the real threshold scene from ch5-last-delivery, choices wired straight into the live save flags), the shipped chapter-outro debrief card, and the title-screen epilogue panels reading the store in real time. Two doors of light — teal-blooming with the ⟡ record glyph versus amber-quiet with ◉ — set the scene; a slow-read mode types each epilogue at broadcast pace over a procedural radio-static bed; an audience strip live-probes which achievements and gated missions each ending retro-unlocks; and a flag-integrity audit statically scans every mission JSON and dialogue choice tree to prove no content can set both endings, that setters stay in chapter 5, and that the two endings keep exactly their canonical sources.',
  blurb:
    'Rehearse the Last Delivery: two doors of light, the shipped choice dialogue wired to live flags, both epilogues typed at broadcast pace over radio static, an audience strip of retro-unlocks, and a static audit proving no mission can set both endings.',
  tags: ['tool', 'writing', 'story', 'endings', 'react'],
  client: 'Driftline writer’s room — Chapter V desk',
  caseStudy:
    'Ending flags are the most expensive typo in the game: set ending.rain and ending.quiet from the same mission and the title screen silently picks one, forever, in someone’s hundred-hour save. Before this stage, the only way to see an epilogue was to play five chapters, and the only way to check flag hygiene was eyeballing sixty-plus JSON files. The rehearsal mounts the shipped components — DialogueBox with the real ch5-last-delivery threshold scene and choices, ChapterOutroCard for the chapter five debrief, the title-screen epilogue aside — against a store snapshot so every experiment can be rolled back, and the flags flip in the actual save so every consumer (title screen, credits stanza, achievements) updates live. The audit treats src/content/missions as the source of truth and fails loudly on the five ways endings go wrong: dual setters, setters outside chapter 5, a missing ending, a duplicated choice option, or a mission that requires a flag it also sets. The audience strip probes the shipped achievement predicates with and without each flag — so when a writer adds rain-gated post-game content next season, the strip lights up without a line of bench code changing.',
};

export default meta;

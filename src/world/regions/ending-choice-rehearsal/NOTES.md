# Ending Choice Rehearsal — bench notes

Demo-region (off-world bench, centre [8200, 7600]) for the Chapter 5 finale moment: the
choice that sets `ending.rain` / `ending.quiet`.

## What ships here

- **REEL 01 — Doors of light.** DOM/CSS art: teal-blooming door with the ⟡ record glyph
  vs amber-quiet door with the ◉ broadcast glyph (shape-first; colour decorates).
  Sets which ending the reader broadcasts.
- **REEL 02 — Shipped DialogueBox** (`src/ui/DialogueBox.tsx`), fed the real
  `ch5-last-delivery` completion scene + its real choice from the mission library.
  Option clicks call the store's real `setFlags`, so every downstream consumer
  (title screen, credits stanza, achievements) updates live.
- **REEL 03 — Shipped ChapterOutroCard** (`src/ui/ChapterOutroCard.tsx`), raised for
  chapter 5. The card's intro-hold gate (`chaptersSeen`) is satisfied via the
  snapshot rail; dismissing restores through the same rail.
- **REEL 04 — Epilogue panels.** Mirrors the TitleScreen aside markup verbatim,
  live on `save.flags`. The broadcast-pace **slow-read reader** types ep.text +
  ep.coda with punctuation breathing (`tokenizeForBroadcast`) over a procedural
  radio-static bed (`static.ts` — own AudioContext, honours save volume, dies on
  unmount; the game's audio engine is untouched).
- **REEL 05 — Audience strip.** Achievements are *live-probed*: every shipped
  predicate runs twice (save minus flag / plus flag) and defs whose result flips
  are reported — cross-fire shows up for free. Ending-gated missions
  (`requires.flags` contains the flag) are the reserved post-game hook.
- **REEL 06 — Flag-integrity audit.** Static scan of all mission JSON + choice
  trees: no dual setters, chapter-5-only setters, both endings reachable, no
  duplicate option per choice, no self-gated missions.

## Snapshot guard

Any staging action (scene, outro card, flag flips) first takes a snapshot of
`flags` / `chaptersSeen` / `outrosSeen` / `mode`. **Strike the set** restores it;
on unmount the snapshot auto-restores unless "keep staged flags in my save" is
checked. Open rehearsal dialogue / outro cards are always closed on unmount so
nothing leaks into `/play`.

## Deliberate choices

- Both flags CAN be set simultaneously from the console — that's the failure mode
  being rehearsed against; the console shows a warning chip and the audit explains
  why shipped content can't do it (title screen resolves rain first via
  `endingFor` scan order).
- Concept art: `public/images/work/ending-choice-rehearsal.jpg`.

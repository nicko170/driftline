# Codex Reader Lab — builder notes

**What it is.** A typesetting bench for the Courier's Codex. Reads the real
`src/codex/library.ts` (all entries, unlock state ignored — it's a workshed),
renders the selected entry live, and answers the question "is 120 entries of
lore actually pleasant to read?"

## Features

- **Typesetting sliders** — size (14–22px), leading (×1.35–2.05), measure
  (44–86ch), tracking (−0.02–0.04em). Persisted to localStorage
  (`dl.codex-reader-lab.settings`).
- **Faces** — Sora (UI body) vs a ui-serif stack, for the "printed page" feel.
- **Sheets** — ◈ Night sheet (codex dark panel, tuned), ▤ Day paper
  (salt-white page), ▣ Guild form (decorative printed ledger: form number
  derived from the slug, received-stamp, filing footer). Glyph + label chips,
  never colour alone.
- **Compare** — split view vs an *honest* baseline: 15px/1.65/max-width none,
  body rendered raw exactly like `CodexScreen` (so `##` and `*` print as
  literal characters). The tuned pane parses markdown-lite (`## ` → h3,
  `**bold**`, `*italic*`, single newlines → `<br/>`), no dangerouslySetInnerHTML.
- **Lint strip** — same floors as `scripts/validate-content.mjs`: ≥250 words,
  a `## ` section, a summary. Header tally + per-entry flags; the
  "⚠ Needs attention" chip filters to flagged entries.
- **Stats read-out** — words, sections, read time @210wpm, line pitch in px,
  and a measure verdict (comfort band 50–78ch).
- **Copy CSS** — exports the tuned values as drop-in rules for
  `.codex-reading`, clipboard API with legacy textarea fallback.
- Shelf: category chips, search, ↑/↓ navigation between filtered entries.

## Findings for the app builder (WARN, not patched — lab touches no game code)

1. `CodexScreen.tsx:53` renders lore bodies as raw paragraph text. Every lore
   file uses `## ` section headings (the validator *requires* one) and
   `**bold**`/`*italic*` — players see the raw markdown characters. The
   `renderTunedBody` parser in `./data.ts` is 40 lines, dependency-free, and
   safe to lift into the codex.
2. `.codex-reading` has no measure cap — on wide screens body text runs the
   full pane width (1,000px+ ≈ 150ch). The comfort band is 50–78ch; the
   Copy-CSS export emits exactly the patch.
3. Lore count is 68+ and climbing toward 120; `.codex-list` has no search or
   category filter. The shelf here (chips + search + keyboard step) is a
   drop-in pattern.

## Region contract

Off-world bench: `meta.json` center `[7400, 7400]`, radius 4; two decorative
anchors. Default export carries `meta`/`anchors` statics; named `meta` export
lists it under `/lab`. No Props — the game streams nothing from it.

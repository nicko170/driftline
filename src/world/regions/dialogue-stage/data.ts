/**
 * Dialogue Stage — shared model. Scene script blocks (offer/accept/complete),
 * the cast list from the real dialogue library, reading-speed timing maths,
 * a lint pass, mission import adapters, and the exporter that emits a
 * paste-ready `dialogue` block matching the mission schema in
 * .ralph/ROUTES.md.
 *
 * The bench is toolchain-free and self-contained: it borrows the *types* and
 * the *data* of the game (characters, missions) but none of its runtime
 * state, so parallel builders can't break it and it can't break them.
 */
import { characters } from '../../../dialogue/library';
import { missions } from '../../../missions/library';
import type { Character } from '../../../dialogue/library';

/* ---------------- script model ------------------------------------------- */

export type BlockKey = 'offer' | 'accept' | 'complete';

export const BLOCKS: { id: BlockKey; label: string; hint: string }[] = [
  { id: 'offer', label: 'Offer', hint: 'Board-hook — the pitch, before they take it' },
  { id: 'accept', label: 'Accept', hint: 'Post-accept beats — instructions, radio check-ins' },
  { id: 'complete', label: 'Complete', hint: 'Hand-off — the debrief and the hook forward' },
];

export interface Line {
  who: string;
  text: string;
}

export interface ChoiceOption {
  text: string;
  setsFlag: string;
}

export interface Script {
  blocks: Record<BlockKey, Line[]>;
  choicesOn: boolean;
  choices: { prompt: string; options: ChoiceOption[] };
}

export const FACTION_ORDER = ['driftline', 'guild', 'choir', 'reclaimers', 'independent'];

/* glyph + colour pairs — never colour alone, per DESIGN.md */
export const FACTION_META: Record<string, { label: string; glyph: string; color: string }> = {
  driftline: { label: 'Driftline', glyph: '▸', color: '#FFB454' },
  guild: { label: 'Salt Guild', glyph: '▣', color: '#D9A45B' },
  choir: { label: 'Choir', glyph: '◉', color: '#57C4B8' },
  reclaimers: { label: 'Reclaimers', glyph: '▲', color: '#B3502E' },
  independent: { label: 'Independent', glyph: '✦', color: '#E4D7BE' },
};

export interface CastEntry {
  character: Character;
  hasPortrait: boolean;
  lineCount: number;
}

/** Featured contacts first, then everyone else alphabetically. */
export const CAST: CastEntry[] = (() => {
  const featured = ['ash-varga', 'ketch', 'tamsin-cho', 'cantor-ilex'];
  const all = [...characters.values()].map((c) => ({
    character: c,
    hasPortrait: Boolean(c.portrait),
    lineCount: Object.values(c.lines ?? {}).reduce((n, arr) => n + (arr?.length ?? 0), 0),
  }));
  return all.sort((a, b) => {
    const fa = featured.indexOf(a.character.id);
    const fb = featured.indexOf(b.character.id);
    if (fa !== -1 || fb !== -1) return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
    return a.character.name.localeCompare(b.character.name);
  });
})();

/** Known speaker ids, for the lint pass. */
export const KNOWN = new Set([...characters.keys()]);

export function sampleLine(id: string, bucket: string): string | null {
  const arr = characters.get(id)?.lines?.[bucket];
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------------- timing maths ------------------------------------------- */

/**
 * On-screen dwell time for a line at a given reading speed: a fixed
 * decision cost plus per-word reading time, floored so short barks don't
 * flick past. ~180 wpm is a comfortable voiced-fiction pace.
 */
export function lineSeconds(text: string, wpm: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0.7;
  return Math.max(1.1, 0.55 + (words * 60) / Math.max(60, wpm));
}

export function blockSeconds(lines: Line[], wpm: number): number {
  return lines.reduce((s, l) => s + lineSeconds(l.text, wpm), 0);
}

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/* ---------------- stage prefs -------------------------------------------- */

export type BackdropId = 'day' | 'dusk' | 'night';
export type FrameId = 'phone' | 'handheld' | 'wide';

export const BACKDROPS: { id: BackdropId; label: string; scene: string }[] = [
  { id: 'day', label: 'Midday', scene: 'Salt flats, full sun' },
  { id: 'dusk', label: 'Dusk', scene: 'Glass canyon, low light' },
  { id: 'night', label: 'Night', scene: 'Choirhollow, third bell' },
];

export const FRAMES: { id: FrameId; label: string; w: number; h: number }[] = [
  { id: 'phone', label: 'Phone 390', w: 390, h: 420 },
  { id: 'handheld', label: 'Handheld 768', w: 768, h: 430 },
  { id: 'wide', label: 'Wide 1180', w: 1180, h: 470 },
];

export interface StagePrefs {
  backdrop: BackdropId;
  frame: FrameId;
  wpm: number;
}

export const DEFAULT_PREFS: StagePrefs = { backdrop: 'night', frame: 'wide', wpm: 180 };

/* ---------------- lint pass ---------------------------------------------- */

export interface LintIssue {
  level: 'warn' | 'err';
  where: string;
  msg: string;
}

/** Per-line chips rendered inline in the editor. */
export function lineLint(line: Line): string[] {
  const out: string[] = [];
  if (!KNOWN.has(line.who)) out.push('unknown speaker');
  if (!line.text.trim()) out.push('blank line');
  const len = line.text.trim().length;
  if (len > 400) out.push('sprawling (>400)');
  else if (len > 280) out.push('long line (>280) — split it?');
  return out;
}

export function lintScript(s: Script): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const b of BLOCKS) {
    const lines = s.blocks[b.id];
    for (let i = 0; i < lines.length; i++) {
      if (!KNOWN.has(lines[i].who))
        issues.push({ level: 'err', where: `${b.id} · line ${i + 1}`, msg: `Unknown speaker “${lines[i].who}” — no portrait, no name chip.` });
      if (!lines[i].text.trim())
        issues.push({ level: 'err', where: `${b.id} · line ${i + 1}`, msg: 'Blank line — the box would show an empty speech.' });
      const len = lines[i].text.trim().length;
      if (len > 400)
        issues.push({ level: 'warn', where: `${b.id} · line ${i + 1}`, msg: `${len} chars is a speech, not a line — split for pacing.` });
    }
    if (lines.length > 8)
      issues.push({ level: 'warn', where: b.id, msg: `${lines.length} lines in one block — players click through every one.` });
    if (lines.length && new Set(lines.map((l) => l.who)).size === 1 && lines.length > 4)
      issues.push({ level: 'warn', where: b.id, msg: 'One voice carries the whole block — trade a line to someone.' });
  }
  if (s.choicesOn) {
    const c = s.choices;
    if (!c.prompt.trim() && c.options.length)
      issues.push({ level: 'warn', where: 'choices', msg: 'Options with no prompt — the teal line stays empty.' });
    c.options.forEach((o, i) => {
      if (!o.text.trim())
        issues.push({ level: 'err', where: `choices · option ${i + 1}`, msg: 'Blank option text.' });
      if (!o.setsFlag.trim())
        issues.push({ level: 'err', where: `choices · option ${i + 1}`, msg: 'No setsFlag — the choice decides nothing.' });
      else if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(o.setsFlag.trim()))
        issues.push({ level: 'warn', where: `choices · option ${i + 1}`, msg: 'Story flags read as dotted lowercase, e.g. offer.choir' });
    });
  }
  if (!s.blocks.offer.length && !s.blocks.accept.length && !s.blocks.complete.length)
    issues.push({ level: 'err', where: 'scene', msg: 'Nothing staged — write or import at least one line.' });
  return issues;
}

/* ---------------- mission import ------------------------------------------ */

/** Pull a shipped mission's dialogue into the bench for re-staging. */
export function scriptFromMission(id: string): Script | null {
  const m = missions.find((mm) => mm.id === id);
  if (!m?.dialogue) return null;
  const d = m.dialogue;
  const first = d.choices?.[0];
  return {
    blocks: {
      offer: (d.offer ?? []).map((l) => ({ who: l.who, text: l.text })),
      accept: (d.accept ?? []).map((l) => ({ who: l.who, text: l.text })),
      complete: (d.complete ?? []).map((l) => ({ who: l.who, text: l.text })),
    },
    choicesOn: Boolean(first),
    choices: first
      ? { prompt: first.prompt, options: first.options.map((o) => ({ text: o.text, setsFlag: o.setsFlag })) }
      : { prompt: '', options: [{ text: '', setsFlag: '' }] },
  };
}

export interface ImportOption {
  id: string;
  title: string;
  chapter: number | 'side';
  lines: number;
  hasChoices: boolean;
}

export const IMPORTABLES: ImportOption[] = missions
  .map((m) => ({
    id: m.id,
    title: m.title,
    chapter: m.chapter,
    lines: (m.dialogue?.offer?.length ?? 0) + (m.dialogue?.accept?.length ?? 0) + (m.dialogue?.complete?.length ?? 0),
    hasChoices: Boolean(m.dialogue?.choices?.length),
  }))
  .filter((m) => m.lines > 0);

/* ---------------- exporter ------------------------------------------------ */

/** Serialize the bench scene as a paste-ready `"dialogue": { ... }` block. */
export function exportDialogue(s: Script): string {
  const out: Record<string, unknown> = {};
  for (const b of BLOCKS) {
    const lines = s.blocks[b.id].filter((l) => l.text.trim());
    if (lines.length) out[b.id] = lines.map((l) => ({ who: l.who, text: l.text }));
  }
  if (s.choicesOn) {
    const opts = s.choices.options
      .filter((o) => o.text.trim() || o.setsFlag.trim())
      .map((o) => (o.setsFlag.trim() ? { text: o.text, setsFlag: o.setsFlag } : { text: o.text }));
    if (opts.length)
      out.choices = [{ prompt: s.choices.prompt || 'How do you answer?', options: opts }];
  }
  const inner = JSON.stringify(out, null, 2).split('\n').join('\n  ');
  return `"dialogue":   ${inner},`;
}

/* ---------------- persistence -------------------------------------------- */

const SCRIPT_KEY = 'driftline.dlg-stage.script.v1';
const PREFS_KEY = 'driftline.dlg-stage.prefs.v1';

export function loadScript(): Script | null {
  try {
    const raw = localStorage.getItem(SCRIPT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Script;
    if (!s.blocks || typeof s.blocks !== 'object') return null;
    for (const b of BLOCKS) if (!Array.isArray(s.blocks[b.id])) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveScript(s: Script): void {
  try {
    localStorage.setItem(SCRIPT_KEY, JSON.stringify(s));
  } catch {
    /* quota — the bench still works for the session */
  }
}

export function loadPrefs(): StagePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<StagePrefs>;
    return {
      backdrop: BACKDROPS.some((b) => b.id === p.backdrop) ? (p.backdrop as BackdropId) : DEFAULT_PREFS.backdrop,
      frame: FRAMES.some((f) => f.id === p.frame) ? (p.frame as FrameId) : DEFAULT_PREFS.frame,
      wpm: typeof p.wpm === 'number' ? Math.min(320, Math.max(120, p.wpm)) : DEFAULT_PREFS.wpm,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: StagePrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* see above */
  }
}

/** A warm first scene: the starter mission's post-accept radio chatter. */
export function starterScript(): Script {
  return scriptFromMission('ch1-first-run') ?? {
    blocks: {
      offer: [],
      accept: [
        { who: 'tamsin-cho', text: 'Parcel’s on the hook behind the board. Wax seal, Guild stamp, very official.' },
        { who: 'ketch', text: 'Take her past the overlook first — I want to see you climb a dune.' },
      ],
      complete: [],
    },
    choicesOn: false,
    choices: { prompt: '', options: [{ text: '', setsFlag: '' }] },
  };
}

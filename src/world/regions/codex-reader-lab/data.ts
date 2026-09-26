/**
 * Codex Reader Lab — shared data: category glyphs, reader settings, the lint
 * pass, and the tiny markdown-lite renderer used by the tuned reading pane.
 * The lab is deliberately toolchain-free: no markdown dependency, just enough
 * parsing for what writers actually use in src/content/lore (`## ` headings,
 * **bold**, *italic*).
 */
import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { LoreEntry } from '../../../codex/library';

/* ---------------- categories (glyph + colour, never colour alone) -------- */

export interface CategoryMeta {
  id: string;
  label: string;
  glyph: string;
  color: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'field-guide': { id: 'field-guide', label: 'Field guide', glyph: '▲', color: '#B3502E' },
  broadcast: { id: 'broadcast', label: 'Broadcast', glyph: '◉', color: '#57C4B8' },
  tract: { id: 'tract', label: 'Faction tract', glyph: '▣', color: '#B07C3A' },
  log: { id: 'log', label: 'Log', glyph: '✦', color: '#FFB454' },
  record: { id: 'record', label: 'Machine record', glyph: '⟡', color: '#9A86D0' },
};

export const CATEGORY_ORDER = ['field-guide', 'broadcast', 'tract', 'log', 'record'];

export const categoryOf = (e: LoreEntry): CategoryMeta =>
  CATEGORY_META[e.category] ?? { id: e.category, label: e.category, glyph: '◇', color: '#E4D7BE' };

/* ---------------- reader settings ---------------------------------------- */

export type ReaderMode = 'sheet' | 'paper' | 'form';
export type ReaderFont = 'sora' | 'serif';

export interface ReaderSettings {
  /** body size, px */
  size: number;
  /** line-height multiplier */
  leading: number;
  /** measure (max line length), characters */
  measure: number;
  /** letter-spacing, hundredths of an em (-2..4 → -0.02em..0.04em) */
  tracking: number;
  font: ReaderFont;
  mode: ReaderMode;
  compare: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  size: 17,
  leading: 1.72,
  measure: 66,
  tracking: 0,
  font: 'sora',
  mode: 'sheet',
  compare: false,
};

/** What CodexScreen ships today: 15px / 1.65 / no measure cap, `##` renders raw. */
export const BASELINE = { size: 15, leading: 1.65, font: 'sora' as ReaderFont };

export const READER_MODES: { id: ReaderMode; label: string; glyph: string; hint: string }[] = [
  { id: 'sheet', label: 'Night sheet', glyph: '◈', hint: 'the codex dark panel, tuned' },
  { id: 'paper', label: 'Day paper', glyph: '▤', hint: 'salt-white page for bright light' },
  { id: 'form', label: 'Guild form', glyph: '▣', hint: 'decorative printed ledger form' },
];

const STORE_KEY = 'dl.codex-reader-lab.settings';

export function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: ReaderSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode — the bench still works, it just forgets */
  }
}

/** Export the tuned values as drop-in CSS for the codex reading pane. */
export function settingsToCss(s: ReaderSettings): string {
  return [
    '/* Codex reading pane — tuned in the Codex Reader Lab */',
    '.codex-reading {',
    `  font-size: ${s.size}px;`,
    `  line-height: ${s.leading};`,
    `  max-width: ${s.measure}ch;`,
    `  letter-spacing: ${(s.tracking / 100).toFixed(2)}em;`,
    `  font-family: ${s.font === 'serif' ? 'ui-serif, Georgia, serif' : 'var(--font-body, Sora, ui-sans-serif, system-ui)'};`,
    '}',
    '.codex-reading h3 { /* `## ` sections — currently render as raw text */',
    '  font-family: var(--font-display);',
    '  margin: 1.4em 0 0.4em;',
    '}',
  ].join('\n');
}

/* ---------------- lint pass ---------------------------------------------- */

export interface LintFlags {
  thin: boolean;      // < 250 words (validator floor for lore)
  noH2: boolean;      // no `## ` section — validator asks for at least one
  noSummary: boolean; // frontmatter summary missing
}

export function lintEntry(e: LoreEntry): LintFlags {
  return {
    thin: e.words < 250,
    noH2: !/^##\s/m.test(e.body),
    noSummary: !e.summary.trim(),
  };
}

export const needsAttention = (l: LintFlags): boolean => l.thin || l.noH2 || l.noSummary;

export interface LintTally {
  total: number;
  clean: number;
  thin: number;
  noH2: number;
  noSummary: number;
}

export function tallyLint(entries: LoreEntry[]): LintTally {
  const t: LintTally = { total: entries.length, clean: 0, thin: 0, noH2: 0, noSummary: 0 };
  for (const e of entries) {
    const l = lintEntry(e);
    if (l.thin) t.thin++;
    if (l.noH2) t.noH2++;
    if (l.noSummary) t.noSummary++;
    if (!needsAttention(l)) t.clean++;
  }
  return t;
}

/* ---------------- reading stats ------------------------------------------ */

const WPM = 210; // comfortable silent-reading pace for fiction-ish prose

export function readMinutes(e: LoreEntry): number {
  return Math.max(0.4, e.words / WPM);
}

export function measureVerdict(measure: number): { label: string; ok: boolean } {
  if (measure < 50) return { label: 'NARROW — choppy lines, eye does the work', ok: false };
  if (measure > 78) return { label: 'WIDE — long returns, easy to lose the line', ok: false };
  return { label: 'IN BAND — 50–78ch reads easy', ok: true };
}

/* ---------------- markdown-lite ------------------------------------------ */

const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;

/** `**bold**` / `*italic*` → React nodes. No dangerouslySetInnerHTML, ever. */
export function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined)
      out.push(createElement('strong', { key: `${keyPrefix}-b${i}` }, m[1]));
    else out.push(createElement('em', { key: `${keyPrefix}-i${i}` }, m[2]));
    last = INLINE_RE.lastIndex;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * The tuned renderer: blank-line blocks, `## ` → h3, single newlines → <br/>,
 * inline bold/italic. This is the delta over CodexScreen, which prints
 * paragraphs raw (headings and asterisks show up as literal characters).
 */
export function renderTunedBody(body: string, keyPrefix: string): ReactNode[] {
  return body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block, bi) => {
      const key = `${keyPrefix}-${bi}`;
      if (block.startsWith('## ')) {
        return createElement('h3', { key }, parseInline(block.slice(3), key));
      }
      const lines = block.split('\n');
      const children: ReactNode[] = [];
      lines.forEach((line, li) => {
        if (li > 0) children.push(createElement('br', { key: `${key}-br${li}` }));
        children.push(...parseInline(line, `${key}-l${li}`));
      });
      return createElement('p', { key }, children);
    });
}

/** The baseline renderer: raw paragraph text, exactly what CodexScreen does. */
export function renderBaselineBody(body: string, keyPrefix: string): ReactNode[] {
  return body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block, bi) => createElement('p', { key: `${keyPrefix}-${bi}` }, block));
}

/** Deterministic Guild form number from a slug — decorative, not a hash you can trust. */
export function formNumber(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const letters = 'ABCDEFGHJKMNPQRSTVWXYZ';
  const a = letters[h % letters.length];
  const b = letters[(h >> 5) % letters.length];
  return `${a}${b}-${(h % 89) + 10}`;
}

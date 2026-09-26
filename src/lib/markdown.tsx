/**
 * Markdown-lite — canonical renderer for codex lore bodies. Deliberately tiny:
 * what writers actually use in src/content/lore — blank-line paragraphs,
 * `## ` section headings, single newlines as line breaks, `**bold**`,
 * `*italic*`. No dangerouslySetInnerHTML, ever.
 */
import type { ReactNode } from 'react';
import { createElement } from 'react';

const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;

/** `**bold**` / `*italic*` → React nodes. */
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
 * Body → blocks: blank-line split, `## ` → h3, single newlines → <br/>,
 * inline bold/italic. (Tuned in the Codex Reader Lab — see that bench.)
 */
export function renderLoreBody(body: string, keyPrefix: string): ReactNode[] {
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

/** Category chrome: glyph + colour, never colour alone. */
export const LORE_CATEGORY_META: Record<string, { label: string; glyph: string; color: string }> = {
  'field-guide': { label: 'Field guide', glyph: '▲', color: '#B3502E' },
  broadcast: { label: 'Broadcast', glyph: '◉', color: '#57C4B8' },
  tract: { label: 'Faction tract', glyph: '▣', color: '#B07C3A' },
  log: { label: 'Log', glyph: '✦', color: '#FFB454' },
  record: { label: 'Machine record', glyph: '⟡', color: '#9A86D0' },
};

export function loreCategoryMeta(category: string): { label: string; glyph: string; color: string } {
  return LORE_CATEGORY_META[category] ?? { label: category, glyph: '◇', color: '#E4D7BE' };
}

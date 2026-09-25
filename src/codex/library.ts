/** Codex library: src/content/lore/*.md — eager raw, frontmatter-parsed. */
import { parseFrontmatter } from '../lib/frontmatter';

export interface LoreEntry {
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  words: number;
}

const modules = import.meta.glob<string>('../content/lore/*.md', { eager: true, query: '?raw', import: 'default' });

export const loreEntries: LoreEntry[] = Object.entries(modules)
  .map(([path, raw]) => {
    const slug = path.split('/').pop()!.replace('.md', '');
    const { data, body } = parseFrontmatter(raw);
    return {
      slug,
      title: data.title ?? slug,
      category: data.category ?? 'log',
      summary: data.summary ?? '',
      body: body.trim(),
      words: body.trim().split(/\s+/).filter(Boolean).length,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

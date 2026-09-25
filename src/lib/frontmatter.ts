/** Minimal YAML-lite frontmatter parser: flat `key: value` pairs between --- fences. */
export interface FrontmatterResult {
  data: Record<string, string>;
  body: string;
}

export function parseFrontmatter(raw: string): FrontmatterResult {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

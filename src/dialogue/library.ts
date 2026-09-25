/** Character library: src/content/characters/*.json. See .ralph/ROUTES.md. */
export interface Character {
  id: string;
  name: string;
  role: string;
  faction: string;
  home: string;
  bio: string;
  appearance: string;
  voice: string;
  portrait?: string;
  lines: {
    greetings?: string[];
    barks?: string[];
    mission?: string[];
    radio?: string[];
    [bucket: string]: string[] | undefined;
  };
}

const modules = import.meta.glob<{ default: Character } | Character>('../content/characters/*.json', { eager: true });

export const characters = new Map<string, Character>();
for (const m of Object.values(modules)) {
  const c = 'default' in m ? m.default : m;
  characters.set(c.id, c);
}

export const character = (id: string): Character | undefined => characters.get(id);

export function pickLine(id: string, bucket: string): string | null {
  const c = characters.get(id);
  const arr = c?.lines[bucket];
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

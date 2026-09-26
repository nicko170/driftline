/**
 * Chapter metadata + progression. A chapter is "complete" when every story
 * mission with that chapter number *present in content* is in missionsDone —
 * so chapters advance automatically as writers add missions.
 * Chapter intro cards: GameScreen shows one when the chapter advances past
 * anything in save.chaptersSeen.
 */
import { missions, type Mission } from './library';

export interface ChapterMeta {
  n: number;
  title: string;
  logline: string;
  /** Epigraph shown on the intro card. */
  epigraph: string;
  /** Debrief text on the chapter-complete card. */
  outro: string;
}

export const CHAPTERS: ChapterMeta[] = [
  {
    n: 1,
    title: 'First Run',
    logline: 'Learn the bike. Learn the trade. Deliver the crate nobody sent.',
    epigraph: '“Any crate, any storm, any door.” — the Driftline creed',
    outro: 'The null crate is delivered and nobody will say who sent it. You know the bike now — and the bike is starting to know you. Saltmouth waves at you differently.',
  },
  {
    n: 2,
    title: 'The Glass Road',
    logline: 'The crate hums. Three factions come asking.',
    epigraph: '“The Choir hears, the Guild counts, the Reclaimers strip — and the Driftline carries.”',
    outro: 'Three factions, three offers, one crate that hums on the radio like a held breath. Then it said your name. Whatever is sleeping out there, it knows a courier when it hears one.',
  },
  {
    n: 3,
    title: 'Storm Season',
    logline: 'Routes close. A courier goes missing on the wind.',
    epigraph: '“Flat salt and a following wind.” — old courier blessing',
    outro: 'Rill Davenant came out of the wall thinner, laughing, and carrying a set of coordinates nobody sent her. Four-one-six point nine. The season turns. The storms are reciting something.',
  },
  {
    n: 4,
    title: "Mother's Voice",
    logline: 'The crate is a key. The desert begins to change.',
    epigraph: '“...ASH.” — the first word on the radio in two hundred years',
    outro: 'The door at Mothersgate is open a crack, and something two hundred years patient is asking politely. The glass blooms are spreading. Every faction in the desert is suddenly very polite, too.',
  },
  {
    n: 5,
    title: 'Last Delivery',
    logline: 'One final run. Two futures at the door.',
    epigraph: '“Count it twice, then let it go.”',
    outro: 'The delivery is made. What Kessa-9 becomes next was decided the way everything out here is decided — by whoever showed up. You showed up.',
  },
];

export const chapterMeta = (n: number): ChapterMeta | undefined => CHAPTERS.find((c) => c.n === n);

/** Story missions that exist in content, grouped by chapter number (asc). */
export function storyByChapter(): Map<number, Mission[]> {
  const map = new Map<number, Mission[]>();
  for (const m of missions) {
    if (m.chapter === 'side') continue;
    const n = m.chapter as number;
    if (!map.has(n)) map.set(n, []);
    map.get(n)!.push(m);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * The player's current chapter: the first chapter (with content) that is not
 * fully complete, clamped to what exists. 0 = not started.
 */
export function currentChapter(missionsDone: string[]): { chapter: number; justCompleted: number | null } {
  const done = new Set(missionsDone);
  let justCompleted: number | null = null;
  for (const [n, list] of storyByChapter()) {
    const allDone = list.every((m) => done.has(m.id));
    if (!allDone) return { chapter: n, justCompleted };
    justCompleted = n;
  }
  // everything that exists is done
  return { chapter: justCompleted ?? 0, justCompleted };
}

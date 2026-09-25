/**
 * Mission library: loads src/content/missions/*.json, validates lightly at
 * runtime, and filters by story flags / reputation for the job board.
 * Schema: .ralph/ROUTES.md.
 */
import type { Faction, MissionRewards } from '../state/store';
import type { DialogueChoice, DialogueLine } from '../state/store';

export type MissionType = 'deliver' | 'timed' | 'fragile' | 'escort' | 'chase' | 'race' | 'collect' | 'scout' | 'storm';

export interface Objective {
  type: 'pickup' | 'dropoff' | 'goto' | 'collect' | 'race' | 'escort' | 'chase' | 'scout' | 'storm' | 'deliver';
  target?: string;          // "region:anchor"
  targets?: string[];       // race checkpoints
  count?: number;           // collect N
  label?: string;
}

export interface Mission {
  id: string;
  title: string;
  chapter: number | 'side';
  type: MissionType;
  giver: string;
  region: string;
  summary: string;
  requires?: { flags?: string[]; rep?: Partial<Record<Faction, number>> };
  objectives: Objective[];
  rewards: MissionRewards;
  dialogue: { offer: DialogueLine[]; accept: DialogueLine[]; complete: DialogueLine[]; choices?: DialogueChoice[] };
  timeLimit?: number;
  cargo?: { fragile?: boolean; label?: string };
}

const modules = import.meta.glob<{ default: Mission } | Mission>('../content/missions/*.json', { eager: true });

export const missions: Mission[] = Object.values(modules)
  .map((m) => ('default' in m ? m.default : m))
  .sort((a, b) => (a.chapter === 'side' ? 99 : (a.chapter as number)) - (b.chapter === 'side' ? 99 : (b.chapter as number)) || a.id.localeCompare(b.id));

export const missionsById = new Map(missions.map((m) => [m.id, m]));

export function availableMissions(done: string[], flags: string[], rep: Record<Faction, number>, activeId: string | null): Mission[] {
  const flagSet = new Set(flags);
  return missions.filter((m) => {
    if (done.includes(m.id) || m.id === activeId) return false;
    const req = m.requires;
    if (req?.flags?.some((f) => !flagSet.has(f))) return false;
    if (req?.rep && Object.entries(req.rep).some(([f, n]) => rep[f as Faction] < (n ?? 0))) return false;
    return true;
  });
}

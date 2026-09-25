import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Quality = 'low' | 'medium' | 'high';
export type Faction = 'guild' | 'choir' | 'reclaimers';

export interface Settings {
  volume: number; // 0..1
  muted: boolean;
  quality: Quality;
  reducedShake: boolean;
  invertY: boolean;
}

export interface Upgrades {
  engine: number;    // 0..3 — accel + top speed
  handling: number;  // 0..3 — steering + grip
  boost: number;     // 0..3 — capacity + regen
  shield: number;    // 0..3 — cargo protection / impact soak
  paint: string;     // hull hex
}

export interface MissionRewards {
  credits: number;
  rep?: Partial<Record<Faction, number>>;
  upgrades?: string[];
  flags?: string[];
}

interface SaveState {
  version: number;
  credits: number;
  debt: number;
  rep: Record<Faction, number>;
  upgrades: Upgrades;
  flags: string[];
  codex: string[];
  missionsDone: string[];
  settings: Settings;
  hasSave: boolean;

  addCredits: (n: number) => void;
  addRep: (f: Faction, n: number) => void;
  setFlags: (flags: string[]) => void;
  hasFlag: (f: string) => boolean;
  completeMission: (id: string, r: MissionRewards) => void;
  purchase: (key: keyof Omit<Upgrades, 'paint'>, cost: number) => void;
  setPaint: (hex: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  newGame: () => void;
}

const defaultSettings: Settings = {
  volume: 0.8,
  muted: false,
  quality: 'medium',
  reducedShake: false,
  invertY: false,
};

const initialProgress = {
  credits: 120,
  debt: 8000,
  rep: { guild: 0, choir: 0, reclaimers: 0 },
  upgrades: { engine: 0, handling: 0, boost: 0, shield: 0, paint: '#B3502E' },
  flags: [] as string[],
  codex: ['glass-desert-field-guide'],
  missionsDone: [] as string[],
};

export const useSaveStore = create<SaveState>()(
  persist(
    (set, get) => ({
      version: 1,
      ...initialProgress,
      settings: { ...defaultSettings },
      hasSave: false,

      addCredits: (n) => set({ credits: Math.max(0, get().credits + n), hasSave: true }),
      addRep: (f, n) => set({ rep: { ...get().rep, [f]: get().rep[f] + n }, hasSave: true }),
      setFlags: (flags) => {
        if (!flags.length) return;
        const cur = new Set(get().flags);
        const codex = new Set(get().codex);
        for (const f of flags) {
          cur.add(f);
          if (f.startsWith('lore:')) codex.add(f.slice(5));
        }
        set({ flags: [...cur], codex: [...codex], hasSave: true });
      },
      hasFlag: (f) => get().flags.includes(f),
      completeMission: (id, r) => {
        const s = get();
        const codex = new Set(s.codex);
        for (const f of r.flags ?? []) if (f.startsWith('lore:')) codex.add(f.slice(5));
        const rep = { ...s.rep };
        for (const [fac, n] of Object.entries(r.rep ?? {})) rep[fac as Faction] += n ?? 0;
        const flags = new Set(s.flags);
        for (const f of r.flags ?? []) flags.add(f);
        set({
          credits: s.credits + r.credits,
          rep,
          flags: [...flags],
          codex: [...codex],
          missionsDone: [...new Set([...s.missionsDone, id])],
          hasSave: true,
        });
      },
      purchase: (key, cost) => {
        const s = get();
        if (s.credits < cost || s.upgrades[key] >= 3) return;
        set({
          credits: s.credits - cost,
          upgrades: { ...s.upgrades, [key]: s.upgrades[key] + 1 },
          hasSave: true,
        });
      },
      setPaint: (hex) => set({ upgrades: { ...get().upgrades, paint: hex }, hasSave: true }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      newGame: () => set({ ...initialProgress, flags: [], codex: ['glass-desert-field-guide'], missionsDone: [], hasSave: true }),
    }),
    {
      name: 'driftline-save',
      version: 1,
      migrate: (state) => state as SaveState,
      partialize: (s) => ({
        version: s.version,
        credits: s.credits,
        debt: s.debt,
        rep: s.rep,
        upgrades: s.upgrades,
        flags: s.flags,
        codex: s.codex,
        missionsDone: s.missionsDone,
        settings: s.settings,
        hasSave: s.hasSave,
      }),
    },
  ),
);

/* ---------------- runtime (not persisted) ---------------- */

export interface DialogueLine {
  who: string;
  text: string;
}

export interface DialogueChoice {
  prompt: string;
  options: { text: string; setsFlag: string }[];
}

export type RideMode = 'riding' | 'board' | 'garage' | 'dialogue' | 'paused';

interface GameState {
  mode: RideMode;
  /** Pause the physics world (pause menu only). */
  physicsPaused: boolean;
  activeMissionId: string | null;
  objectiveIndex: number;
  /** collect objective progress / race checkpoint index */
  objectiveCount: number;
  timeLeft: number | null;
  missionFailed: string | null;
  dialogue: DialogueLine[] | null;
  dialogueChoices: DialogueChoice | null;
  radioLine: { who: string; text: string; t: number } | null;

  setMode: (m: RideMode) => void;
  setPhysicsPaused: (p: boolean) => void;
  startMission: (id: string, timeLimit?: number) => void;
  advanceObjective: () => void;
  setObjectiveCount: (n: number) => void;
  tickTimer: (dt: number) => void;
  failMission: (reason: string) => void;
  clearMission: () => void;
  openDialogue: (lines: DialogueLine[], choices?: DialogueChoice) => void;
  closeDialogue: () => void;
  say: (who: string, text: string) => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  mode: 'riding',
  physicsPaused: false,
  activeMissionId: null,
  objectiveIndex: 0,
  objectiveCount: 0,
  timeLeft: null,
  missionFailed: null,
  dialogue: null,
  dialogueChoices: null,
  radioLine: null,

  setMode: (mode) => set({ mode }),
  setPhysicsPaused: (physicsPaused) => set({ physicsPaused }),
  startMission: (id, timeLimit) =>
    set({
      activeMissionId: id,
      objectiveIndex: 0,
      objectiveCount: 0,
      timeLeft: timeLimit ?? null,
      missionFailed: null,
    }),
  advanceObjective: () => set({ objectiveIndex: get().objectiveIndex + 1, objectiveCount: 0 }),
  setObjectiveCount: (objectiveCount) => set({ objectiveCount }),
  tickTimer: (dt) => {
    const t = get().timeLeft;
    if (t === null) return;
    set({ timeLeft: Math.max(0, t - dt) });
  },
  failMission: (reason) =>
    set({ missionFailed: reason, activeMissionId: null, objectiveIndex: 0, objectiveCount: 0, timeLeft: null }),
  clearMission: () => set({ activeMissionId: null, objectiveIndex: 0, objectiveCount: 0, timeLeft: null }),
  openDialogue: (dialogue, dialogueChoices) => set({ dialogue, dialogueChoices: dialogueChoices ?? null, mode: 'dialogue' }),
  closeDialogue: () => set({ dialogue: null, dialogueChoices: null, mode: 'riding' }),
  say: (who, text) => set({ radioLine: { who, text, t: Date.now() } }),
}));

/**
 * wallet — the scripted purse. Mirrors the save-store maths exactly
 * (src/state/store.ts): PART_COSTS, 3 levels, paint list, 8,000 cr bond
 * with clamped partial payments and the Flagsless `debt.cleared` rule
 * (debt hitting zero clears the title and unlocks Guild Gold paint).
 *
 * Everything is a pure function returning { wallet, receipt } so the bench
 * can replay sequences, and the a11y checks can assert on receipts.
 */

/** Same as GaragePanel/store. */
export const PART_COSTS = [400, 900, 1800] as const;
export const MAX_LEVEL = 3;
/** Same as ExchangePanel. */
export const BOND_ORIGINAL = 8000;
/** Same as GaragePanel. */
export const PAINTS = ['#B3502E', '#2E8C8C', '#B07C3A', '#E4D7BE', '#4A2E55', '#3A4A3A'] as const;
export const GUILD_GOLD = '#FFC969';

export type PartKey = 'engine' | 'handling' | 'boost' | 'shield';

export interface PartDef {
  key: PartKey;
  name: string;
  glyph: string;
  blurb: string;
  /** Ketch's placard copy for each fitted level (bench copy, not game truth). */
  levelNote: string;
}

export const PARTS: readonly PartDef[] = [
  {
    key: 'engine',
    name: 'Engine coils',
    glyph: '⏚',
    blurb: '+accel, +top speed',
    levelNote: 'each wind ≈ +10% accel · +6 km/h top',
  },
  {
    key: 'handling',
    name: 'Gyro cage',
    glyph: '◎',
    blurb: '+steering, +grip',
    levelNote: 'each gimbal ≈ +9% turn rate · firmer drift bite',
  },
  {
    key: 'boost',
    name: 'Boost cell',
    glyph: '✦',
    blurb: '+capacity, +regen',
    levelNote: 'each cell ≈ +0.8 s tank · quicker regen',
  },
  {
    key: 'shield',
    name: 'Cargo shield',
    glyph: '⬡',
    blurb: 'soaks impacts for fragile cargo',
    levelNote: 'each lattice ≈ +25% soak before cargo hurts',
  },
];

export interface Upgrades {
  engine: number;
  handling: number;
  boost: number;
  shield: number;
  paint: string;
}

export interface Wallet {
  credits: number;
  debt: number;
  upgrades: Upgrades;
}

export const initialWallet = (): Wallet => ({
  credits: 900,
  debt: BOND_ORIGINAL,
  upgrades: { engine: 0, handling: 0, boost: 0, shield: 0, paint: PAINTS[0] },
});

export const debtCleared = (w: Wallet) => w.debt <= 0;
export const paints = (w: Wallet): readonly string[] =>
  debtCleared(w) ? [...PAINTS, GUILD_GOLD] : PAINTS;
export const partLevel = (w: Wallet, key: PartKey) => w.upgrades[key];
export const partCost = (w: Wallet, key: PartKey): number | null => {
  const lvl = w.upgrades[key];
  return lvl >= MAX_LEVEL ? null : PART_COSTS[lvl];
};

export type BuyVerdict =
  | { ok: true; wallet: Wallet; cost: number; part: PartDef; newLevel: number }
  | { ok: false; reason: 'maxed' | 'credits'; short: number; part: PartDef };

export function buy(w: Wallet, key: PartKey): BuyVerdict {
  const part = PARTS.find((p) => p.key === key)!;
  const cost = partCost(w, key);
  if (cost === null) return { ok: false, reason: 'maxed', short: 0, part };
  if (w.credits < cost) return { ok: false, reason: 'credits', short: cost - w.credits, part };
  return {
    ok: true,
    wallet: {
      ...w,
      credits: w.credits - cost,
      upgrades: { ...w.upgrades, [key]: w.upgrades[key] + 1 },
    },
    cost,
    part,
    newLevel: w.upgrades[key] + 1,
  };
}

export interface PayVerdict {
  wallet: Wallet;
  /** 0 = nothing moved (mirrors payDebt). */
  paid: number;
  cleared: boolean;
}

/** Mirrors store.payDebt: clamp to floor(amount), credits and debt. */
export function payDebt(w: Wallet, amount: number): PayVerdict {
  const paid = Math.max(0, Math.min(Math.floor(amount), w.credits, w.debt));
  if (paid <= 0) return { wallet: w, paid: 0, cleared: false };
  const debt = w.debt - paid;
  return { wallet: { ...w, credits: w.credits - paid, debt }, paid, cleared: debt === 0 && w.debt > 0 };
}

export const setPaint = (w: Wallet, hex: string): Wallet =>
  paints(w).includes(hex) ? { ...w, upgrades: { ...w.upgrades, paint: hex } } : w;

/* ---------- bench presets ---------- */

export const WALLET_PRESETS: { id: string; label: string; wallet: Wallet }[] = [
  {
    id: 'broke',
    label: 'Riding broke · 120 cr',
    wallet: { credits: 120, debt: 8000, upgrades: { engine: 0, handling: 0, boost: 0, shield: 0, paint: PAINTS[0] } },
  },
  {
    id: 'first-pay',
    label: 'First paycheque · 900 cr',
    wallet: { credits: 900, debt: 8000, upgrades: { engine: 0, handling: 0, boost: 0, shield: 0, paint: PAINTS[0] } },
  },
  {
    id: 'job-runner',
    label: 'Job runner · 2,650 cr',
    wallet: { credits: 2650, debt: 4200, upgrades: { engine: 1, handling: 0, boost: 1, shield: 0, paint: PAINTS[1] } },
  },
  {
    id: 'flush',
    label: 'Guild flush · 9,999 cr',
    wallet: { credits: 9999, debt: 1500, upgrades: { engine: 2, handling: 1, boost: 2, shield: 1, paint: PAINTS[2] } },
  },
  {
    id: 'clear-title',
    label: 'Clear title · gold day',
    wallet: { credits: 3400, debt: 0, upgrades: { engine: 3, handling: 2, boost: 2, shield: 2, paint: GUILD_GOLD } },
  },
];

export interface Receipt {
  id: number;
  text: string;
  kind: 'buy' | 'pay' | 'paint' | 'deny';
}

/**
 * Title Motion Lab — timing tokens & schedule math.
 *
 * The bench treats the shipped title-screen entrance as a sequence of *beats*
 * (kicker, logo, tagline, epilogue, menu buttons, hint, colophon). Every beat
 * gets a start offset and a duration derived from a small set of tokens; the
 * whole point of the lab is that the shipped TitleScreen can adopt the same
 * tokens verbatim via the export snippet.
 */

export type EaseId = 'weighline' | 'saltstep' | 'dustsettle' | 'flat';

export const EASES: Record<EaseId, { label: string; css: string; note: string }> = {
  weighline: {
    label: 'Weigh-line',
    css: 'cubic-bezier(0.16, 1, 0.3, 1)',
    note: 'expo-out — fast in, long settle. The shipped default.',
  },
  saltstep: {
    label: 'Salt-step',
    css: 'cubic-bezier(0.25, 1, 0.5, 1)',
    note: 'quart-out — even and clipped, a workmanlike arrival.',
  },
  dustsettle: {
    label: 'Dust-settle',
    css: 'cubic-bezier(0.34, 1.28, 0.44, 1)',
    note: 'soft overshoot — playful; watch the logo swing past its mark.',
  },
  flat: {
    label: 'Flat haul',
    css: 'linear',
    note: 'no easing — the control condition. Feel how dead it reads.',
  },
};

export const EASE_ORDER: EaseId[] = ['weighline', 'saltstep', 'dustsettle', 'flat'];

export type NetId = 'cached' | 'smooth' | 'salt3g' | 'storm';

export const NETWORKS: Record<NetId, { label: string; delayMs: number; note: string }> = {
  cached: {
    label: 'Warm cache',
    delayMs: 0,
    note: 'faces already local — no flash of fallback text at all.',
  },
  smooth: {
    label: 'Clear broadband',
    delayMs: 340,
    note: 'short FOUT — the logo snaps into Chakra Petch mid-settle.',
  },
  salt3g: {
    label: 'Salt-flat 3G',
    delayMs: 1250,
    note: 'the menu becomes actionable before the brand faces land.',
  },
  storm: {
    label: 'Storm static',
    delayMs: 2600,
    note: 'worst case we budget for: the whole entrance runs in fallback.',
  },
};

export const NET_ORDER: NetId[] = ['cached', 'smooth', 'salt3g', 'storm'];

export interface TitleTokens {
  ease: EaseId;
  net: NetId;
  /** delay before the first beat fires */
  baseMs: number;
  /** offset between structural beats */
  stepMs: number;
  /** per-beat duration */
  durMs: number;
  /** entrance rise distance */
  risePx: number;
  /** extra stagger between menu buttons */
  menuStepMs: number;
  /** epilogue panel reveal duration */
  epiMs: number;
  /** max pointer-parallax shift for the nearest layer */
  parallaxPx: number;
}

export const DEFAULT_TOKENS: TitleTokens = {
  ease: 'weighline',
  net: 'smooth',
  baseMs: 120,
  stepMs: 90,
  durMs: 520,
  risePx: 14,
  menuStepMs: 55,
  epiMs: 620,
  parallaxPx: 14,
};

/** The menu must be actionable before this, even on a decent connection. */
export const MENU_READY_BUDGET_MS = 1400;
/** Nothing (beats + font swap) should outlast this. */
export const SETTLE_BUDGET_MS = 3200;

/* ---------- beat schedule ---------- */

export type BeatGroup = 'structure' | 'epilogue' | 'menu' | 'tail';

export interface Beat {
  id: string;
  label: string;
  glyph: string;
  group: BeatGroup;
  start: number;
  end: number;
}

export const MENU_LABELS = ['▶ Play — new run', 'Codex', 'Logbook', 'Lab', 'Credits'];

export function buildSchedule(
  t: TitleTokens,
  opts: { epilogue: boolean; reduce: boolean },
): Beat[] {
  const base = t.baseMs;
  const step = opts.reduce ? 40 : t.stepMs;
  const dur = opts.reduce ? Math.min(t.durMs, 260) : t.durMs;
  const beats: Beat[] = [];
  const push = (
    id: string,
    label: string,
    glyph: string,
    group: BeatGroup,
    start: number,
    durOverride?: number,
  ) => beats.push({ id, label, glyph, group, start, end: start + (durOverride ?? dur) });

  push('kicker', 'Kicker', '◆', 'structure', base);
  push('logo', 'Logo', '■', 'structure', base + step);
  push('tag', 'Tagline', '▬', 'structure', base + step * 2);
  let i = 3;
  if (opts.epilogue) {
    const epiDur = opts.reduce ? Math.min(t.epiMs, 300) : t.epiMs;
    push('epilogue', 'Epilogue panel', '▣', 'epilogue', base + step * i, epiDur);
    i++;
  }
  const menuStart = base + step * i;
  const mstep = opts.reduce ? 30 : t.menuStepMs;
  MENU_LABELS.forEach((label, n) =>
    push(`menu-${n}`, `Menu · ${label.replace(/^▶ /, '')}`, '◈', 'menu', menuStart + n * mstep),
  );
  const tailStart = menuStart + MENU_LABELS.length * mstep;
  push('hint', 'Controls hint', '⌁', 'tail', tailStart + step);
  push('foot', 'Colophon', '·', 'tail', tailStart + step * 2);
  return beats;
}

/** The moment the last menu button *begins* — a player can act from here. */
export function menuReadyAt(schedule: Beat[]): number {
  const menus = schedule.filter((b) => b.group === 'menu');
  if (!menus.length) return 0;
  return Math.max(...menus.map((m) => m.start));
}

/** The moment every beat has fully landed. */
export function settleAt(schedule: Beat[]): number {
  return Math.max(...schedule.map((b) => b.end));
}

/* ---------- export ---------- */

/** The CSS custom-property block the shipped TitleScreen can adopt. */
export function buildExport(t: TitleTokens): string {
  return `:root {
  /* DRIFTLINE — title entrance tokens (tuned in /lab/title-motion-lab) */
  --title-ease: ${EASES[t.ease].css};
  --title-base: ${t.baseMs}ms;
  --title-step: ${t.stepMs}ms;
  --title-dur: ${t.durMs}ms;
  --title-rise: ${t.risePx}px;
  --title-menu-step: ${t.menuStepMs}ms;
  --title-epilogue-dur: ${t.epiMs}ms;
  --title-parallax: ${t.parallaxPx}px;
}
/* Brand faces land late on slow networks; the entrance never blocks on them. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --title-step: 40ms;
    --title-menu-step: 30ms;
    --title-dur: 260ms;
    --title-rise: 0px;
    --title-parallax: 0px;
  }
}`;
}

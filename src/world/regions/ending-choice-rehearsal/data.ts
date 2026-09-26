/**
 * Ending Choice Rehearsal — data + audit core.
 *
 * Everything here reads SHIPPED content (mission JSON via the mission library,
 * achievement predicates, epilogue copy, chapter metadata) so the stage always
 * reports on the real game, never a copy. Nothing is mutated from this file.
 */
import { missions, missionsById } from '../../../missions/library';
import { ACHIEVEMENTS } from '../../../game/achievements';
import { emptyStats, useSaveStore } from '../../../state/store';
import { EPILOGUES } from '../../../missions/endings';

export { EPILOGUES };

/** The shipped finale — the one place the choice is meant to live. */
export const FINAL_MISSION_ID = 'ch5-last-delivery';

/** Shape-first endings: glyph carries meaning, colour is decoration. */
export const ENDING_GLYPH: Record<string, string> = {
  'ending.rain': '⟡',
  'ending.quiet': '◉',
};

export interface FlagTouch {
  missionId: string;
  title: string;
  chapter: number | 'side';
  kind: 'sets (reward)' | 'sets (choice)' | 'requires';
  flag: string;
  detail: string;
}

/** Every place any mission JSON touches an `ending.*` flag. */
export function scanEndingFlags(): FlagTouch[] {
  const out: FlagTouch[] = [];
  for (const m of missions) {
    for (const f of m.rewards.flags ?? []) {
      if (f.startsWith('ending.')) {
        out.push({ missionId: m.id, title: m.title, chapter: m.chapter, kind: 'sets (reward)', flag: f, detail: 'rewards.flags' });
      }
    }
    (m.dialogue?.choices ?? []).forEach((c, ci) => {
      c.options.forEach((o, i) => {
        if (o.setsFlag?.startsWith('ending.')) {
          out.push({
            missionId: m.id,
            title: m.title,
            chapter: m.chapter,
            kind: 'sets (choice)',
            flag: o.setsFlag,
            detail: `choice ${ci + 1}, option ${i + 1}`,
          });
        }
      });
    });
    for (const f of m.requires?.flags ?? []) {
      if (f.startsWith('ending.')) {
        out.push({ missionId: m.id, title: m.title, chapter: m.chapter, kind: 'requires', flag: f, detail: 'requires.flags' });
      }
    }
  }
  return out;
}

export type Verdict = 'pass' | 'warn' | 'err';
export interface Check {
  id: string;
  level: Verdict;
  label: string;
  detail: string;
}

/**
 * The five ways endings go wrong:
 *  1. one mission sets BOTH endings (the save then silently resolves one of them)
 *  2. an ending is set outside chapter 5 (spoilers upstream of the Door)
 *  3. an ending has no source at all (a promise the content can't keep)
 *  4. a single choice offers the same flag twice (duplicate buttons)
 *  5. a mission requires a flag it also sets (gated behind itself — deadlock)
 */
export function runIntegrityAudit(): { touches: FlagTouch[]; checks: Check[] } {
  const touches = scanEndingFlags();
  const checks: Check[] = [];
  const sets = touches.filter((t) => t.kind.startsWith('sets'));

  // 1. no mission may set both endings
  const byMission = new Map<string, Set<string>>();
  for (const t of sets) {
    if (!byMission.has(t.missionId)) byMission.set(t.missionId, new Set());
    byMission.get(t.missionId)!.add(t.flag);
  }
  const dual = [...byMission.entries()].filter(([, fl]) => fl.size > 1);
  checks.push({
    id: 'no-dual-setter',
    level: dual.length ? 'err' : 'pass',
    label: 'No mission sets both endings',
    detail: dual.length
      ? `${dual.map(([id]) => `“${id}”`).join(', ')} — a save can never legitimately hold both endings at once`
      : `${byMission.size} mission${byMission.size === 1 ? '' : 's'} set ending flags; each commits to exactly one future`,
  });

  // 2. endings may only be set by chapter 5 content
  const upstream = sets.filter((t) => t.chapter !== 5);
  checks.push({
    id: 'chapter-five-only',
    level: upstream.length ? 'err' : 'pass',
    label: 'Setters live in Chapter 5 only',
    detail: upstream.length
      ? `${upstream.map((t) => `${t.missionId} (${t.kind})`).join(', ')} — the Door must stay the first place a future is signed`
      : `all ${sets.length} setter${sets.length === 1 ? '' : 's'} sit in chapter 5`,
  });

  // 3. every epilogue shipped must have at least one source
  for (const ep of EPILOGUES) {
    const sources = sets.filter((t) => t.flag === ep.flag);
    checks.push({
      id: `coverage-${ep.id}`,
      level: sources.length ? 'pass' : 'err',
      label: `${ENDING_GLYPH[ep.flag]} ${ep.flag} is reachable`,
      detail: sources.length
        ? `${sources.length} source${sources.length === 1 ? '' : 's'}: ${sources.map((t) => `${t.missionId} · ${t.detail}`).join('  ·  ')}`
        : `no content sets ${ep.flag} — ${ep.title} can never play`,
    });
  }

  // 4. one choice may offer both endings — never the same ending twice
  const choiceDupes: string[] = [];
  for (const m of missions) {
    (m.dialogue?.choices ?? []).forEach((c, ci) => {
      const counts = new Map<string, number>();
      for (const o of c.options) {
        if (o.setsFlag?.startsWith('ending.')) counts.set(o.setsFlag, (counts.get(o.setsFlag) ?? 0) + 1);
      }
      for (const [flag, n] of counts) {
        if (n > 1) choiceDupes.push(`${m.id} choice ${ci + 1} sets ${flag} ×${n}`);
      }
    });
  }
  checks.push({
    id: 'no-duplicate-option',
    level: choiceDupes.length ? 'err' : 'pass',
    label: 'No choice offers the same ending twice',
    detail: choiceDupes.length ? choiceDupes.join(' — ') : 'each flag appears at most once per choice prompt',
  });

  // 5. a mission that requires a flag it also sets can never start
  const deadlocked = touches
    .filter((t) => t.kind === 'requires')
    .filter((t) => sets.some((s) => s.missionId === t.missionId && s.flag === t.flag));
  checks.push({
    id: 'no-self-gate',
    level: deadlocked.length ? 'err' : 'pass',
    label: 'No mission is gated behind its own ending',
    detail: deadlocked.length
      ? deadlocked.map((t) => `${t.missionId} requires ${t.flag}`).join(', ')
      : 'no setter is locked behind the flag it sets',
  });

  return { touches, checks };
}

/* ---------------- audience probe — live predicate differencing ---------------- */

export interface UnlockProbe {
  id: string;
  title: string;
  desc: string;
  icon: string;
  hidden: boolean;
  live: boolean;
}

/**
 * Which achievements does this ending retro-unlock? Computed by running every
 * shipped predicate twice — once against the current save minus the flag, once
 * with it — and keeping the defs whose result flips. Discovers cross-fire for
 * free: a def that flips for both endings shows up in both columns.
 */
export function probeEndingUnlocks(flag: string): UnlockProbe[] {
  const save = useSaveStore.getState();
  const without = { ...save, flags: save.flags.filter((f) => f !== flag) };
  const withFlag = { ...without, flags: [...without.flags, flag] };
  const run = (fn: (s: ReturnType<typeof emptyStats>, v: typeof save) => boolean, v: typeof save) => {
    try {
      return fn(emptyStats(), v);
    } catch {
      return false;
    }
  };
  return ACHIEVEMENTS.filter((a) => !run(a.test, without) && run(a.test, withFlag)).map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.desc,
    icon: a.icon,
    hidden: !!a.hidden,
    live: save.achievements.includes(a.id),
  }));
}

/** Content gated behind this ending (post-game hook — empty until writers wire it). */
export function gatedByEnding(flag: string): { id: string; title: string; chapter: number | 'side' }[] {
  return missions
    .filter((m) => (m.requires?.flags ?? []).includes(flag))
    .map((m) => ({ id: m.id, title: m.title, chapter: m.chapter }));
}

/** True if the shipped finale mission + its choice are present. */
export function finalChoiceAvailable(): boolean {
  const m = missionsById.get(FINAL_MISSION_ID);
  return !!m?.dialogue?.choices?.length;
}

/* ---------------- broadcast typer tokens ---------------- */

export interface ReadToken {
  word: string;
  /** dwell multiplier on the base per-word interval */
  pause: number;
}

/**
 * Broadcast pace: punctuation breathes. A comma is one-and-a-half words,
 * a full stop three, an ellipsis long enough to hear the static.
 */
export function tokenizeForBroadcast(text: string): ReadToken[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      let pause = 1;
      if (/[,:;]$/.test(word)) pause = 1.6;
      else if (/[.!?]["”’]?$/.test(word)) pause = 3;
      else if (/…$/.test(word)) pause = 4;
      else if (/—$/.test(word)) pause = 2;
      return { word, pause };
    });
}

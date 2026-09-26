/**
 * Achievements — data-driven unlocks over lifetime ride stats + save state.
 * `evaluateAchievements()` is called after stat flushes and mission
 * completions; new unlocks push a toast into the game store + a chime.
 */
import { useSaveStore, useGameStore, type RideStats } from '../state/store';
import { currentChapter } from '../missions/chapters';
import { loreEntries } from '../codex/library';
import { audio } from '../audio/audio';

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  /** Shape glyph — colour-blind-safe: icon differs by shape, colour is decoration. */
  icon: string;
  /** Locked entries show ??? instead of the description when hidden. */
  hidden?: boolean;
  test: (stats: RideStats, save: ReturnType<typeof useSaveStore.getState>) => boolean;
}

const chapterCleared = (n: number) => (_s: RideStats, save: ReturnType<typeof useSaveStore.getState>) => {
  const { justCompleted } = currentChapter(save.missionsDone);
  return (justCompleted ?? 0) >= n;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-delivery', title: 'First Delivery', desc: 'Complete your first job for the board.', icon: '◆', test: (s) => s.missionsDone >= 1 },
  { id: 'ten-runs', title: 'Ten Runs Tall', desc: 'Complete 10 jobs.', icon: '◆◆', test: (s) => s.missionsDone >= 10 },
  { id: 'thirty-runs', title: 'The Creed Holds', desc: 'Complete 30 jobs. Any crate, any storm, any door.', icon: '◆◆◆', test: (s) => s.missionsDone >= 30 },
  { id: 'road-10k', title: 'Town to Town', desc: 'Ride 10 km lifetime.', icon: '─', test: (s) => s.distanceM >= 10_000 },
  { id: 'road-100k', title: 'The Long Salt', desc: 'Ride 100 km lifetime. The salt remembers every track.', icon: '═══', test: (s) => s.distanceM >= 100_000 },
  { id: 'redline', title: 'Redline', desc: 'Touch 120 km/h.', icon: '▲', test: (s) => s.topSpeedKmh >= 120 },
  { id: 'dust-comet', title: 'Dust Comet', desc: 'Hold a single drift for 2.5 seconds.', icon: '◠', test: (s) => s.bestDriftS >= 2.5 },
  { id: 'hophead', title: 'Hophead', desc: 'Hop 50 times.', icon: '⌃', test: (s) => s.jumps >= 50 },
  { id: 'skyhook', title: 'Skyhook', desc: 'Stay airborne for 2 seconds in one go.', icon: '⟡', test: (s) => s.biggestAirS >= 2 },
  { id: 'wall-runner', title: 'Wall Runner', desc: 'Outrun a storm wall and live to file the report.', icon: '◉', test: (s) => s.stormsOutrun >= 1 },
  { id: 'front-rider', title: 'Weathered', desc: 'Ride out a rolling weather front in open country. The salt remembers who didn\'t shelter.', icon: '▽', test: (s) => (s.frontsRodeOut ?? 0) >= 1 },
  { id: 'salt-money', title: 'Salt Money', desc: 'Hold 5,000 credits at once.', icon: '¤', test: (_s, save) => save.credits >= 5000 },
  { id: 'clean-ledger', title: 'Clean Ledger', desc: 'Pay off the 8,000-credit Driftline bond. The Guild counts it twice and smiles both times.', icon: '◈', test: (_s, save) => save.flags.includes('debt.cleared') },
  { id: 'tuned', title: 'Tuned to the Teeth', desc: 'Max out any one bike upgrade.', icon: '✦', test: (_s, save) => Math.max(save.upgrades.engine, save.upgrades.handling, save.upgrades.boost, save.upgrades.shield) >= 3 },
  { id: 'guild-friend', title: 'Counted Twice', desc: 'Reach 25 reputation with the Salt Guild.', icon: '▣', test: (_s, save) => save.rep.guild >= 25 },
  { id: 'choir-friend', title: 'Heard on the Static', desc: 'Reach 25 reputation with the Choir.', icon: '◍', test: (_s, save) => save.rep.choir >= 25 },
  { id: 'reclaimer-friend', title: 'Union Card', desc: 'Reach 25 reputation with the Reclaimers.', icon: '▤', test: (_s, save) => save.rep.reclaimers >= 25 },
  { id: 'signal-hunter', title: 'Signal Hunter', desc: 'Recover 10 codex entries.', icon: '◫', test: (_s, save) => save.codex.length >= 10 },
  { id: 'archivist', title: 'Archivist of the Glass Desert', desc: 'Recover half of all codex entries.', icon: '▦', test: (_s, save) => loreEntries.length >= 2 && save.codex.length >= Math.floor(loreEntries.length / 2) },
  { id: 'ch1-clear', title: 'Paper Kid', desc: 'Finish Chapter 1 — First Run.', icon: '①', test: chapterCleared(1) },
  { id: 'ch2-clear', title: 'Three Favours Owed', desc: 'Finish Chapter 2 — The Glass Road.', icon: '②', test: chapterCleared(2) },
  { id: 'ch3-clear', title: 'Season Survivor', desc: 'Finish Chapter 3 — Storm Season.', icon: '③', test: chapterCleared(3) },
  { id: 'ch4-clear', title: "Mother's Voice", desc: 'Finish Chapter 4 — the crate opens like a flower.', icon: '④', hidden: true, test: chapterCleared(4) },
  { id: 'ch5-clear', title: 'Last Delivery', desc: 'Finish Chapter 5 — two futures, one door.', icon: '⑤', hidden: true, test: chapterCleared(5) },
  { id: 'ending-rain', title: 'Ending — Rain', desc: 'Wake MOTHER. Let the desert bloom.', icon: '☂', hidden: true, test: (_s, save) => save.flags.includes('ending.rain') },
  { id: 'ending-quiet', title: 'Ending — Quiet', desc: 'Let MOTHER sleep. Keep the hard free life.', icon: '☾', hidden: true, test: (_s, save) => save.flags.includes('ending.quiet') },
];

export function evaluateAchievements(): void {
  const save = useSaveStore.getState();
  const game = useGameStore.getState();
  const unlocked = new Set(save.achievements);
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    let ok = false;
    try {
      ok = a.test(save.stats, save);
    } catch {
      ok = false;
    }
    if (!ok) continue;
    if (save.unlockAchievement(a.id)) {
      unlocked.add(a.id);
      game.queueToast({ id: a.id, title: a.title, desc: a.desc, icon: a.icon });
      audio.chime();
    }
  }
}

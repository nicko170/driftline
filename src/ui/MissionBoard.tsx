/**
 * Mission board overlay — jobs grouped under chapter ribbons, locked postings
 * shown greyed with the reason, detail pane, accept flow with offer dialogue.
 * Data flows from src/content/missions/*.json.
 */
import { useEffect, useMemo, useState } from 'react';
import { useGameStore, useSaveStore } from '../state/store';
import { availableMissions, lockedMissions, type LockedMission, type Mission } from '../missions/library';
import { CHAPTERS, chapterMeta, currentChapter } from '../missions/chapters';
import { character } from '../dialogue/library';
import { REGIONS } from '../world/registry';
import { audio } from '../audio/audio';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const roman = (n: number) => ROMAN[n - 1] ?? `${n}`;

interface JobGroup {
  header: string;
  chapter: number | 'side';
  jobs: Mission[];
  current: boolean;
}

function groupJobs(jobs: Mission[], currentCh: number): JobGroup[] {
  const groups = new Map<number | 'side', Mission[]>();
  for (const m of jobs) {
    if (!groups.has(m.chapter)) groups.set(m.chapter, []);
    groups.get(m.chapter)!.push(m);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    (a[0] === 'side' ? 99 : a[0]) - (b[0] === 'side' ? 99 : b[0]),
  );
  return ordered.map(([ch, list]) => ({
    header: ch === 'side' ? 'Side jobs — gossip & grease' : `Chapter ${roman(ch as number)} — ${chapterMeta(ch as number)?.title ?? ''}`,
    chapter: ch,
    jobs: list,
    current: ch === currentCh,
  }));
}

export default function MissionBoard() {
  const close = () => useGameStore.getState().setMode('riding');
  const done = useSaveStore((s) => s.missionsDone);
  const flags = useSaveStore((s) => s.flags);
  const rep = useSaveStore((s) => s.rep);
  const activeId = useGameStore((s) => s.activeMissionId);

  const jobs = useMemo(() => availableMissions(done, flags, rep, activeId), [done, flags, rep, activeId]);
  const locked = useMemo(() => lockedMissions(done, flags, rep, activeId), [done, flags, rep, activeId]);
  const currentCh = useMemo(() => currentChapter(done).chapter, [done]);
  const groups = useMemo(() => groupJobs(jobs, currentCh), [jobs, currentCh]);
  const [selected, setSelected] = useState<Mission | null>(jobs[0] ?? null);

  // keep selection valid as jobs change (e.g. after completing/retrying)
  useEffect(() => {
    if (!selected || !jobs.some((j) => j.id === selected.id)) setSelected(jobs[0] ?? null);
  }, [jobs, selected]);

  const accept = (m: Mission) => {
    const g = useGameStore.getState();
    g.clearMission();
    g.startMission(m.id, m.timeLimit);
    audio.chime();
    if (m.dialogue.accept?.length) g.openDialogue(m.dialogue.accept);
    else g.setMode('riding');
  };

  void close;

  return (
    <div className="overlay">
      <div className="sheet board">
        <header className="sheet-head">
          <h2>Salt Guild Job Board</h2>
          <p className="dim">
            "Everything crosses. Everything's counted." · Chapter {roman(currentCh)} of {CHAPTERS.length} · press <kbd>Esc</kbd> to step away
          </p>
          {/* chapter progress ribbon */}
          <div className="chapter-ribbon" aria-label="Story progress">
            {CHAPTERS.map((c) => (
              <span
                key={c.n}
                className={`chapter-pip ${c.n < currentCh ? 'done' : c.n === currentCh ? 'current' : ''}`}
                title={`Chapter ${c.n}: ${c.title}`}
              >
                {c.n}
              </span>
            ))}
          </div>
        </header>
        <div className="board-body">
          <ul className="board-list" role="listbox" aria-label="Available jobs">
            {jobs.length === 0 && (
              <li className="board-empty">
                Nothing posted. The desert's quiet today — enjoy it.
                {locked.length > 0 && <span className="dim"> ({locked.length} postings pinned for later.)</span>}
              </li>
            )}
            {groups.map((g) => (
              <li key={`grp-${g.chapter}`}>
                <div className={`board-group ${g.current ? 'current' : ''}`}>
                  <span className="board-group-label">{g.header}</span>
                  {g.current && <span className="board-group-badge">current</span>}
                </div>
                <ul className="board-list-inner">
                  {g.jobs.map((m) => (
                    <li key={m.id}>
                      <button
                        className={`board-job ${selected?.id === m.id ? 'selected' : ''}`}
                        onClick={() => { setSelected(m); audio.blip(660, 0.05); }}
                      >
                        <span className="board-job-type">{m.type}</span>
                        <span className="board-job-title">{m.title}</span>
                        <span className="board-job-pay">{m.rewards.credits} cr</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {locked.length > 0 && (
              <li>
                <div className="board-group locked">
                  <span className="board-group-label">Pinned — not yet available</span>
                </div>
                <ul className="board-list-inner">
                  {locked.map((l: LockedMission) => (
                    <li key={l.mission.id} className="board-locked" title={l.mission.summary}>
                      <span className="board-job-type">{l.mission.type}</span>
                      <span className="board-job-title">{l.mission.title}</span>
                      <span className="board-locked-reason">{l.reasons[0]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
          <div className="board-detail">
            {selected ? (
              <>
                <h3>{selected.title}</h3>
                <p className="board-detail-meta">
                  {selected.chapter === 'side' ? 'Side job' : `Chapter ${selected.chapter}`} ·{' '}
                  {character(selected.giver)?.name ?? selected.giver} ·{' '}
                  {REGIONS.get(selected.region)?.meta.name ?? selected.region}
                </p>
                <p>{selected.summary}</p>
                {selected.dialogue.offer?.[0] && (
                  <blockquote className="board-offer">“{selected.dialogue.offer[0].text}”</blockquote>
                )}
                <ul className="board-objectives">
                  {selected.objectives.map((o, i) => (
                    <li key={i}>{o.label ?? `${o.type} → ${o.target ?? 'checkpoints'}`}</li>
                  ))}
                </ul>
                <div className="board-rewards">
                  <span>{selected.rewards.credits} cr{selected.cargo?.fragile ? ' (intact)' : ''}</span>
                  {selected.rewards.rep && Object.entries(selected.rewards.rep).map(([f, n]) => (
                    <span key={f} className={`rep rep-${f}`}>{n! > 0 ? '+' : ''}{n} {f}</span>
                  ))}
                  {selected.cargo?.fragile && <span className="rep rep-fragile">FRAGILE — {selected.cargo.label}</span>}
                  {selected.timeLimit && <span className="rep">⏱ {selected.timeLimit}s</span>}
                </div>
                {activeId && (
                  <p className="board-abandon-note dim">Accepting will drop your current job.</p>
                )}
                <button className="btn primary" onClick={() => accept(selected)}>Accept job</button>
              </>
            ) : (
              <p className="dim">Select a posting.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

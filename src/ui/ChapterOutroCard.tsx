/**
 * Chapter outro — debrief card shown once when a chapter's last story mission
 * completes (set by MissionDirector, gated by save.outrosSeen). Wait until the
 * completion dialogue is closed (mode === 'riding') and no intro card is
 * pending. Dismissed with E/Enter/Esc or the button.
 */
import { useEffect, useMemo } from 'react';
import { useGameStore, useSaveStore } from '../state/store';
import { chapterMeta, currentChapter } from '../missions/chapters';
import { audio } from '../audio/audio';
import { input } from '../input/input';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export default function ChapterOutroCard() {
  const chapterOutro = useGameStore((s) => s.chapterOutro);
  const mode = useGameStore((s) => s.mode);
  const missionsDone = useSaveStore((s) => s.missionsDone);
  const chaptersSeen = useSaveStore((s) => s.chaptersSeen);

  // a pending chapter-intro card owns the screen first
  const introPending = useMemo(() => {
    const { chapter } = currentChapter(missionsDone);
    return chapter >= 1 && !chaptersSeen.includes(chapter);
  }, [missionsDone, chaptersSeen]);

  const show = chapterOutro !== null && mode === 'riding' && !introPending;

  useEffect(() => {
    if (!show || chapterOutro === null) return;
    const dismiss = () => {
      audio.chime();
      // eat the edge-triggered pause so Esc closes the card, not opens the menu
      input.pause = false;
      // and eat interact so E/Enter closes the card, not fires the nearby spot
      input.interact = false;
      useSaveStore.getState().markOutroSeen(chapterOutro);
      useGameStore.getState().setChapterOutro(null);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'enter' || k === 'e' || k === 'escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, chapterOutro]);

  if (!show || chapterOutro === null) return null;
  const meta = chapterMeta(chapterOutro);
  if (!meta) return null;

  return (
    <div className="overlay chapter-overlay" role="dialog" aria-modal="true" aria-label={`Chapter ${chapterOutro} complete: ${meta.title}`}>
      <div className="chapter-card chapter-outro-card">
        <div className="chapter-card-numeral chapter-outro-kicker">Chapter {ROMAN[chapterOutro - 1] ?? chapterOutro} complete — debrief</div>
        <h1 className="chapter-card-title">{meta.title}</h1>
        <p className="chapter-card-logline">{meta.outro}</p>
        <div className="chapter-card-rule" aria-hidden="true">◆ ◆ ◆</div>
        <button
          className="btn primary"
          autoFocus
          onClick={() => {
            audio.chime();
            useSaveStore.getState().markOutroSeen(chapterOutro);
            useGameStore.getState().setChapterOutro(null);
          }}
        >
          Ride on
        </button>
      </div>
    </div>
  );
}

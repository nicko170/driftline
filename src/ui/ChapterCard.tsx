/**
 * Chapter intro card — full-screen interstitial shown when the story advances
 * past a chapter in save.chaptersSeen. Pure overlay; pauses nothing (the world
 * keeps breathing behind it), dismissed with a button or E/Esc.
 */
import { useEffect, useMemo } from 'react';
import { useSaveStore } from '../state/store';
import { chapterMeta, currentChapter } from '../missions/chapters';
import { audio } from '../audio/audio';
import { input } from '../input/input';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export default function ChapterCard() {
  const missionsDone = useSaveStore((s) => s.missionsDone);
  const chaptersSeen = useSaveStore((s) => s.chaptersSeen);
  const markChapterSeen = useSaveStore((s) => s.markChapterSeen);

  const pending = useMemo(() => {
    const { chapter } = currentChapter(missionsDone);
    if (chapter >= 1 && !chaptersSeen.includes(chapter)) return chapter;
    return null;
  }, [missionsDone, chaptersSeen]);

  // dismiss with E / Enter / Escape
  useEffect(() => {
    if (pending === null) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'enter' || k === 'e' || k === 'escape') {
        audio.chime();
        input.pause = false; // Esc closes the card, never opens the pause menu
        input.interact = false; // E/Enter closes the card, never fires the board
        markChapterSeen(pending);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, markChapterSeen]);

  if (pending === null) return null;
  const meta = chapterMeta(pending);
  if (!meta) return null;

  const dismiss = () => {
    audio.chime();
    input.pause = false;
    input.interact = false;
    markChapterSeen(pending);
  };

  return (
    <div className="overlay chapter-overlay" role="dialog" aria-modal="true" aria-label={`Chapter ${pending}: ${meta.title}`}>
      <div className="chapter-card">
        <div className="chapter-card-numeral">Chapter {ROMAN[pending - 1] ?? pending}</div>
        <h1 className="chapter-card-title">{meta.title}</h1>
        <p className="chapter-card-logline">{meta.logline}</p>
        <p className="chapter-card-epigraph">{meta.epigraph}</p>
        <div className="chapter-card-rule" aria-hidden="true">◆ ◆ ◆</div>
        <button className="btn primary" onClick={dismiss} autoFocus>
          Ride on
        </button>
      </div>
    </div>
  );
}

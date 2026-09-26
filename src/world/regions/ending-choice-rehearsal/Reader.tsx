/**
 * Slow-read mode: types the picked epilogue (text + coda) at broadcast pace —
 * a word per tick, punctuation breathing via the tokenizer — over the
 * radio-static bed, in the codex reading-pane measure (17px / 1.72 / 66ch).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../../audio/audio';
import { EPILOGUES, ENDING_GLYPH, tokenizeForBroadcast } from './data';
import { staticBed } from './static';
import type { EndingId } from './Doors';

export function Reader({ pick }: { pick: EndingId }) {
  const ep = EPILOGUES.find((e) => e.id === pick) ?? EPILOGUES[0];
  const tokens = useMemo(() => tokenizeForBroadcast(`${ep.text} ${ep.coda}`), [ep]);
  const [wpm, setWpm] = useState(165);
  const [bed, setBed] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);

  const done = idx >= tokens.length;
  const baseMs = 60000 / wpm;

  // retokenize / repick → reset the tape
  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [ep]);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (!playing) return;
    if (done) {
      setPlaying(false);
      audio.radioBlip();
      return;
    }
    const prevPause = idx === 0 ? 1 : tokens[idx - 1].pause;
    timer.current = window.setTimeout(() => {
      setIdx((i) => i + 1);
      // the static answers at word boundaries with a soft ping
      if (tokens[idx] && (tokens[idx].pause >= 3 || Math.random() < 0.22)) staticBed.crackle();
    }, baseMs * prevPause);
    return clearTimer;
  }, [playing, idx, done, baseMs, tokens]);

  // static bed follows play state; always dies with the component
  useEffect(() => {
    if (playing && bed) staticBed.start();
    else staticBed.stop();
  }, [playing, bed]);

  useEffect(() => () => {
    clearTimer();
    staticBed.stop();
  }, []);

  const shown = tokens.slice(0, idx).map((t) => t.word).join(' ');
  const pct = Math.round((idx / tokens.length) * 100);

  return (
    <div className="ecr-reader panel">
      <div className="ecr-reader-head">
        <span className="ecr-toollabel">Slow-read · broadcast pace</span>
        <span className="ecr-reader-flag">
          <span className="ecr-glyph" aria-hidden="true">{ENDING_GLYPH[ep.flag]}</span> {ep.title}
        </span>
      </div>

      <p className="ecr-reader-kicker">{ep.kicker}</p>
      <p className="ecr-reader-text" aria-live="polite" aria-label={`${ep.title}, read aloud`}>
        {shown}
        <span className={`ecr-caret ${playing && !done ? 'on' : ''}`} aria-hidden="true" />
      </p>

      <div className="ecr-reader-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className="ecr-reader-controls">
        {!playing && !done && (
          <button className="btn primary" onClick={() => { audio.resume(); setPlaying(true); }}>
            ▶ {idx > 0 ? 'Resume' : 'Broadcast'} ({tokens.length} words)
          </button>
        )}
        {playing && <button className="btn" onClick={() => setPlaying(false)}>◼ Hold</button>}
        {!done && idx > 0 && !playing && (
          <button className="btn" onClick={() => setIdx(0)}>↺ Rewind</button>
        )}
        {!done && (
          <button className="btn" onClick={() => { setIdx(tokens.length); setPlaying(false); }}>
            ⏭ Skip to print
          </button>
        )}
        {done && (
          <button className="btn primary" onClick={() => { setIdx(0); setPlaying(true); }}>
            ↺ Read it again
          </button>
        )}
        <label className="ecr-ctl">
          pace
          <input
            type="range"
            min={110}
            max={240}
            step={5}
            value={wpm}
            aria-label="Broadcast pace, words per minute"
            onChange={(e) => setWpm(Number(e.target.value))}
          />
          <span className="ecr-ctl-val">{wpm} wpm</span>
        </label>
        <label className="ecr-ctl ecr-check">
          <input type="checkbox" checked={bed} onChange={(e) => setBed(e.target.checked)} />
          radio static
        </label>
        <span className="ecr-ctl-note">band nine · the epilogue comes over the long radio dark</span>
      </div>
    </div>
  );
}

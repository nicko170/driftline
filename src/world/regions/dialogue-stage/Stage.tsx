/**
 * Dialogue Stage — the preview stage: a frame standing in for the player's
 * viewport (phone / handheld / wide), one of three desert backdrops, and the
 * dialogue rendered with the game's own CSS classes (.dialogue .panel …).
 * Playback auto-advances lines at reading speed with a per-line progress
 * bar; E / Enter / Space advance manually just like the game.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import { character } from '../../../dialogue/library';
import {
  BACKDROPS,
  FRAMES,
  lineSeconds,
  type BackdropId,
  type FrameId,
  type Line,
  type Script,
} from './data';

const frameOf = (id: FrameId) => FRAMES.find((f) => f.id === id) ?? FRAMES[2];

interface StageProps {
  script: Script;
  block: Line[];
  blockName: string;
  frame: FrameId;
  backdrop: BackdropId;
  wpm: number;
  lineIdx: number;
  onLineIdx: (i: number) => void;
}

export function Stage({ script, block, blockName, frame, backdrop, wpm, lineIdx, onLineIdx }: StageProps) {
  const f = frameOf(frame);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Fit the fixed-width frame into whatever column it lands in. */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 8) / f.w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [f.w]);

  const count = block.length;
  const idx = count ? Math.min(lineIdx, count - 1) : 0;
  const line = count ? block[idx] : null;
  const atEnd = count > 0 && idx >= count - 1;
  const showChoices = atEnd && script.choicesOn && script.choices.options.some((o) => o.text.trim());
  const secs = line ? lineSeconds(line.text, wpm) : 0;

  const advance = () => {
    if (!count) return;
    if (!atEnd) onLineIdx(idx + 1);
    else setPlaying(false);
  };

  /* Playback: dwell on each line for its reading time, then advance. */
  useEffect(() => {
    if (!playing || !line) return;
    const t = window.setTimeout(advance, secs * 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, idx, blockName, secs]);

  /* In-game keys: E / Enter / Space advance, ← → step. Ignore typing targets. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ') {
        if (e.key === ' ') e.preventDefault();
        advance();
      } else if (e.key === 'ArrowRight' && count) {
        onLineIdx(Math.min(count - 1, idx + 1));
      } else if (e.key === 'ArrowLeft' && count) {
        onLineIdx(Math.max(0, idx - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* Stop playback whenever the staged block changes under us. */
  useEffect(() => setPlaying(false), [blockName, block]);

  const who = line ? character(line.who) : undefined;

  return (
    <div className="ds-stage" aria-label="Dialogue scene preview">
      <div className="ds-stage-tools">
        <div className="ds-playbar" role="toolbar" aria-label="Playback controls">
          <button className="ds-pbtn" onClick={() => count && onLineIdx(Math.max(0, idx - 1))} disabled={!count || idx === 0} aria-label="Previous line">◂</button>
          <button
            className={`ds-pbtn ds-play ${playing ? 'on' : ''}`}
            onClick={() => (count ? setPlaying((p) => !p) : undefined)}
            disabled={!count}
            aria-label={playing ? 'Pause playback' : 'Play at reading speed'}
          >
            {playing ? '▮▮' : '▶'}
          </button>
          <button className="ds-pbtn" onClick={advance} disabled={!count || atEnd} aria-label="Next line">▸</button>
          <span className="ds-linecount">
            line <strong>{count ? idx + 1 : 0}</strong>/{count}
            {line && <em> · {secs.toFixed(1)}s dwell</em>}
          </span>
        </div>
      </div>

      <div className="ds-framewrap" ref={wrapRef} style={{ height: f.h * scale }}>
        <div
          className="ds-frame"
          data-backdrop={backdrop}
          style={{ width: f.w, height: f.h, transform: `scale(${scale})` }}
          role="img"
          aria-label={`${f.label} frame, ${
            (BACKDROPS.find((b) => b.id === backdrop) ?? BACKDROPS[0]).scene
          }`}
        >
          <div className="ds-mesa back" aria-hidden="true" />
          <div className="ds-mesa front" aria-hidden="true" />
          <div className="ds-haze" aria-hidden="true" />

          {line ? (
            <div className="dialogue panel ds-box" onClick={advance} role="dialog" aria-label={`${who?.name ?? line.who} speaking`}>
              <div className="dialogue-portrait">
                {who?.portrait ? (
                  <img src={withBase(who.portrait)} alt={who.name} />
                ) : (
                  <span className="dialogue-initials">
                    {(who?.name ?? '?').split(' ').map((w) => w[0]).join('')}
                  </span>
                )}
              </div>
              <div className="dialogue-body">
                <div className="dialogue-name">
                  {who?.name ?? line.who}
                  {who && <span className={`dialogue-faction faction-${who.faction}`}>{who.faction}</span>}
                  {!who && <span className="dialogue-faction">unknown</span>}
                </div>
                <p className="dialogue-text">{line.text || <span className="ds-blank">blank line</span>}</p>
                {showChoices ? (
                  <div className="dialogue-choices">
                    <p className="dialogue-prompt">{script.choices.prompt || 'How do you answer?'}</p>
                    {script.choices.options.filter((o) => o.text.trim()).map((o, i) => (
                      <button key={i} className="btn" onClick={(e) => e.stopPropagation()}>
                        {o.text}
                        {o.setsFlag && <span className="ds-flagchip">{o.setsFlag}</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="dialogue-hint">
                    {atEnd ? '▸ close' : '▸ next'} <kbd>E</kbd>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="ds-emptyscene panel">
              <p className="ds-kicker">STAGE IS DARK</p>
              <p>The <strong>{blockName}</strong> block has no lines yet. Write one on the script desk, pull a sample from the cast wall, or import a shipped mission.</p>
            </div>
          )}

          {playing && (
            <div className="ds-progress" key={`${blockName}:${idx}:${wpm}`}>
              <div className="ds-progress-fill" style={{ animationDuration: `${secs}s` }} />
            </div>
          )}
        </div>
      </div>

      <p className="ds-stage-note">
        The frame width <em>is</em> the viewport — the box obeys the same <code>min(680px, 94vw)</code>{' '}
        rule inside it. <kbd>E</kbd>/<kbd>Enter</kbd>/<kbd>Space</kbd> advances, <kbd>←</kbd><kbd>→</kbd> step, ▶ plays at reading speed.
      </p>
    </div>
  );
}

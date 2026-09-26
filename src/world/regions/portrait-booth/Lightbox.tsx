/**
 * Portrait Booth lightbox — one character up close: framed portrait, voice
 * notes, sample lines, and the re-roll prompt composer with a copy button.
 * Esc closes, ←/→ walk the (filtered) wall.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import {
  PAINT_LABEL,
  portraitPrompt,
  sampleLine,
  type PaintState,
  type WallEntry,
} from './data';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API unavailable (non-secure context) — legacy fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export interface LightboxProps {
  entries: WallEntry[];
  index: number;
  paint: Record<string, PaintState>;
  onClose: () => void;
  onStep: (delta: number) => void;
  onImgOk: (id: string) => void;
  onImgFail: (id: string) => void;
}

export function Lightbox({
  entries,
  index,
  paint,
  onClose,
  onStep,
  onImgOk,
  onImgFail,
}: LightboxProps) {
  const entry = entries[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onStep(-1);
      else if (e.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onStep]);

  useEffect(() => setCopied(false), [index]);

  const onCopy = useCallback(async () => {
    if (!entry) return;
    const ok = await copyText(portraitPrompt(entry.character));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [entry]);

  if (!entry) return null;
  const { character: c, faction: f, declaredArt } = entry;
  const state = paint[c.id] ?? 'unsat';
  const showImg = state === 'painted' && declaredArt;
  const greeting = sampleLine(c, 'greetings');
  const radio = sampleLine(c, 'radio');

  return (
    <div className="pb-veil" role="dialog" aria-modal="true" aria-label={`${c.name} — portrait sheet`} onClick={onClose}>
      <div className="pb-lightbox" style={{ ['--fc' as string]: f.color }} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="pb-x" onClick={onClose} aria-label="Close portrait sheet">
          ✕
        </button>

        <figure className={`pb-frame pb-frame-${state}`}>
          {showImg ? (
            <img
              src={withBase(declaredArt)}
              alt={`Painted portrait of ${c.name}`}
              onLoad={() => onImgOk(c.id)}
              onError={() => onImgFail(c.id)}
            />
          ) : (
            <span className="pb-monogram" aria-hidden="true">
              {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </span>
          )}
          <figcaption className="pb-stamp">{PAINT_LABEL[state]}</figcaption>
        </figure>

        <div className="pb-sheet">
          <header className="pb-sheet-head">
            <h3>{c.name}</h3>
            <p className="pb-sheet-role">{c.role}</p>
            <p className="pb-sheet-chips">
              <span className="pb-chip">
                <i aria-hidden="true">{f.glyph}</i> {f.name}
              </span>
              <span className="pb-chip pb-chip-plain">⌂ {c.home}</span>
            </p>
          </header>

          <p className="pb-bio">{c.bio}</p>

          <div className="pb-voice">
            <h4>Voice notes</h4>
            <p>{c.voice}</p>
          </div>

          {(greeting || radio) && (
            <div className="pb-lines">
              <h4>On the wire</h4>
              {greeting && <blockquote>“{greeting}”</blockquote>}
              {radio && <blockquote>“{radio}”</blockquote>}
            </div>
          )}

          <div className="pb-prompt">
            <div className="pb-prompt-head">
              <h4>Re-roll prompt</h4>
              <button className="pb-copy" onClick={onCopy}>
                {copied ? 'Copied ✓' : 'Copy prompt'}
              </button>
            </div>
            <pre>{portraitPrompt(c)}</pre>
          </div>
        </div>

        <button className="pb-nav pb-prev" onClick={() => onStep(-1)} aria-label="Previous character">
          ‹
        </button>
        <button className="pb-nav pb-next" onClick={() => onStep(1)} aria-label="Next character">
          ›
        </button>
      </div>
    </div>
  );
}

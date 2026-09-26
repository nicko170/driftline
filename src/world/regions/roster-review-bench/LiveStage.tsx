/**
 * Live stage — the honest part of the bench. Mounts the game's actual
 * DialogueBox and reproduces the HUD radio ticker verbatim, both driven
 * through the real game store (openDialogue / closeDialogue / say), so
 * writers review overflow, fades, choices and key handling as they ship.
 *
 * Off-air by default: the real dialogue box listens for E / Enter / Space
 * globally (that's the shipped behaviour), so it only mounts on request.
 */
import { useEffect, useState } from 'react';
import DialogueBox from '../../../ui/DialogueBox';
import { useGameStore } from '../../../state/store';
import { character } from '../../../dialogue/library';
import { audio } from '../../../audio/audio';
import { buildScene, radioLineAt, rehearsalChoices } from './data';
import type { Character } from '../../../dialogue/library';

/** The HUD's fade window — mirrored from src/ui/HUD.tsx. */
const RADIO_TTL_MS = 7000;

interface StageProps {
  selected: Character | null;
}

export function LiveStage({ selected }: StageProps) {
  const [onAir, setOnAir] = useState(false);
  const [radioN, setRadioN] = useState(0);
  const radioLine = useGameStore((s) => s.radioLine);
  const sceneLive = useGameStore((s) => !!s.dialogue);
  const [, force] = useState(0);

  /* Leave the store the way the bench found it. */
  useEffect(() => {
    return () => {
      const g = useGameStore.getState();
      g.closeDialogue();
      useGameStore.setState({ radioLine: null });
    };
  }, []);

  /* Tick while a radio line is live so the 7s fade window is honoured. */
  const radioFresh = !!radioLine && Date.now() - radioLine.t < RADIO_TTL_MS;
  useEffect(() => {
    if (!radioLine) return;
    const id = window.setInterval(() => {
      const r = useGameStore.getState().radioLine;
      if (!r || Date.now() - r.t >= RADIO_TTL_MS) {
        window.clearInterval(id);
      }
      force((n) => n + 1);
    }, 500);
    return () => window.clearInterval(id);
  }, [radioLine]);

  const goOnAir = () => {
    if (!selected) return;
    const g = useGameStore.getState();
    g.openDialogue(buildScene(selected), rehearsalChoices(selected));
    setOnAir(true);
  };

  /* Re-stage when the reviewer switches characters mid-take. */
  useEffect(() => {
    if (!onAir || !selected) return;
    goOnAir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  /* The box can close itself (E / click at the end) — track that honestly. */
  useEffect(() => {
    if (onAir && !sceneLive) setOnAir(false);
  }, [onAir, sceneLive]);

  const keyMic = () => {
    if (!selected) return;
    const line = radioLineAt(selected, radioN);
    if (!line) return;
    useGameStore.getState().say(selected.id, line);
    audio.radioBlip();
    setRadioN((n) => n + 1);
  };

  const radioCount = selected?.lines.radio?.length ?? 0;

  return (
    <section className="rrb-stage panel" aria-label="Live in-game rendering stage">
      <header className="rrb-stage-head">
        <div className="rrb-stage-title">
          <h3>On the wire</h3>
          <p>
            {selected
              ? `Staged character: ${selected.name} — the real components, fed by the real store.`
              : 'Pick someone off the roster to put them on the wire.'}
          </p>
        </div>
        <div className="rrb-stage-actions">
          <button
            className={`btn small ${onAir ? '' : 'primary'}`}
            onClick={goOnAir}
            disabled={!selected}
          >
            {onAir ? '↺ from the top' : '▶ put on stage'}
          </button>
        </div>
      </header>

      <div className="rrb-stage-body">
        <div className="rrb-live-dialogue">
          <p className="rrb-celllabel">DialogueBox — actual component</p>
          <div className="rrb-frame" data-onair={onAir || undefined}>
            {/* Mounted unconditionally; renders null until the store has a scene. */}
            <DialogueBox />
            {!sceneLive && (
              <div className="rrb-offair">
                <span className="rrb-offair-glyph" aria-hidden="true">◇</span>
                <strong>{onAir ? 'TAKE WRAPPED' : 'OFF AIR'}</strong>
                <span>
                  {onAir
                    ? 'The scene closed itself, just like it does in the saddle. Run it back from the top.'
                    : 'The box below is the real <DialogueBox />, waiting for the store.'}
                </span>
              </div>
            )}
          </div>
          <p className="rrb-cellnote">
            Shipped quirks included: it answers <kbd>E</kbd> / <kbd>Enter</kbd> / <kbd>Space</kbd>{' '}
            from anywhere — even while you’re typing in the search box. That’s ship behaviour, not a
            bench bug.
          </p>
        </div>

        <div className="rrb-live-radio">
          <p className="rrb-celllabel">HUD radio ticker — real store, real classes</p>
          <div className="rrb-frame">
            {radioFresh && radioLine ? (
              <div className="hud-radio panel">
                <span className="hud-radio-tag">RADIO</span>
                <strong>{character(radioLine.who)?.name ?? radioLine.who}:</strong> {radioLine.text}
              </div>
            ) : (
              <div className="rrb-offair">
                <span className="rrb-offair-glyph" aria-hidden="true">◌</span>
                <strong>{radioCount ? 'STATIC' : '▯ NO RADIO BUCKET'}</strong>
                <span>
                  {radioCount
                    ? 'Nothing on the band. Key the mic to push a line through say().'
                    : `${selected?.name ?? 'This voice'} carries no radio lines — subtitles stay dark on their watch.`}
                </span>
              </div>
            )}
          </div>
          <div className="rrb-microw">
            <button className="btn small primary" onClick={keyMic} disabled={!selected || !radioCount}>
              ⎍ key the mic
            </button>
            <span className="rrb-micnote">
              {selected ? `${Math.min(radioN, radioCount)}/${radioCount} lines keyed` : ''} · subtitles{' '}
              <em>always</em> on · fades after 7s like the HUD
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Dialogue overlay — character name, optional portrait, advancing lines,
 * end-of-scene choices that set story flags.
 */
import { useEffect, useState } from 'react';
import { useGameStore, useSaveStore } from '../state/store';
import { character } from '../dialogue/library';
import { withBase } from '../lib/base';
import { audio } from '../audio/audio';
import { input } from '../input/input';

export default function DialogueBox() {
  const dialogue = useGameStore((s) => s.dialogue);
  const choices = useGameStore((s) => s.dialogueChoices);
  const closeDialogue = useGameStore((s) => s.closeDialogue);
  const setFlags = useSaveStore((s) => s.setFlags);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [dialogue]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Enter' || e.key === ' ') {
        if (useGameStore.getState().mode === 'dialogue') {
          advance();
          // eat edge-triggered keys so closing dialogue can't instantly reopen panels
          input.interact = false;
          input.hop = false;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!dialogue?.length) return null;
  const line = dialogue[Math.min(index, dialogue.length - 1)];
  const who = character(line.who);
  const atEnd = index >= dialogue.length - 1;

  function advance() {
    audio.blip(500 + Math.random() * 120, 0.04);
    if (!atEnd) setIndex((i) => i + 1);
    else if (!choices) closeDialogue();
  }

  return (
    <div className="dialogue panel" onClick={advance} role="dialog" aria-label={`${who?.name ?? line.who} speaking`}>
      <div className="dialogue-portrait">
        {who?.portrait ? (
          <img src={withBase(who.portrait)} alt={who.name} />
        ) : (
          <span className="dialogue-initials">{(who?.name ?? '?').split(' ').map((w) => w[0]).join('')}</span>
        )}
      </div>
      <div className="dialogue-body">
        <div className="dialogue-name">
          {who?.name ?? line.who}
          {who && <span className={`dialogue-faction faction-${who.faction}`}>{who.faction}</span>}
        </div>
        <p className="dialogue-text">{line.text}</p>
        {atEnd && choices ? (
          <div className="dialogue-choices">
            <p className="dialogue-prompt">{choices.prompt}</p>
            {choices.options.map((o, i) => (
              <button
                key={i}
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (o.setsFlag) setFlags([o.setsFlag]);
                  audio.chime();
                  closeDialogue();
                }}
              >
                {o.text}
              </button>
            ))}
          </div>
        ) : (
          <div className="dialogue-hint">{atEnd ? '▸ close' : '▸ next'} <kbd>E</kbd></div>
        )}
      </div>
    </div>
  );
}

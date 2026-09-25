/** Codex — lore recovered across the Glass Desert. Unlock via mission flags. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loreEntries, type LoreEntry } from '../codex/library';
import { useSaveStore } from '../state/store';

const CATEGORY_LABELS: Record<string, string> = {
  'field-guide': 'Field guide',
  broadcast: 'Broadcast',
  tract: 'Faction tract',
  log: 'Log',
  record: 'Machine record',
};

export default function CodexScreen() {
  const codex = useSaveStore((s) => s.codex);
  const [open, setOpen] = useState<LoreEntry | null>(null);
  const unlocked = new Set(codex);

  return (
    <div className="codex-screen">
      <header className="sheet-head codex-head">
        <div>
          <h1>Courier's Codex</h1>
          <p className="dim">{unlocked.size} of {loreEntries.length} entries recovered — jobs and exploration unlock more.</p>
        </div>
        <Link className="btn" to="/">← Title</Link>
      </header>
      <div className="codex-body">
        <ul className="codex-list">
          {loreEntries.map((e) => {
            const isOpen = unlocked.has(e.slug);
            return (
              <li key={e.slug}>
                <button
                  className={`codex-entry ${open?.slug === e.slug ? 'selected' : ''} ${isOpen ? '' : 'locked'}`}
                  onClick={() => isOpen && setOpen(e)}
                  disabled={!isOpen}
                >
                  <span className="codex-cat">{CATEGORY_LABELS[e.category] ?? e.category}</span>
                  <span className="codex-title">{isOpen ? e.title : '▯▯▯ signal not recovered'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <article className="codex-reading panel">
          {open ? (
            <>
              <p className="codex-cat">{CATEGORY_LABELS[open.category] ?? open.category}</p>
              <h2>{open.title}</h2>
              <p className="dim">{open.summary}</p>
              {open.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
              <p className="dim codex-words">{open.words} words · recovered from the static</p>
            </>
          ) : (
            <p className="dim codex-empty">Select a recovered entry. Locked signals fill in as the story moves.</p>
          )}
        </article>
      </div>
    </div>
  );
}

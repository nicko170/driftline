/** Codex — lore recovered across the Glass Desert. Unlock via mission flags. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loreEntries, type LoreEntry } from '../codex/library';
import { useSaveStore } from '../state/store';
import { loreCategoryMeta, renderLoreBody } from '../lib/markdown';

export default function CodexScreen() {
  const codex = useSaveStore((s) => s.codex);
  const [open, setOpen] = useState<LoreEntry | null>(null);
  const [query, setQuery] = useState('');
  const unlocked = useMemo(() => new Set(codex), [codex]);

  const q = query.trim().toLowerCase();
  const entries = loreEntries.filter(
    (e) => !q || e.title.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q) || e.category.includes(q),
  );

  return (
    <div className="codex-screen">
      <header className="sheet-head codex-head">
        <div>
          <h1>Courier&#8217;s Codex</h1>
          <p className="dim">{unlocked.size} of {loreEntries.length} entries recovered — jobs and exploration unlock more.</p>
        </div>
        <div className="codex-head-actions">
          <input
            className="codex-search"
            type="search"
            placeholder="Search the static…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search codex entries"
          />
          <Link className="btn" to="/">← Title</Link>
        </div>
      </header>
      <div className="codex-body">
        <ul className="codex-list">
          {entries.map((e) => {
            const isOpen = unlocked.has(e.slug);
            const cat = loreCategoryMeta(e.category);
            return (
              <li key={e.slug}>
                <button
                  className={`codex-entry ${open?.slug === e.slug ? 'selected' : ''} ${isOpen ? '' : 'locked'}`}
                  onClick={() => isOpen && setOpen(e)}
                  disabled={!isOpen}
                  aria-label={isOpen ? `${cat.label}: ${e.title}` : 'Locked codex entry'}
                >
                  <span className="codex-glyph" style={{ color: cat.color }} aria-hidden>{cat.glyph}</span>
                  <span className="codex-entry-text">
                    <span className="codex-cat">{cat.label}</span>
                    <span className="codex-title">{isOpen ? e.title : '▯▯▯ signal not recovered'}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {entries.length === 0 && <li className="dim codex-noresults">No signal matches &#8220;{query}&#8221;.</li>}
        </ul>
        <article className="codex-reading panel">
          {open ? (
            (() => {
              const cat = loreCategoryMeta(open.category);
              return (
                <>
                  <p className="codex-cat codex-reading-cat">
                    <span className="codex-glyph" style={{ color: cat.color }} aria-hidden>{cat.glyph}</span> {cat.label}
                  </p>
                  <h2>{open.title}</h2>
                  <p className="dim codex-summary">{open.summary}</p>
                  <div className="codex-prose">{renderLoreBody(open.body, `lore-${open.slug}`)}</div>
                  <p className="dim codex-words">{open.words} words · recovered from the static</p>
                </>
              );
            })()
          ) : (
            <p className="dim codex-empty">Select a recovered entry. Locked signals fill in as the story moves.</p>
          )}
        </article>
      </div>
    </div>
  );
}

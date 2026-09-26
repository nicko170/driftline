/**
 * CODEX READER LAB — the reading room.
 *
 * A typography bench for the Courier's Codex: every lore entry from
 * src/content/lore on a shelf, filterable and searchable, with live
 * typesetting controls (size / leading / measure / tracking / typeface),
 * three "sheets" to read on (tuned night sheet, day paper, printed Guild
 * form), an honest split view against what the codex ships today, a copy-CSS
 * export, and a lint pass that flags entries under 250 words or missing a
 * `## ` section — the same floors the content validator enforces.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [7400, 7400])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import { loreEntries } from '../../../codex/library';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  categoryOf,
  lintEntry,
  loadSettings,
  needsAttention,
  saveSettings,
  tallyLint,
  type ReaderSettings,
} from './data';
import { Controls } from './Controls';
import { Reader } from './Reader';
import './reader.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function CodexReaderLab() {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const [category, setCategory] = useState<string>('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [openSlug, setOpenSlug] = useState<string>(loreEntries[0]?.slug ?? '');

  useEffect(() => saveSettings(settings), [settings]);

  const patch = useCallback(
    (p: Partial<ReaderSettings>) => setSettings((s) => ({ ...s, ...p })),
    [],
  );

  const lint = useMemo(() => {
    const map = new Map<string, ReturnType<typeof lintEntry>>();
    for (const e of loreEntries) map.set(e.slug, lintEntry(e));
    return map;
  }, []);
  const tally = useMemo(() => tallyLint(loreEntries), []);

  const shelf = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loreEntries.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (attentionOnly && !needsAttention(lint.get(e.slug)!)) return false;
      if (!q) return true;
      return `${e.title} ${e.summary} ${e.slug}`.toLowerCase().includes(q);
    });
  }, [category, attentionOnly, query, lint]);

  const openEntry = loreEntries.find((e) => e.slug === openSlug) ?? shelf[0] ?? loreEntries[0];

  const stepEntry = useCallback(
    (delta: number) => {
      if (!shelf.length || !openEntry) return;
      const i = shelf.findIndex((e) => e.slug === openEntry.slug);
      const next = shelf[(Math.max(i, 0) + delta + shelf.length) % shelf.length];
      setOpenSlug(next.slug);
    },
    [shelf, openEntry],
  );

  return (
    <div className="crl-root">
      <header
        className="crl-head"
        style={{ backgroundImage: `url(${withBase('images/work/codex-reader-lab.jpg')})` }}
        role="img"
        aria-label="A courier office reading nook stacked with ledger forms, a brass lamp and a window onto the salt flats"
      >
        <div className="crl-head-veil">
          <h2>Codex Reader Lab</h2>
          <p>
            The reading room: every entry on the shelf, type set the way you like it. Tune
            measure, leading and size; read it on the night sheet, day paper or a printed
            Guild form; then copy the CSS straight back to the codex.
          </p>
        </div>
        <div className="crl-tally" aria-label="Shelf lint tally">
          <span>
            <strong>{tally.clean}</strong>/{tally.total} clean
          </span>
          {tally.thin > 0 && (
            <span className="crl-tally-flag">
              <strong>{tally.thin}</strong> thin
            </span>
          )}
          {tally.noH2 > 0 && (
            <span className="crl-tally-flag">
              <strong>{tally.noH2}</strong> no section
            </span>
          )}
          {tally.noSummary > 0 && (
            <span className="crl-tally-flag">
              <strong>{tally.noSummary}</strong> no summary
            </span>
          )}
        </div>
      </header>

      <Controls settings={settings} onChange={patch} />

      <div className="crl-body">
        <aside className="crl-shelf" aria-label="Lore shelf">
          <div className="crl-chips" role="toolbar" aria-label="Category filters">
            <button
              className={`crl-fchip ${category === 'all' && !attentionOnly ? 'on' : ''}`}
              onClick={() => {
                setCategory('all');
                setAttentionOnly(false);
              }}
            >
              <i aria-hidden="true">◈</i> All <b>{loreEntries.length}</b>
            </button>
            {CATEGORY_ORDER.map((cid) => {
              const c = CATEGORY_META[cid];
              const n = loreEntries.filter((e) => e.category === cid).length;
              if (!n) return null;
              return (
                <button
                  key={cid}
                  className={`crl-fchip ${category === cid && !attentionOnly ? 'on' : ''}`}
                  style={{ ['--fc' as string]: c.color }}
                  onClick={() => {
                    setCategory(category === cid ? 'all' : cid);
                    setAttentionOnly(false);
                  }}
                >
                  <i aria-hidden="true">{c.glyph}</i> {c.label} <b>{n}</b>
                </button>
              );
            })}
            <button
              className={`crl-fchip crl-fchip-attn ${attentionOnly ? 'on' : ''}`}
              aria-pressed={attentionOnly}
              onClick={() => setAttentionOnly((v) => !v)}
            >
              <i aria-hidden="true">⚠</i> Needs attention <b>{tally.total - tally.clean}</b>
            </button>
          </div>

          <input
            className="crl-search"
            type="search"
            placeholder="Search titles, summaries, slugs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the shelf"
          />

          <ul
            className="crl-list"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                stepEntry(1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                stepEntry(-1);
              }
            }}
          >
            {shelf.length === 0 && (
              <li className="crl-emptyrow">Nothing on the shelf by that name. File a request with the archive.</li>
            )}
            {shelf.map((e) => {
              const cat = categoryOf(e);
              const l = lint.get(e.slug)!;
              const flags = needsAttention(l);
              return (
                <li key={e.slug}>
                  <button
                    className={`crl-entry ${openEntry?.slug === e.slug ? 'selected' : ''}`}
                    onClick={() => setOpenSlug(e.slug)}
                    aria-current={openEntry?.slug === e.slug}
                  >
                    <span className="crl-entry-cat" style={{ ['--fc' as string]: cat.color }}>
                      <i aria-hidden="true">{cat.glyph}</i> {cat.label}
                    </span>
                    <span className="crl-entry-title">{e.title}</span>
                    <span className="crl-entry-meta">
                      {e.words}w
                      {l.thin && <em className="crl-flag">thin</em>}
                      {l.noH2 && <em className="crl-flag">no ##</em>}
                      {l.noSummary && <em className="crl-flag">no summary</em>}
                      {flags && <i className="crl-dot" aria-hidden="true" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="crl-shelf-hint">↑↓ moves through the shelf.</p>
        </aside>

        {openEntry && (
          <div className={`crl-readers ${settings.compare ? 'split' : ''}`}>
            {settings.compare && <Reader entry={openEntry} settings={settings} variant="baseline" />}
            <Reader entry={openEntry} settings={settings} variant="tuned" />
          </div>
        )}
      </div>

      <footer className="crl-foot">
        <p>
          Category chips follow the design rule — a glyph <em>and</em> a colour, never colour
          alone. The lint pass enforces the same floors as <code>validate:content</code>: 250+
          words, a <code>## </code> section, a summary. The baseline pane renders exactly what
          the codex ships today, headings and asterisks included — tune until the difference is
          embarrassing, then <em>Copy CSS</em>.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = CodexReaderLab as typeof CodexReaderLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

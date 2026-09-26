/**
 * PORTRAIT BOOTH — the casting-office contact wall.
 *
 * Every Driftline character from src/content/characters/*.json pinned up as a
 * contact sheet: painted portraits where the art exists, monogram frames where
 * it doesn't, faction-coloured framing (shape + colour, never colour alone),
 * and a lightbox with bio, voice notes, sample lines and a re-roll prompt
 * composer for re-painting art later. Declared-but-missing portrait files flag
 * themselves as FRAME STALE, so the wall doubles as a live art-gap tracker.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [6800, 6800]) and
 * the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useCallback, useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  FACTIONS,
  FACTION_ORDER,
  PAINT_LABEL,
  WALL,
  factionCounts,
  type PaintState,
} from './data';
import { Lightbox } from './Lightbox';
import './booth.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

/* Every declared file starts optimistic (PAINTED) and demotes itself to STALE
 * if the <img> 404s; undeclared entries sit at AWAITING SITTING. */
function initialPaint(): Record<string, PaintState> {
  const paint: Record<string, PaintState> = {};
  for (const e of WALL) paint[e.character.id] = e.declaredArt ? 'painted' : 'unsat';
  return paint;
}

function PortraitBooth() {
  const [paint, setPaint] = useState<Record<string, PaintState>>(initialPaint);
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const markOk = useCallback((id: string) => {
    setPaint((p) => (p[id] === 'painted' ? p : { ...p, [id]: 'painted' }));
  }, []);
  const markFail = useCallback((id: string) => {
    setPaint((p) => ({ ...p, [id]: 'stale' }));
  }, []);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WALL.filter((e) => {
      if (filter !== 'all' && e.faction.id !== filter) return false;
      if (!q) return true;
      const c = e.character;
      return `${c.name} ${c.role} ${c.home}`.toLowerCase().includes(q);
    });
  }, [filter, query]);

  const openIndex = openId ? entries.findIndex((e) => e.character.id === openId) : -1;
  const step = useCallback(
    (delta: number) => {
      if (!entries.length) return;
      setOpenId((cur) => {
        const i = cur ? entries.findIndex((e) => e.character.id === cur) : -1;
        const next = entries[(i + delta + entries.length) % entries.length];
        return next.character.id;
      });
    },
    [entries],
  );

  const counts = useMemo(factionCounts, []);
  const painted = WALL.filter((e) => paint[e.character.id] === 'painted').length;
  const stale = WALL.filter((e) => paint[e.character.id] === 'stale').length;

  return (
    <div className="pb-root">
      <header
        className="pb-head"
        style={{ backgroundImage: `url(${withBase('images/work/portrait-booth.jpg')})` }}
        role="img"
        aria-label="A cork board wall in a courier office pinned with illustrated character portraits"
      >
        <div className="pb-head-veil">
          <h2>Portrait Booth</h2>
          <p>
            The casting-office wall: every face on the Driftline, framed in faction colours.
            Empty frames are honest — open one, copy its re-roll prompt, and the painter can
            sit them again.
          </p>
        </div>
        <div className="pb-tally" aria-label="Art tally">
          <span>
            <strong>{painted}</strong>/{WALL.length} painted
          </span>
          {stale > 0 && (
            <span className="pb-tally-stale">
              <strong>{stale}</strong> frame{stale === 1 ? '' : 's'} stale
            </span>
          )}
        </div>
      </header>

      <div className="pb-toolbar" role="toolbar" aria-label="Wall filters">
        <div className="pb-chips">
          <button
            className={`pb-fchip ${filter === 'all' ? 'on' : ''}`}
            onClick={() => setFilter('all')}
            style={{ ['--fc' as string]: '#FFB454' }}
          >
            <i aria-hidden="true">◈</i> Everyone <b>{WALL.length}</b>
          </button>
          {FACTION_ORDER.filter((fid) => counts[fid]).map((fid) => {
            const f = FACTIONS[fid];
            return (
              <button
                key={fid}
                className={`pb-fchip ${filter === fid ? 'on' : ''}`}
                onClick={() => setFilter(filter === fid ? 'all' : fid)}
                style={{ ['--fc' as string]: f.color }}
              >
                <i aria-hidden="true">{f.glyph}</i> {f.name} <b>{counts[fid]}</b>
              </button>
            );
          })}
        </div>
        <input
          className="pb-search"
          type="search"
          placeholder="Search names, roles, towns…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search characters"
        />
      </div>

      {entries.length === 0 ? (
        <p className="pb-empty">Nobody by that name on the wall. Try the next settlement.</p>
      ) : (
        <ul className="pb-grid">
          {entries.map((e) => {
            const c = e.character;
            const state = paint[c.id] ?? 'unsat';
            const showImg = state === 'painted' && e.declaredArt;
            return (
              <li key={c.id}>
                <button
                  className={`pb-card pb-card-${state}`}
                  style={{ ['--fc' as string]: e.faction.color }}
                  onClick={() => setOpenId(c.id)}
                  aria-label={`Open portrait sheet for ${c.name}, ${c.role} (${PAINT_LABEL[state].toLowerCase()})`}
                >
                  <span className="pb-photo">
                    {showImg ? (
                      <img
                        src={withBase(e.declaredArt!)}
                        alt=""
                        loading="lazy"
                        onLoad={() => markOk(c.id)}
                        onError={() => markFail(c.id)}
                      />
                    ) : (
                      <span className="pb-monogram" aria-hidden="true">
                        {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </span>
                    )}
                    <span className="pb-stamp">{PAINT_LABEL[state]}</span>
                  </span>
                  <span className="pb-plate">
                    <strong>{c.name}</strong>
                    <span className="pb-role">{c.role}</span>
                    <span className="pb-chip">
                      <i aria-hidden="true">{e.faction.glyph}</i> {e.faction.name}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openIndex >= 0 && (
        <Lightbox
          entries={entries}
          index={openIndex}
          paint={paint}
          onClose={() => setOpenId(null)}
          onStep={step}
          onImgOk={markOk}
          onImgFail={markFail}
        />
      )}

      <footer className="pb-foot">
        <p>
          Framing follows the design rule: a faction glyph <em>and</em> its colour — never colour
          alone. Portraits live at <code>public/images/characters/&lt;id&gt;.jpg</code>, referenced
          from each character's <code>portrait</code> field and painted with the shared style block.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = PortraitBooth as typeof PortraitBooth & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

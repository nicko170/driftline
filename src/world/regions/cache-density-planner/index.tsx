/**
 * CACHE DENSITY & FAN-OUT PLANNER — the survey sheet.
 *
 * Every signal cache in the Glass Desert, drawn at the exact spot caches.ts
 * resolves for it: golden-angle fan-out, true 13 m capture discs, over an
 * honest contour survey of the shared heightfield. Region filter chips, teal
 * anchor threads, crowding pips (shape-first ▲/■), cross-anchor overlap
 * links, ghost slots for the next fan positions — and a live simulation lane:
 * paste a candidate caches.json row and watch it land before it commits.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [9200, 7600])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useEffect, useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { buildModel, resolverParity, regionStyle, type CacheRow } from './data';
import { SurveyMap } from './SurveyMap';
import { Diagnostics, SimPanel } from './Panels';
import { CacheCard } from './CacheCard';
import './planner.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function CacheDensityPlanner() {
  const [simRows, setSimRows] = useState<CacheRow[]>([]);
  const [focusRegion, setFocusRegion] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showCaptures, setShowCaptures] = useState(true);
  const [showFans, setShowFans] = useState(true);

  const model = useMemo(() => buildModel(simRows), [simRows]);
  const parity = useMemo(() => resolverParity(), []);

  const anchorsUsed = useMemo(
    () => [...model.anchorStats.values()].filter((a) => a.count > 0).length,
    [model.anchorStats],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      setSelectedId(null);
      setFocusRegion(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pinRows = (rows: CacheRow[]) => {
    setSimRows((prev) => [...prev, ...rows]);
    const first = rows[0];
    if (first) setFocusRegion(first.anchor.split(':')[0]);
  };

  const selected = selectedId ? model.caches.find((c) => c.id === selectedId) ?? null : null;
  const hovered = hoverId ? model.caches.find((c) => c.id === hoverId) ?? null : null;

  const amberN = model.crowded.filter((a) => a.level === 'amber').length;
  const redN = model.crowded.filter((a) => a.level === 'red').length;

  return (
    <div className="cdp-root">
      <header
        className="cdp-head"
        style={{ backgroundImage: `url(${withBase('images/work/cache-density-planner.jpg')})` }}
        role="img"
        aria-label="A surveyor's drafting table spread with a contour map of a desert, violet wax-seal markers and brass dividers"
      >
        <div className="cdp-head-veil">
          <h2>Cache Density &amp; Fan-Out Planner</h2>
          <p>
            Every signal cache on one sheet, drawn where <code>caches.ts</code> actually puts it — golden-angle
            fan-out, true 13&nbsp;m capture discs. Click a diamond to read what it guards; paste a candidate row and
            watch it land before it commits.
          </p>
        </div>
        <div className="cdp-tally" aria-label="Survey tally">
          <span>
            <strong>{model.caches.length - simRows.length}</strong> surveyed
          </span>
          {simRows.length > 0 && (
            <span className="cdp-tally-sim">
              <strong>+{simRows.length}</strong> pinned
            </span>
          )}
          <span>
            <strong>{anchorsUsed}</strong> stations
          </span>
          <span>
            <strong>{model.regions.length}</strong> regions
          </span>
          {amberN > 0 && (
            <span className="cdp-tally-flag amber">
              <strong>{amberN}</strong> ▲ crowded
            </span>
          )}
          {redN > 0 && (
            <span className="cdp-tally-flag red">
              <strong>{redN}</strong> ■ over the line
            </span>
          )}
          {model.overlaps.length > 0 && (
            <span className="cdp-tally-flag red">
              <strong>{model.overlaps.length}</strong> ◍ overlaps
            </span>
          )}
          <span className={`cdp-tally-parity ${parity.ok ? 'ok' : 'bad'}`}>
            resolver parity {parity.ok ? '✓' : `✗ drift ${parity.maxDrift.toFixed(3)} m`}
          </span>
        </div>
      </header>

      <div className="cdp-toolbar">
        <div className="cdp-chips" role="toolbar" aria-label="Region filters">
          <button
            className={`cdp-fchip ${focusRegion === null ? 'on' : ''}`}
            onClick={() => setFocusRegion(null)}
            aria-pressed={focusRegion === null}
          >
            <i aria-hidden="true">◈</i> Whole desert <b>{model.caches.length}</b>
          </button>
          {[...model.regions]
            .sort((a, b) => b.cacheCount - a.cacheCount || a.slug.localeCompare(b.slug))
            .map((r) => {
              const st = regionStyle(r.slug);
              return (
                <button
                  key={r.slug}
                  className={`cdp-fchip ${focusRegion === r.slug ? 'on' : ''}`}
                  style={{ ['--fc' as string]: st.color }}
                  onClick={() => setFocusRegion(focusRegion === r.slug ? null : r.slug)}
                  aria-pressed={focusRegion === r.slug}
                  title={st.note}
                >
                  <i aria-hidden="true">{st.glyph}</i> {r.slug.replace(/-/g, ' ')} <b>{r.cacheCount}</b>
                  {r.worstLevel === 'red' && (
                    <em className="lv-red" aria-label="has red-crowded anchors">
                      ■
                    </em>
                  )}
                  {r.worstLevel === 'amber' && (
                    <em className="lv-amber" aria-label="has amber-crowded anchors">
                      ▲
                    </em>
                  )}
                </button>
              );
            })}
        </div>
        <div className="cdp-toggles" role="group" aria-label="Sheet layers">
          <button className={`cdp-toggle ${showCaptures ? 'on' : ''}`} onClick={() => setShowCaptures((v) => !v)} aria-pressed={showCaptures}>
            ◉ capture discs
          </button>
          <button className={`cdp-toggle ${showFans ? 'on' : ''}`} onClick={() => setShowFans((v) => !v)} aria-pressed={showFans}>
            ⟡ fan spirals
          </button>
        </div>
      </div>

      <div className="cdp-main">
        <section className="cdp-mapwrap" aria-label="The survey sheet">
          <SurveyMap
            model={model}
            focusRegion={focusRegion}
            selectedId={selectedId}
            hoverId={hoverId}
            showCaptures={showCaptures}
            showFans={showFans}
            onSelect={setSelectedId}
            onHover={setHoverId}
          />
          <ul className="cdp-legend" aria-label="Legend">
            <li>
              <i className="lg lg-diamond" aria-hidden="true" /> signal cache · true 13 m capture disc
            </li>
            <li>
              <i className="lg lg-cross" aria-hidden="true" /> anchor station
            </li>
            <li>
              <i className="lg lg-thread" aria-hidden="true" /> intra-region thread
            </li>
            <li>
              <i className="lg lg-contour" aria-hidden="true" /> terrain contour (real heightfield)
            </li>
            <li>
              <i className="lg lg-ghost" aria-hidden="true" /> next fan slot (ghost)
            </li>
            <li>
              <i className="lg lg-sim" aria-hidden="true" /> simulated pin
            </li>
            <li>
              <i className="lg lg-overlap" aria-hidden="true" /> shared pickup zone
            </li>
          </ul>
          <p className="cdp-hover-read" aria-live="polite">
            {hovered
              ? `⟡ ${hovered.id} — slot k${hovered.k} on ${hovered.anchor} · ${model.loreBySlug.get(hovered.lore)?.title ?? hovered.lore}`
              : selected
                ? `⟡ ${selected.id} selected — reading card below`
                : 'Hover a diamond to read the station log; click for the full card. Esc clears focus.'}
          </p>
        </section>

        <aside className="cdp-side">
          <SimPanel model={model} simRows={simRows} onPin={pinRows} onClear={() => setSimRows([])} />
          <Diagnostics
            model={model}
            focusRegion={focusRegion}
            selectedId={selectedId}
            onSelectCache={setSelectedId}
            onFocusRegion={setFocusRegion}
          />
        </aside>
      </div>

      {selected && <CacheCard cache={selected} model={model} onClose={() => setSelectedId(null)} />}

      <footer className="cdp-foot">
        <p>
          Placements replay <code>src/game/caches.ts</code> to the centimetre — first cache sits on its anchor, extras fan out on a
          golden-angle spiral (<code>ang = k·2.399963, r = 5 + k·2.2</code>) — the header's parity badge proves this sheet and the shipped
          resolver still agree. Contours are traced from the real shared heightfield; the 13 m discs are true metres, the
          diamonds are screen-sized so they stay clickable at world zoom. Crowding thresholds (▲ past 6, ■ past 10) come
          straight from DESIGN.md — pips are shapes first, colour only decorates.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = CacheDensityPlanner as typeof CacheDensityPlanner & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

/**
 * CacheCard — the reading card. Clicking a diamond on the sheet opens the
 * codex entry it recovers, typeset with the game's own markdown-lite renderer
 * and category chrome, plus the survey particulars: fan slot k, resolved
 * coordinates, the anchor's standing (count, outer ring, spacing verdict) and
 * the distance to the nearest foreign cache. Simulated pins get a hot-amber
 * banner instead of pretending to be committed content.
 */
import { loreCategoryMeta, renderLoreBody } from '../../../lib/markdown';
import { CAPTURE_RADIUS, fmt, fmtM, regionStyle, type AnchorStats, type PlottedCache, type SurveyModel } from './data';

export interface CacheCardProps {
  cache: PlottedCache;
  model: SurveyModel;
  onClose: () => void;
}

export function CacheCard({ cache, model, onClose }: CacheCardProps) {
  const entry = model.loreBySlug.get(cache.lore);
  const anchor: AnchorStats | undefined = model.anchorStats.get(cache.anchor);
  const cat = loreCategoryMeta(entry?.category ?? 'log');
  const readMins = entry ? Math.max(1, Math.round(entry.words / 210)) : 0;
  const st = regionStyle(cache.region);

  // nearest foreign cache (spacing verdict line)
  let nearest: { id: string; dist: number } | null = null;
  for (const c of model.caches) {
    if (c.id === cache.id || c.anchor === cache.anchor) continue;
    const dx = c.x - cache.x;
    const dz = c.z - cache.z;
    if (Math.abs(dx) > 220 || Math.abs(dz) > 220) continue;
    const d = Math.hypot(dx, dz);
    if (!nearest || d < nearest.dist) nearest = { id: c.id, dist: d };
  }
  const crowdingNote =
    anchor && anchor.level !== 'ok'
      ? anchor.level === 'red'
        ? `■ over the line — ${anchor.count} caches on one anchor`
        : `▲ crowded — ${anchor.count} caches on one anchor`
      : anchor && anchor.count > 1
        ? `◦ ${anchor.count} caches share this anchor — fan-out holding`
        : '◦ alone on its anchor';

  return (
    <article className="cdp-card" aria-label={`Reading card for ${cache.id}`}>
      <header className="cdp-card-head">
        <div className="cdp-card-kicker">
          <i aria-hidden="true">⟡</i> SIGNAL CACHE SURVEY
          {cache.simulated && <em className="cdp-card-sim">✎ SIMULATED PIN — not in caches.json</em>}
        </div>
        <button className="btn cdp-card-close" onClick={onClose} aria-label="Close reading card">
          ✕
        </button>
      </header>

      <div className="cdp-card-body">
        <div className="cdp-card-meta">
          <h3>{entry?.title ?? cache.lore}</h3>
          <p className="cdp-card-sub">
            <span className="cdp-chip" style={{ ['--fc' as string]: cat.color }}>
              <i aria-hidden="true">{cat.glyph}</i> {cat.label}
            </span>
            <span className="cdp-chip" style={{ ['--fc' as string]: st.color }}>
              <i aria-hidden="true">{st.glyph}</i> {cache.region}
            </span>
            {entry && (
              <span className="cdp-chip">
                ✦ {fmt(entry.words)} words · ~{readMins} min
              </span>
            )}
          </p>
          {entry?.summary && <p className="cdp-card-summary">{entry.summary}</p>}

          <dl className="cdp-card-spec">
            <div>
              <dt>cache id</dt>
              <dd>
                <code>{cache.id}</code>
              </dd>
            </div>
            <div>
              <dt>station</dt>
              <dd>
                <code>{cache.anchor}</code> — {cache.anchorLabel}
              </dd>
            </div>
            <div>
              <dt>fan slot</dt>
              <dd>
                k{cache.k} · ring {fmtM(cache.k === 0 ? 0 : 5 + cache.k * 2.2)} · {fmt(cache.x, 1)}, {fmt(cache.z, 1)}
              </dd>
            </div>
            <div>
              <dt>standing</dt>
              <dd>{crowdingNote}</dd>
            </div>
            <div>
              <dt>airspace</dt>
              <dd>
                capture {CAPTURE_RADIUS} m · nearest foreign cache{' '}
                {nearest ? (
                  <>
                    {fmt(nearest.dist, 1)} m (<code>{nearest.id.replace(/^cache-/, '')}</code>)
                    {nearest.dist < CAPTURE_RADIUS * 2 ? ' — ◍ discs touch' : ''}
                  </>
                ) : (
                  'none in 220 m'
                )}
              </dd>
            </div>
          </dl>
        </div>

        {entry ? (
          <div className="cdp-card-reading">{renderLoreBody(entry.body, `cdp-${cache.id}`)}</div>
        ) : (
          <div className="cdp-card-reading">
            <p className="cdp-card-missing">■ No codex entry answers to “{cache.lore}” — the validator would catch this; the sheet refuses to pretend.</p>
          </div>
        )}
      </div>
    </article>
  );
}

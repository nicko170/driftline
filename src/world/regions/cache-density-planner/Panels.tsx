/**
 * Panels — the survey sheet's margin notes.
 *
 * DiagnosticPanel: crowding leaderboard (shape-first ▲/■ pips against the
 * DESIGN.md 6/10 thresholds), cross-anchor capture-disc overlaps, and —
 * when a region is focused — a per-anchor ledger with spacing verdicts and
 * "spread to" suggestions. SimPanel: paste a candidate caches.json row (or
 * array / wrapped { caches }) and pin it onto the sheet live, validated from
 * line one; copy the pins back out as clean JSON when the plan holds.
 */
import { useMemo, useState } from 'react';
import {
  CROWD_AMBER,
  CROWD_RED,
  OVERLAP_DIST,
  fmt,
  fmtM,
  parseSimRows,
  type CacheRow,
  type SurveyModel,
} from './data';

/* ---------------- diagnostics ---------------- */

export interface DiagnosticProps {
  model: SurveyModel;
  focusRegion: string | null;
  selectedId: string | null;
  onSelectCache: (id: string) => void;
  onFocusRegion: (slug: string) => void;
}

function Pips({ n, level }: { n: number; level: 'ok' | 'amber' | 'red' }) {
  const glyph = level === 'red' ? '■' : level === 'amber' ? '▲' : '◦';
  const cap = 14;
  return (
    <span className={`cdp-pips lv-${level}`} aria-label={`${n} cache${n === 1 ? '' : 's'} on this anchor`}>
      {Array.from({ length: Math.min(n, cap) }, (_, i) => (
        <i key={i} aria-hidden="true">
          {glyph}
        </i>
      ))}
      {n > cap && <em>+{n - cap}</em>}
      {n === 0 && <span className="cdp-pips-zero">—</span>}
    </span>
  );
}

export function Diagnostics({ model, focusRegion, selectedId, onSelectCache, onFocusRegion }: DiagnosticProps) {
  const focused = focusRegion ? model.regions.find((r) => r.slug === focusRegion) : undefined;

  const rows = useMemo(() => {
    const all = [...model.anchorStats.values()];
    if (focused) {
      return all.filter((a) => a.region === focused.slug).sort((a, b) => b.count - a.count || a.anchorId.localeCompare(b.anchorId));
    }
    return all.filter((a) => a.count >= CROWD_AMBER).sort((a, b) => b.count - a.count);
  }, [model.anchorStats, focused]);

  return (
    <section className="cdp-panel" aria-label="Crowding diagnostics">
      <h3>
        <i aria-hidden="true">▲</i> Crowding ledger
      </h3>
      <p className="cdp-panel-note">
        DESIGN.md tolerance: ≤6 per anchor with clean spacing ({fmt(5 + 6 * 2.2)} m outer ring). <b className="lv-amber">▲ amber past 6</b> ·{' '}
        <b className="lv-red">■ red past 10</b> — pips are shape-first, colour is decoration.
      </p>
      {rows.length === 0 ? (
        <p className="cdp-quiet">No anchor over the line. The desert is breathing easy.</p>
      ) : (
        <ul className="cdp-rows">
          {rows.map((a) => (
            <li key={a.key} className={`cdp-row lv-${a.level}`}>
              <button className="cdp-row-main" onClick={() => onFocusRegion(a.region)} title="Focus this region on the sheet">
                <span className="cdp-row-id">
                  <b>{a.anchorId}</b>
                  <small>{a.region}</small>
                </span>
                <Pips n={a.count} level={a.level} />
                <span className="cdp-row-nums">
                  ring {fmtM(a.outerR)} · gap {fmtM(a.minPairDist)} · cross {fmtM(a.crossNearest)}
                </span>
              </button>
              {a.spreadTo.length > 0 && (
                <p className="cdp-spread">
                  spread to{' '}
                  {a.spreadTo.map((s, i) => (
                    <span key={s.key}>
                      {i > 0 && ' or '}
                      <b>{s.key.split(':')[1]}</b> ({s.count}⟡, {fmt(s.dist)} m over)
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>
        <i aria-hidden="true">◍</i> Shared pickup zones
      </h3>
      <p className="cdp-panel-note">
        Two caches from <em>different</em> anchors whose capture discs touch (&lt; {OVERLAP_DIST} m) — one ride-through would trip both.
      </p>
      {model.overlaps.length === 0 ? (
        <p className="cdp-quiet">No cross-anchor overlaps. Every signal has its own airspace.</p>
      ) : (
        <ul className="cdp-rows cdp-overlaps">
          {model.overlaps.slice(0, 12).map((o, i) => (
            <li key={i} className="cdp-row lv-red">
              <div className="cdp-overlap">
                <button className={selectedId === o.a.id ? 'on' : ''} onClick={() => onSelectCache(o.a.id)}>
                  ⟡ {o.a.id.replace(/^cache-/, '')}
                </button>
                <span className="cdp-overlap-dist">{fmt(o.dist, 1)} m</span>
                <button className={selectedId === o.b.id ? 'on' : ''} onClick={() => onSelectCache(o.b.id)}>
                  ⟡ {o.b.id.replace(/^cache-/, '')}
                </button>
              </div>
              <small>
                {o.a.anchor} ↔ {o.b.anchor}
              </small>
            </li>
          ))}
          {model.overlaps.length > 12 && <li className="cdp-more">+{model.overlaps.length - 12} more pairs</li>}
        </ul>
      )}
    </section>
  );
}

/* ---------------- simulation ---------------- */

export interface SimPanelProps {
  model: SurveyModel;
  simRows: CacheRow[];
  onPin: (rows: CacheRow[]) => void;
  onClear: () => void;
}

const PLACEHOLDER = `Paste a new row to see it land, e.g.
{ "id": "cache-my-entry", "lore": "auditor-memos", "anchor": "drowned-array:relay-3" }
— a single object, an array, or a wrapped { "caches": [ … ] } all work.`;

export function SimPanel({ model, simRows, onPin, onClear }: SimPanelProps) {
  const [text, setText] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pinned, setPinned] = useState(0);
  const [copied, setCopied] = useState(false);

  const pin = () => {
    const res = parseSimRows(text, [...model.caches.filter((c) => !c.simulated), ...simRows]);
    setIssues(res.issues);
    setWarnings(res.dedupWarnings);
    if (res.rows.length) {
      onPin(res.rows);
      setPinned(res.rows.length);
      setText('');
    } else setPinned(0);
  };

  const copy = async () => {
    const json = JSON.stringify(simRows, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="cdp-panel cdp-sim" aria-label="Simulate new cache rows">
      <h3>
        <i aria-hidden="true">✎</i> Pin a row before you commit it
      </h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={5}
        spellCheck={false}
        aria-label="Candidate caches.json rows"
      />
      <div className="cdp-sim-actions">
        <button className="btn primary" onClick={pin} disabled={!text.trim()}>
          Pin to sheet
        </button>
        {simRows.length > 0 && (
          <>
            <button
              className="btn"
              onClick={() => {
                onClear();
                setPinned(0);
                setIssues([]);
                setWarnings([]);
              }}
            >
              Clear {simRows.length} pin{simRows.length === 1 ? '' : 's'}
            </button>
            <button className="btn" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy pins as JSON'}
            </button>
          </>
        )}
      </div>
      {pinned > 0 && (
        <p className="cdp-sim-ok">
          ◆ {pinned} row{pinned === 1 ? '' : 's'} pinned — hot amber on the sheet. Crowding, overlaps and ghost slots recomputed.
        </p>
      )}
      {issues.length > 0 && (
        <ul className="cdp-issues">
          {issues.map((s, i) => (
            <li key={i}>■ {s}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="cdp-issues warn">
          {warnings.map((s, i) => (
            <li key={i}>▲ {s}</li>
          ))}
        </ul>
      )}
      <p className="cdp-panel-note">
        Rows are validated the way <code>validate:content</code> does it — unique kebab id, lore slug that exists, on-world anchor —
        then resolved through the same fan-out the game uses. Simulated:{' '}
        <b>
          {simRows.map((r) => r.id.replace(/^cache-/, '')).join(', ') || 'none'}
          {simRows.length > 0 && ` (${model.caches.length - simRows.length} surveyed + ${simRows.length} pinned)`}
        </b>
      </p>
    </section>
  );
}

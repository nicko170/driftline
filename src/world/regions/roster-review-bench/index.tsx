/**
 * ROSTER REVIEW BENCH — the writing desk's casting call.
 *
 * Every Driftline character from src/content/characters/*.json rendered as
 * its true in-game dialogue card: painted portrait or initials fallback,
 * faction chip (glyph + colour, never colour alone), role, and one greeting /
 * bark / mission / radio line each, shuffled on a shared 4s tick so the whole
 * wall breathes without per-card timers. A live stage mounts the actual
 * DialogueBox and HUD radio ticker through the real game store — what writers
 * review is what ships. Audit rules (no portrait, declared art 404s, under
 * eight lines, empty core bucket) redraw a card as a dashed ghost frame with
 * a ▯ signal-not-recovered marker.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [8200, 7600])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  auditEntry,
  FACTION_ORDER,
  FACTIONS,
  factionCounts,
  ROSTER,
  type PaintState,
} from './data';
import { Card } from './Card';
import { LiveStage } from './LiveStage';
import './roster.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

const TICK_MS = 4200;

/* Declared files start optimistic (PORTRAIT LIVE) and demote themselves to
 * FRAME STALE if the <img> 404s; undeclared entries sit at AWAITING SITTING. */
function initialPaint(): Record<string, PaintState> {
  const paint: Record<string, PaintState> = {};
  for (const e of ROSTER) paint[e.character.id] = e.declaredArt ? 'painted' : 'unsat';
  return paint;
}

function RosterReviewBench() {
  const [paint, setPaint] = useState<Record<string, PaintState>>(initialPaint);
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [needsWork, setNeedsWork] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>('ketch');

  const markOk = useCallback((id: string) => {
    setPaint((p) => (p[id] === 'painted' ? p : { ...p, [id]: 'painted' }));
  }, []);
  const markFail = useCallback((id: string) => {
    setPaint((p) => ({ ...p, [id]: 'stale' }));
  }, []);

  /* One shared beat: every card shuffles its lines together. Honour reduced
   * motion by parking the tick — lines stay put, click cards for variety. */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROSTER.filter((e) => {
      if (filter !== 'all' && e.faction.id !== filter) return false;
      if (needsWork && !auditEntry(e, paint[e.character.id] ?? 'unsat').flagged) return false;
      if (!q) return true;
      const c = e.character;
      return `${c.name} ${c.role} ${c.home} ${c.id}`.toLowerCase().includes(q);
    });
  }, [filter, needsWork, query, paint]);

  const selected = useMemo(
    () => ROSTER.find((e) => e.character.id === selectedId)?.character ?? null,
    [selectedId],
  );

  const counts = useMemo(factionCounts, []);
  const painted = ROSTER.filter((e) => paint[e.character.id] === 'painted').length;
  const flagged = ROSTER.filter(
    (e) => auditEntry(e, paint[e.character.id] ?? 'unsat').flagged,
  ).length;

  return (
    <div className="rrb-root">
      <header
        className="rrb-head"
        style={{ backgroundImage: `url(${withBase('images/work/roster-review-bench.jpg')})` }}
        role="img"
        aria-label="A writing desk in a salt-flats radio shack, reviewed character cards pinned along a string of amber bulbs"
      >
        <div className="rrb-head-veil">
          <h2>Roster Review Bench</h2>
          <p>
            Every voice on the Driftline, read the way the player will read it: the real dialogue
            card, the real box, the real radio ticker. Dashed ghost frames mark sheets the painter
            or the writer still owes — the ▯ shape carries the news, never the colour alone.
          </p>
        </div>
        <div className="rrb-tally" aria-label="Roster tally">
          <span>
            <strong>{ROSTER.length}</strong> on the roster
          </span>
          <span>
            <strong>{painted}</strong>/{ROSTER.length} portraits live
          </span>
          {flagged > 0 && (
            <span className="rrb-tally-flag">
              ▯ <strong>{flagged}</strong> flagged
            </span>
          )}
        </div>
      </header>

      <div className="rrb-toolbar" role="toolbar" aria-label="Roster filters">
        <div className="rrb-chips">
          <button
            className={`rrb-fchip ${filter === 'all' ? 'on' : ''}`}
            onClick={() => setFilter('all')}
            style={{ ['--fc' as string]: '#FFB454' }}
          >
            <i aria-hidden="true">◈</i> Everyone <b>{ROSTER.length}</b>
          </button>
          {FACTION_ORDER.filter((fid) => counts[fid]).map((fid) => {
            const f = FACTIONS[fid];
            return (
              <button
                key={fid}
                className={`rrb-fchip ${filter === fid ? 'on' : ''}`}
                onClick={() => setFilter(filter === fid ? 'all' : fid)}
                style={{ ['--fc' as string]: f.color }}
              >
                <i aria-hidden="true">{f.glyph}</i> {f.name} <b>{counts[fid]}</b>
              </button>
            );
          })}
          <button
            className={`rrb-fchip rrb-fchip-work ${needsWork ? 'on' : ''}`}
            onClick={() => setNeedsWork((w) => !w)}
            style={{ ['--fc' as string]: '#E4572E' }}
            aria-pressed={needsWork}
          >
            <i aria-hidden="true">▯</i> Needs work <b>{flagged}</b>
          </button>
        </div>
        <input
          className="rrb-search"
          type="search"
          placeholder="Search names, roles, towns, ids…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the roster"
        />
      </div>

      <LiveStage selected={selected} />

      {entries.length === 0 ? (
        <p className="rrb-empty panel">
          Nobody on that frequency. Loosen the filters or spell the name the way they do.
        </p>
      ) : (
        <ul className="rrb-grid">
          {entries.map((e) => (
            <li key={e.character.id}>
              <Card
                entry={e}
                tick={tick}
                paint={paint[e.character.id] ?? 'unsat'}
                selected={selectedId === e.character.id}
                onSelect={setSelectedId}
                onImgOk={markOk}
                onImgFail={markFail}
              />
            </li>
          ))}
        </ul>
      )}

      <footer className="rrb-foot">
        <p>
          Review rules the bench enforces: cards render with the game’s own <code>.dialogue-*</code>{' '}
          classes and 64px portrait framing; lines shuffle every {TICK_MS / 1000}s on one shared
          tick (parked under <em>prefers-reduced-motion</em>); audit flags use the ▯ ghost marker —
          <em> shape carries meaning, colour is decoration</em>. The stage above mounts the
          unmodified DialogueBox and drives the ticker through <code>say()</code>, so overflow,
          fades and the 7s subtitle window are the shipped behaviour.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = RosterReviewBench as typeof RosterReviewBench & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

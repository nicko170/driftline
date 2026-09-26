/**
 * REP LEDGER BENCH — the balance desk's field survey.
 *
 * Every reputation point across src/content/missions/*.json, drawn four ways
 * on canvas2d: a chapter→faction flow sheet (ribbons, faction glyphs, hover
 * tooltips), standing rails from WARY to KIN with story-only vs completionist
 * markers, a per-chapter waterfall on one honest shared scale, and completion-
 * ist journey sparklines against tier bands. Below the charts, audit flags
 * call out factions stranded under their next rail and story missions whose
 * deltas pay both ends of a feud — and a one-click export copies the whole
 * ledger as a rebalance table for the writers' shared sheet.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [8800, 7000])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it. No scene steering: pure canvas charts over live content.
 */
import { useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  ALL_END,
  FACTIONS,
  FACTION_BY_ID,
  FLAGS,
  FLOW_CELLS,
  GRAND_TOTAL,
  NODES,
  ROWS,
  STORY_END,
  STORY_TOTAL,
  TIERS,
  WARN_COUNT,
  buildExport,
  tierFor,
} from './data';
import { FlowCanvas } from './FlowCanvas';
import { RailsCanvas } from './RailsCanvas';
import { WaterfallCanvas } from './WaterfallCanvas';
import { JourneyCanvas } from './JourneyCanvas';
import './ledger.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function RepLedgerBench() {
  const [copied, setCopied] = useState(false);

  const copyTable = async () => {
    const text = buildExport();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rlb-root">
      {/* ---------------- header ---------------- */}
      <header
        className="rlb-head"
        style={{ backgroundImage: `url(${withBase('images/work/rep-ledger-bench.jpg')})` }}
        role="img"
        aria-label="A field-surveyor's chart table in a violet-dark caravan, faction-coloured ribbons of string pinned between chapter cards and faction sigils, brass tally counters and sand-dusted annotation tags"
      >
        <div className="rlb-head-veil">
          <p className="rlb-kicker">FIELD-SURVEY · BALANCE DESK</p>
          <h2>Rep Ledger Bench</h2>
          <p>
            Every point of reputation the content pays, drawn the way a surveyor would: ribbons from
            each chapter to each faction, rails the standing must climb, and flags where the ledger
            strands somebody short. Shape carries the news everywhere — colour is decoration.
          </p>
        </div>
        <div className="rlb-tally" aria-label="Ledger tally">
          <span>
            <strong>{ROWS.length}</strong> missions read live
          </span>
          <span>
            <strong>{GRAND_TOTAL}</strong> rep in circulation
          </span>
          <span>
            <strong>{GRAND_TOTAL - STORY_TOTAL}</strong> from the side board
          </span>
          {WARN_COUNT > 0 && (
            <span className="rlb-tally-flag">
              ▯ <strong>{WARN_COUNT}</strong> warn flag{WARN_COUNT === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </header>

      {/* ---------------- toolbar: tier legend + export ---------------- */}
      <div className="rlb-toolbar">
        <div className="rlb-tiers" role="list" aria-label="Standing tiers">
          {TIERS.map((t) => (
            <span className="rlb-tier" role="listitem" key={t.id} style={{ ['--tc' as string]: t.color }}>
              <i aria-hidden="true">{t.glyph}</i> {t.label}{' '}
              <b>{t.until == null ? `${t.min}+` : t.min === -Infinity ? `<0` : `${t.min}–${t.until - 1}`}</b>
            </span>
          ))}
        </div>
        <button className="rlb-copy" onClick={copyTable} aria-live="polite">
          {copied ? '✓ ledger copied' : '⎘ copy rebalance table'}
        </button>
      </div>

      {/* ---------------- 1 · the flow ---------------- */}
      <section className="rlb-sheet">
        <header className="rlb-sheet-head">
          <h3>
            <i aria-hidden="true">⇄</i> Where the rep flows
          </h3>
          <p>
            Chapters on the left, factions on the right; ribbon width is reputation. Hover a ribbon
            for the mission count, a node for its total.
          </p>
        </header>
        <FlowCanvas />
        <details className="rlb-flowtable">
          <summary>Ledger flow table (every cell, for screen readers and grumpy spreadsheets)</summary>
          <table>
            <thead>
              <tr>
                <th>Chapter</th>
                {FACTIONS.map((f) => (
                  <th key={f.id}>
                    {f.glyph} {f.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NODES.map((n) => (
                <tr key={n.key}>
                  <th>
                    {n.label} — {n.title}
                  </th>
                  {FACTIONS.map((f) => {
                    const cell = FLOW_CELLS.find((c) => c.chapter === n.key && c.faction === f.id);
                    return <td key={f.id}>{cell ? `+${cell.amount} (${cell.count})` : '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {/* ---------------- 2 · the rails ---------------- */}
      <section className="rlb-sheet">
        <header className="rlb-sheet-head">
          <h3>
            <i aria-hidden="true">▤</i> The rails
          </h3>
          <p>
            Hollow glyphs mark where the story alone leaves each faction; solid glyphs where every
            posted job lands them. The hatched strip between is the side board’s contribution; a
            dashed amber tail is distance still owed to the next rail. The hostile band exists —
            nothing in the ledger writes to it.
          </p>
        </header>
        <RailsCanvas />
      </section>

      {/* ---------------- 3 · the waterfall ---------------- */}
      <section className="rlb-sheet">
        <header className="rlb-sheet-head">
          <h3>
            <i aria-hidden="true">▥</i> Who pays, chapter by chapter
          </h3>
          <p>
            One shared scale, so the rows stay honest. Solid bars are plot; the hatched SIDE column
            is board work. A sand <code>·0</code> marks a silent chapter — nobody in that faction got
            paid.
          </p>
        </header>
        <WaterfallCanvas />
      </section>

      {/* ---------------- 4 · the journey ---------------- */}
      <section className="rlb-sheet">
        <header className="rlb-sheet-head">
          <h3>
            <i aria-hidden="true">〽</i> The completionist journey
          </h3>
          <p>
            Four cumulative sparklines walked mission by mission in posted order — story chapters
            first, side board last. Tier bands run behind the curves; chapter-end pips carry the
            faction glyph; the right gutter lands the final standings.
          </p>
        </header>
        <JourneyCanvas />
      </section>

      {/* ---------------- 5 · flags ---------------- */}
      <section className="rlb-sheet">
        <header className="rlb-sheet-head">
          <h3>
            <i aria-hidden="true">▯</i> Flags from the bench
          </h3>
          <p>
            {FLAGS.length} finding{FLAGS.length === 1 ? '' : 's'} — warn flags carry the ▯ family of
            markers (⚠ for stranded factions, ⇄ for hedged deltas), notes ride ◌.
          </p>
        </header>
        <ul className="rlb-flags">
          {FLAGS.map((f) => (
            <li key={f.id} className={`rlb-flag rlb-flag-${f.severity}`}>
              <span className="rlb-flag-glyph" aria-hidden="true">
                {f.glyph}
              </span>
              <div>
                <h4>{f.title}</h4>
                <p>{f.detail}</p>
                {(f.factions.length > 0 || f.missions.length > 0) && (
                  <p className="rlb-flag-marks">
                    {f.factions.map((fid) => {
                      const fac = FACTION_BY_ID[fid];
                      return (
                        <span key={fid} style={{ ['--fc' as string]: fac.color }}>
                          {fac.glyph} {fac.name}
                        </span>
                      );
                    })}
                    {f.missions.map((mid) => (
                      <code key={mid}>{mid}</code>
                    ))}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="rlb-foot">
        <p>
          Method: the bench reads the shipped mission library at load — no fixtures. Story chapters
          are plotted in posted order (library sort: chapter, then id), then the side board. Rails
          are the bench’s proposal (<em>wary 0–14 · neutral 15–39 · friendly 40–79 · kin 80+</em>);
          the save itself stores raw rep per faction, and <code>requires.rep</code> gates exist in
          the runtime but are used by {`${ROWS.filter((r) => r.mission.requires?.rep && Object.keys(r.mission.requires.rep).length).length}`}{' '}
          missions today. Story-only ends:{' '}
          {FACTIONS.map((f) => `${f.glyph} ${f.short} ${STORY_END[f.id]} (${tierFor(STORY_END[f.id]).label.toLowerCase()})`).join(' · ')}
          ; completionist ends:{' '}
          {FACTIONS.map((f) => `${f.glyph} ${f.short} ${ALL_END[f.id]} (${tierFor(ALL_END[f.id]).label.toLowerCase()})`).join(' · ')}
          . Hedging uses the canon feuds (salvage rights, infrastructure rites) with a ±5 threshold.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = RepLedgerBench as typeof RepLedgerBench & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

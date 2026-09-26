/**
 * RadioDeck — the card table's radio corner. Restages the shipped HUD ticker:
 * the band tag (`RADIO · <BAND>` / `RADIO · LONG STATIC`), one seeded
 * voice+line pick per spin of the dial, the exact cadence note, and the full
 * voice ledger — every voice's weight, boosts and share of the dial at the
 * current band and slider standings, with a 400-roll Monte Carlo chip
 * checking the bench against itself.
 */
import { useMemo } from 'react';
import {
  CAST,
  FACTION_BY_ID,
  LINES_PER_MIN,
  monteCarlo,
  rollLine,
  weighCast,
  type RepState,
} from './data';
import type { RegionMeta } from '../../registry';

export default function RadioDeck({
  rep,
  band,
  spin,
  onSpin,
}: {
  rep: RepState;
  band: RegionMeta | null;
  spin: number;
  onSpin: () => void;
}) {
  const local = band?.slug ?? null;
  const weights = useMemo(() => weighCast(local, rep), [local, rep]);
  const pick = useMemo(() => rollLine(local, rep, 1301 + spin * 7919), [local, rep, spin]);
  const mc = useMemo(() => monteCarlo(local, rep), [local, rep]);

  const top = weights.slice(0, 14);
  const hidden = weights.length - top.length;
  const maxW = top[0]?.weight ?? 1;
  const picked = weights.find((w) => w.voice.id === pick.who);

  return (
    <div className="rra-deck">
      {/* the restaged ticker */}
      <div className="rra-ticker panel" aria-live="polite">
        <span className="rra-ticker-tag">{band ? `RADIO · ${band.name.toUpperCase()}` : 'RADIO · LONG STATIC'}</span>
        <span className="rra-ticker-line">
          <strong>{pick.name}:</strong> {pick.line}
        </span>
        <button className="btn rra-spin" onClick={onSpin}>
          ⟳ spin the dial
        </button>
      </div>
      <p className="rra-deck-note dim">
        Restaged from the shipping tick: 14 s cadence · 30 % call chance while riding · ~
        {LINES_PER_MIN.toFixed(1)} lines/min at <em>every</em> standing — rep changes who, never how often. Voice and
        line are seeded per spin so scrubbing the gauges never re-rolls the subtitle.
        {local ? '' : ' No local band here: nobody gets the +6 home bonus and long-range voices stay in the mix.'}
      </p>

      {/* ledger */}
      <div className="rra-ledger" role="table" aria-label="Voice ledger — weight and share of the dial per voice">
        <div className="rra-ledger-row rra-ledger-head" role="row">
          <span role="columnheader">voice</span>
          <span role="columnheader">home</span>
          <span role="columnheader">why the weight</span>
          <span role="columnheader" className="rra-ledger-num">share</span>
        </div>
        {top.map((w) => {
          const fac = FACTION_BY_ID[w.voice.faction];
          const isPick = w.voice.id === pick.who;
          return (
            <div
              key={w.voice.id}
              role="row"
              className={`rra-ledger-row${isPick ? ' is-air' : ''}`}
              style={{ ['--fc' as string]: fac?.color ?? '#8A8578' }}
            >
              <span role="cell" className="rra-ledger-name">
                <i aria-hidden="true">{fac?.glyph ?? '·'}</i> {w.voice.name}
                {isPick && <b className="rra-onduty">ON AIR</b>}
              </span>
              <span role="cell" className="rra-ledger-home">
                {w.voice.home}
                {local && w.voice.home === local ? ' ◂ home' : ''}
              </span>
              <span role="cell" className="rra-ledger-why">
                <span className="rra-w">×{w.weight.toFixed(1)}</span>
                {w.boosts.map((b) => (
                  <em key={b}>{b}</em>
                ))}
              </span>
              <span role="cell" className="rra-ledger-num">
                <span className="rra-bar" aria-hidden="true">
                  <span style={{ width: `${(w.weight / maxW) * 100}%` }} />
                </span>
                <b>{(w.p * 100).toFixed(1)}%</b>
              </span>
            </div>
          );
        })}
        {hidden > 0 && (
          <div className="rra-ledger-row rra-ledger-rest" role="row">
            <span role="cell" className="rra-ledger-name">
              ·· {hidden} more voice{hidden === 1 ? '' : 's'} on the cast
            </span>
            <span role="cell" className="rra-ledger-home">everywhere / nowhere</span>
            <span role="cell" className="rra-ledger-why">
              <span className="rra-w">×1.0</span>
              <em>no home, no standing</em>
            </span>
            <span role="cell" className="rra-ledger-num">
              <b>{(weights.slice(top.length).reduce((s, w) => s + w.p, 0) * 100).toFixed(1)}% pooled</b>
            </span>
          </div>
        )}
      </div>

      {/* sanity chip */}
      <p className="rra-mc dim">
        <strong>{mc.rolls} seeded rolls:</strong> top voice by weight{' '}
        <code>{mc.topAnalytic}</code>
        {mc.agree ? (
          <>
            {' '}· Monte Carlo agrees (<code>{mc.topSampled}</code>, max share gap {mc.maxDeltaPts.toFixed(1)} pts)
          </>
        ) : (
          <>
            {' '}· Monte Carlo crowned <code>{mc.topSampled}</code> instead — max share gap{' '}
            {mc.maxDeltaPts.toFixed(1)} pts on {mc.rolls} rolls; tight races shrug like that
          </>
        )}
        . The picked voice is <code>{picked?.voice.id ?? pick.who}</code> at weight ×
        {(picked?.weight ?? 1).toFixed(1)}. One cast of {CAST.length} voices, live from the character library.
      </p>
    </div>
  );
}

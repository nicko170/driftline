/**
 * Radio Weight Sandbox — the histogram. Every voice gets a row: stacked
 * theoretical share (bone base / amber home-band / teal lifers / rust rep,
 * per DESIGN faction and contribution language) beside a hatched observed bar
 * once dice have been rolled. Shape-labelled legend keeps it CVD-safe.
 */
import type { WeightRow } from './weights';
import { factionMeta, noiseBandPts } from './weights';

const CONTRIB = [
  { key: 'base', label: 'base · everyone talks', color: '#E4D7BE', glyph: '□' },
  { key: 'local', label: 'home band · +6', color: '#FFB454', glyph: '◆' },
  { key: 'lifer', label: 'driftline lifer · +1', color: '#57C4B8', glyph: '◉' },
  { key: 'repBonus', label: 'rep favour · ≤ +8', color: '#B3502E', glyph: '▲' },
] as const;

export function ContribLegend() {
  return (
    <div className="rws-legend" aria-label="Contribution legend">
      {CONTRIB.map((c) => (
        <span key={c.key} className="rws-legend-item">
          <i style={{ background: c.color }} aria-hidden />
          <span aria-hidden>{c.glyph}</span> {c.label}
        </span>
      ))}
      <span className="rws-legend-item">
        <i className="rws-legend-hatch" aria-hidden /> observed (dice)
      </span>
    </div>
  );
}

export function Histogram({
  rows,
  counts,
  rolls,
  band,
}: {
  rows: WeightRow[];
  counts: Record<string, number>;
  rolls: number;
  band: string | null;
}) {
  const maxShare = rows.length ? Math.max(...rows.map((r) => r.share)) : 1;
  const maxObs = rolls > 0 ? Math.max(...rows.map((r) => (counts[r.id] ?? 0) / rolls)) : 0;
  const scale = Math.max(maxShare, maxObs) || 1;

  // deviation ruler: worst |obs − theo| vs the 3σ band of the loudest voice
  let maxDev = 0;
  if (rolls > 0) {
    for (const r of rows) {
      const dev = Math.abs((counts[r.id] ?? 0) / rolls - r.share);
      if (dev > maxDev) maxDev = dev;
    }
  }
  const sigma = noiseBandPts(rows[0]?.share ?? 0, rolls);
  const devOk = maxDev <= sigma * 1.35; // a little slack: we test 4σ-ish across many voices

  // "locals speak loudest at home" — combined airtime of the band's own voices
  const locals = band ? rows.filter((r) => r.home === band) : [];
  const localsTheo = locals.reduce((s, r) => s + r.share, 0);
  const localsObs = rolls > 0 ? locals.reduce((s, r) => s + (counts[r.id] ?? 0) / rolls, 0) : null;

  return (
    <section className="rws-histo panel" aria-label="Voice share histogram">
      <div className="rws-histo-head">
        <h3>Who gets heard</h3>
        <ContribLegend />
      </div>

      {band && locals.length > 0 && (
        <p className="rws-locals-line">
          ◆ locals of this band hold <strong>{(localsTheo * 100).toFixed(1)}%</strong> of the airtime
          {localsObs !== null && (
            <>
              {' '}
              · dice say <strong>{(localsObs * 100).toFixed(1)}%</strong>
            </>
          )}
        </p>
      )}

      <ul className="rws-rows">
        {rows.map((r) => {
          const fm = factionMeta(r.faction);
          const obs = rolls > 0 ? (counts[r.id] ?? 0) / rolls : 0;
          const segs: [keyof WeightRow, string][] = [
            ['base', '#E4D7BE'],
            ['local', '#FFB454'],
            ['lifer', '#57C4B8'],
            ['repBonus', '#B3502E'],
          ];
          return (
            <li key={r.id} className="rws-row">
              <span className="rws-row-id">
                <span className="rws-chip" style={{ borderColor: fm.color, color: fm.color }} title={fm.label}>
                  <span aria-hidden>{fm.glyph}</span>
                </span>
                <span className="rws-row-name" title={r.id}>
                  {r.name}
                </span>
                <span className="rws-row-home">{r.home}</span>
                <span className="rws-row-pct">{(r.share * 100).toFixed(1)}%</span>
              </span>
              <span className="rws-bars">
                <span className="rws-bar theo" role="img" aria-label={`theoretical share ${(r.share * 100).toFixed(1)} percent`}>
                  {segs.map(([k, color]) => {
                    const v = r[k] as number;
                    if (!v) return null;
                    const denom = r.base + r.local + r.lifer + r.repBonus;
                    return (
                      <i
                        key={k}
                        style={{ background: color, width: `${(v / denom) * r.share * 100 / scale}%` }}
                        className={k === 'base' ? 'dim' : ''}
                      />
                    );
                  })}
                </span>
                {rolls > 0 && (
                  <span
                    className="rws-bar obs"
                    role="img"
                    aria-label={`observed share ${(obs * 100).toFixed(1)} percent`}
                  >
                    <i style={{ width: `${(obs * 100) / scale}%` }} />
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="rws-dev" data-ok={rolls === 0 ? undefined : devOk}>
        {rolls === 0 ? (
          <span>roll the dice to fill the observed bars</span>
        ) : (
          <span>
            {devOk ? '✓' : '▸'} max deviation {Math.round(maxDev * 1000) / 10} pts · 3σ noise band ±
            {Math.round(sigma * 1000) / 10} pts on the loudest voice
            {!devOk && ' — suspicious; roll more or check the math'}
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * Radio Weight Sandbox — console panels: band plinths, simulated rep sliders,
 * the dice roller and the weights JSON export.
 */
import type { Band, RepFaction, RepInput, WeightRow } from './weights';
import { REP_FACTIONS, REP_CAP, REP_RATE, factionMeta, repBonus } from './weights';

/* ---------- band select (mirrors the plinth ring on stage) ---------- */

export function BandPanel({
  bands,
  band,
  onBand,
}: {
  bands: Band[];
  band: string | null;
  onBand: (slug: string | null) => void;
}) {
  return (
    <section className="rws-panel panel" aria-label="Band plinths">
      <h3>
        Band <span className="rws-hint">who&rsquo;s local</span>
      </h3>
      <ul className="rws-bandlist">
        {bands.map((b) => {
          const active = band === b.slug;
          return (
            <li key={b.slug ?? 'long-static'}>
              <button
                type="button"
                className={`rws-band${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => onBand(b.slug)}
              >
                <span className="rws-band-mark" aria-hidden>
                  {active ? '◆' : '◇'}
                </span>
                <span className="rws-band-name">{b.name}</span>
                {b.slug === null ? (
                  <span className="rws-band-sub">nobody&rsquo;s home band</span>
                ) : (
                  <span className="rws-band-sub">
                    {b.locals > 0 ? `+6 ×${b.locals} local${b.locals === 1 ? '' : 's'}` : 'no locals live here'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- simulated rep ---------- */

export function RepPanel({ rep, onRep }: { rep: RepInput; onRep: (f: RepFaction, v: number) => void }) {
  return (
    <section className="rws-panel panel" aria-label="Simulated faction reputation">
      <h3>
        Reputation <span className="rws-hint">simulated — never written</span>
      </h3>
      {REP_FACTIONS.map((f) => {
        const fm = factionMeta(f);
        const bonus = repBonus(f, rep);
        return (
          <div className="rws-slider" key={f}>
            <label htmlFor={`rws-rep-${f}`}>
              <span className="rws-chip" style={{ borderColor: fm.color, color: fm.color }}>
                <span aria-hidden>{fm.glyph}</span> {fm.label}
              </span>
              <span className="rws-slider-vals">
                <span className="rws-slider-rep">{rep[f]}</span>
                <span className="rws-slider-bonus" title={`rep × ${REP_RATE}, capped at +${REP_CAP}`}>
                  +{bonus.toFixed(1)} airtime
                </span>
              </span>
            </label>
            <input
              id={`rws-rep-${f}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={rep[f]}
              onChange={(e) => onRep(f, Number(e.target.value))}
            />
          </div>
        );
      })}
    </section>
  );
}

/* ---------- the roller ---------- */

export function RollPanel({
  rolls,
  total,
  voices,
  onRoll,
  onReset,
}: {
  rolls: number;
  total: number;
  voices: number;
  onRoll: (n: number) => void;
  onReset: () => void;
}) {
  return (
    <section className="rws-panel panel" aria-label="Dice roller">
      <h3>
        The dice <span className="rws-hint">same walk the HUD runs</span>
      </h3>
      <div className="rws-rollrow">
        <button type="button" className="btn primary" onClick={() => onRoll(100)}>
          Roll 100 <kbd>R</kbd>
        </button>
        <button type="button" className="btn" onClick={() => onRoll(1000)}>
          Roll 1000
        </button>
        <button type="button" className="btn" onClick={onReset} disabled={rolls === 0}>
          Reset <kbd>X</kbd>
        </button>
      </div>
      <p className="rws-rollstat">
        <strong>{rolls.toLocaleString()}</strong> transmissions rolled · Σ weight{' '}
        <strong>{total.toFixed(1)}</strong> over <strong>{voices}</strong> voices
      </p>
      <p className="rws-hint">Re-tuning a band or slider clears the run — stale dice lie.</p>
    </section>
  );
}

/* ---------- export ---------- */

export function ExportPanel({
  payload,
  copied,
  onCopy,
}: {
  payload: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="rws-panel panel" aria-label="Export weights as JSON">
      <h3>
        Export <span className="rws-hint">weights + observed counts</span>
      </h3>
      <button type="button" className="btn" onClick={onCopy}>
        {copied ? 'Copied ◆' : 'Copy weights JSON'}
      </button>
      <details className="rws-jsonpeek">
        <summary>preview</summary>
        <pre>{payload}</pre>
      </details>
    </section>
  );
}

// re-export for index convenience
export type { WeightRow };

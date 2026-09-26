/**
 * Panel — the bench controls: scripted wallet (presets + sliders), stage
 * variant/width, motion knobs, sound, debt-callout placement.
 */
import { MAX_LEVEL, WALLET_PRESETS, type Wallet } from './wallet';

export interface Bench {
  view: 'tuned' | 'baseline' | 'split';
  width: number; // 0 = full fluid
  slow: boolean;
  sound: boolean;
  debtCallout: 'ledger' | 'strip' | 'none';
  affirmMs: number;
  pipStagger: number;
}

const WIDTHS: { w: number; label: string }[] = [
  { w: 390, label: 'phone 390' },
  { w: 768, label: 'tablet 768' },
  { w: 1104, label: 'laptop 1104' },
  { w: 0, label: 'full' },
];

export function Panel({
  wallet,
  bench,
  onPreset,
  onPatch,
  onBench,
}: {
  wallet: Wallet;
  bench: Bench;
  /** Load a scripted preset wholesale (announced). */
  onPreset: (w: Wallet) => void;
  /** Patch numbers/levels silently (sliders, all-stock/maxed). */
  onPatch: (w: Wallet) => void;
  onBench: (b: Partial<Bench>) => void;
}) {
  const cleared = wallet.debt <= 0;
  return (
    <div className="gsl-controls panel">
      <div className="gsl-ctl-group" role="group" aria-label="Scripted wallet presets">
        <span className="gsl-ctl-label">Wallet</span>
        {WALLET_PRESETS.map((p) => (
          <button
            key={p.id}
            className="gsl-chip"
            onClick={() => onPreset(p.wallet)}
            title={`Load scripted wallet: ${p.label}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="gsl-ctl-group gsl-sliders">
        <label className="gsl-slider">
          <span>credits <b>{wallet.credits.toLocaleString()}</b></span>
          <input
            type="range"
            min={0}
            max={9999}
            step={10}
            value={wallet.credits}
            onChange={(e) => onPatch({ ...wallet, credits: Number(e.target.value) })}
            aria-label="Scripted credits"
          />
        </label>
        <label className="gsl-slider">
          <span>debt <b>{wallet.debt.toLocaleString()}</b>{cleared ? ' · clear title' : ''}</span>
          <input
            type="range"
            min={0}
            max={8000}
            step={50}
            value={wallet.debt}
            onChange={(e) => onPatch({ ...wallet, debt: Number(e.target.value) })}
            aria-label="Scripted Guild debt"
          />
        </label>
      </div>

      <div className="gsl-ctl-group" role="group" aria-label="Upgrade levels">
        <span className="gsl-ctl-label">Fitted</span>
        <button
          className="gsl-chip"
          onClick={() =>
            onPatch({ ...wallet, upgrades: { engine: 0, handling: 0, boost: 0, shield: 0, paint: wallet.upgrades.paint } })
          }
        >
          All stock
        </button>
        <button
          className="gsl-chip"
          onClick={() =>
            onPatch({ ...wallet, upgrades: { engine: MAX_LEVEL, handling: MAX_LEVEL, boost: MAX_LEVEL, shield: MAX_LEVEL, paint: wallet.upgrades.paint } })
          }
        >
          All maxed
        </button>
      </div>

      <div className="gsl-ctl-group" role="group" aria-label="Stage variant">
        <span className="gsl-ctl-label">Stage</span>
        {(['tuned', 'split', 'baseline'] as const).map((v) => (
          <button
            key={v}
            className={`gsl-chip ${bench.view === v ? 'on' : ''}`}
            aria-pressed={bench.view === v}
            onClick={() => onBench({ view: v })}
          >
            {v === 'tuned' ? 'Tuned' : v === 'split' ? 'Tuned × baseline' : 'Baseline'}
          </button>
        ))}
      </div>

      <div className="gsl-ctl-group" role="group" aria-label="Stage width">
        <span className="gsl-ctl-label">Width</span>
        {WIDTHS.map(({ w, label }) => (
          <button
            key={w || 'full'}
            className={`gsl-chip ${bench.width === w ? 'on' : ''}`}
            aria-pressed={bench.width === w}
            onClick={() => onBench({ width: w })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="gsl-ctl-group" role="group" aria-label="Debt callout placement (tuned shop)">
        <span className="gsl-ctl-label">Bond</span>
        {(['ledger', 'strip', 'none'] as const).map((d) => (
          <button
            key={d}
            className={`gsl-chip ${bench.debtCallout === d ? 'on' : ''}`}
            aria-pressed={bench.debtCallout === d}
            onClick={() => onBench({ debtCallout: d })}
            title={d === 'ledger' ? 'Full Exchange ledger card in the grid' : d === 'strip' ? 'One-line strip under the header' : 'Hide the bond from the garage (baseline behaviour)'}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="gsl-ctl-group gsl-sliders">
        <label className="gsl-slider">
          <span>affirm <b>{bench.affirmMs} ms</b></span>
          <input
            type="range"
            min={250}
            max={1200}
            step={50}
            value={bench.affirmMs}
            onChange={(e) => onBench({ affirmMs: Number(e.target.value) })}
            aria-label="Buy-affirm animation duration"
          />
        </label>
        <label className="gsl-slider">
          <span>pip stagger <b>{bench.pipStagger} ms</b></span>
          <input
            type="range"
            min={0}
            max={300}
            step={20}
            value={bench.pipStagger}
            onChange={(e) => onBench({ pipStagger: Number(e.target.value) })}
            aria-label="Level pip stagger"
          />
        </label>
      </div>

      <div className="gsl-ctl-group">
        <button
          className={`gsl-chip ${bench.slow ? 'on' : ''}`}
          aria-pressed={bench.slow}
          onClick={() => onBench({ slow: !bench.slow })}
          title="Multiply all animation durations by 4"
        >
          slow-mo ×4
        </button>
        <button
          className={`gsl-chip ${bench.sound ? 'on' : ''}`}
          aria-pressed={bench.sound}
          onClick={() => onBench({ sound: !bench.sound })}
        >
          sound
        </button>
      </div>
    </div>
  );
}

/**
 * Garage overlay — Ketch's. Upgrade engine/handling/boost/shield, repaint the hull.
 * Costs escalate per level; shield also soaks fragile-cargo damage.
 */
import { useGameStore, useSaveStore } from '../state/store';
import { audio } from '../audio/audio';

const PART_COSTS = [400, 900, 1800];
const PARTS = [
  { key: 'engine', name: 'Engine coils', blurb: '+accel, +top speed' },
  { key: 'handling', name: 'Gyro cage', blurb: '+steering, +grip' },
  { key: 'boost', name: 'Boost cell', blurb: '+capacity, +regen' },
  { key: 'shield', name: 'Cargo shield', blurb: 'soaks impacts for fragile cargo' },
] as const;

const PAINTS = ['#B3502E', '#2E8C8C', '#B07C3A', '#E4D7BE', '#4A2E55', '#3A4A3A'];

export default function GaragePanel() {
  const close = () => useGameStore.getState().setMode('riding');
  const credits = useSaveStore((s) => s.credits);
  const upgrades = useSaveStore((s) => s.upgrades);
  const purchase = useSaveStore((s) => s.purchase);
  const setPaint = useSaveStore((s) => s.setPaint);
  const debt = useSaveStore((s) => s.debt);

  return (
    <div className="overlay">
      <div className="sheet garage">
        <header className="sheet-head">
          <h2>Ketch's Garage</h2>
          <p className="dim">"She'll fly like a rumour, kid." · credits: <strong>{credits.toLocaleString()}</strong> · guild debt: {debt.toLocaleString()} · <kbd>Esc</kbd> to leave</p>
        </header>
        <div className="garage-grid">
          {PARTS.map((p) => {
            const level = upgrades[p.key];
            const maxed = level >= 3;
            const cost = maxed ? 0 : PART_COSTS[level];
            return (
              <div key={p.key} className="garage-part panel">
                <div className="garage-part-head">
                  <strong>{p.name}</strong>
                  <span className="garage-pips" aria-label={`level ${level} of 3`}>
                    {[0, 1, 2].map((i) => <i key={i} className={i < level ? 'on' : ''} />)}
                  </span>
                </div>
                <p className="dim">{p.blurb}</p>
                <button
                  className="btn"
                  disabled={maxed || credits < cost}
                  onClick={() => { purchase(p.key, cost); audio.chime(); }}
                >
                  {maxed ? 'Maxed' : `${cost.toLocaleString()} cr`}
                </button>
              </div>
            );
          })}
          <div className="garage-part panel">
            <div className="garage-part-head"><strong>Paint</strong></div>
            <div className="garage-paints">
              {PAINTS.map((hex) => (
                <button
                  key={hex}
                  className={`paint-swatch ${upgrades.paint === hex ? 'selected' : ''}`}
                  style={{ background: hex }}
                  aria-label={`Paint ${hex}`}
                  onClick={() => { setPaint(hex); audio.blip(720, 0.05); }}
                />
              ))}
            </div>
            <p className="dim">Free. Ketch judges you either way.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Guild Exchange — pay down the 8,000-credit Driftline bond. Staffed (in
 * spirit) by Tamsin-Cho, Salt Guild factor. Milestones bark on the radio;
 * clearing the debt sets `debt.cleared`, +12 guild rep and unlocks Guild Gold
 * paint at Ketch's.
 */
import { useGameStore, useSaveStore } from '../state/store';
import { audio } from '../audio/audio';
import { evaluateAchievements } from '../game/achievements';

const BOND_ORIGINAL = 8000;

const MILESTONES: { at: number; line: string }[] = [
  { at: 0.25, line: 'A quarter of the bond retired. The ledger notices, courier.' },
  { at: 0.5, line: 'Half the bond. The Guild counts it twice — as always — and both counts smile.' },
  { at: 0.75, line: 'Nearly clean, Varga. My abacus is getting sentimental.' },
];

export default function ExchangePanel() {
  const close = () => useGameStore.getState().setMode('riding');
  const credits = useSaveStore((s) => s.credits);
  const debt = useSaveStore((s) => s.debt);
  const guildRep = useSaveStore((s) => s.rep.guild);
  const payDebt = useSaveStore((s) => s.payDebt);

  const paid = BOND_ORIGINAL - debt;
  const cleared = debt <= 0;

  const pay = (amount: number) => {
    const before = debt;
    const moved = payDebt(amount);
    if (moved <= 0) {
      audio.blip(220, 0.09);
      return;
    }
    audio.chime();
    const after = before - moved;
    const game = useGameStore.getState();
    if (after <= 0) {
      game.say('tamsin-cho', 'Ledger closed. Wax seal, twice stamped. You owe the Guild nothing — which means it’s mutual now.');
      window.setTimeout(() => {
        useGameStore.getState().say('ketch', 'Word rides the flats fast, kid. Clean title. That’s a good day’s work.');
        audio.radioBlip();
      }, 2600);
      evaluateAchievements();
    } else {
      for (const m of MILESTONES) {
        if (paid / BOND_ORIGINAL < m.at && after <= BOND_ORIGINAL * (1 - m.at)) {
          game.say('tamsin-cho', m.line);
          audio.radioBlip();
          break;
        }
      }
    }
  };

  const payMax = Math.min(credits, debt);

  return (
    <div className="overlay">
      <div className="sheet exchange">
        <header className="sheet-head">
          <h2>Guild Exchange</h2>
          <p className="dim">
            “The Guild counts it twice, courier. Pay it once.” — Tamsin-Cho · credits:{' '}
            <strong>{credits.toLocaleString()}</strong> · guild rep:{' '}
            <strong>{guildRep}</strong> · <kbd>Esc</kbd> to leave
          </p>
        </header>

        <div className="exchange-grid">
          <div className="exchange-ledger panel">
            <div className="exchange-ledger-head">
              <span className="board-job-type">Driftline bond</span>
              <span className={`exchange-seal ${cleared ? 'cleared' : ''}`}>{cleared ? '◈ CLEAR TITLE' : '◈ on the books'}</span>
            </div>
            <div className="exchange-outstanding">
              {cleared ? '0' : debt.toLocaleString()}
              <span className="hud-speed-unit">cr owed</span>
            </div>
            <div className="exchange-bar" role="progressbar" aria-valuenow={Math.round((paid / BOND_ORIGINAL) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Bond paid off">
              <div className="exchange-bar-fill" style={{ width: `${Math.min(100, (paid / BOND_ORIGINAL) * 100)}%` }} />
            </div>
            <p className="dim exchange-ledger-note">
              {cleared
                ? 'Wax seal, twice stamped. The Guild’s gold paint is yours at Ketch’s — earned, not bought.'
                : `${paid.toLocaleString()} of ${BOND_ORIGINAL.toLocaleString()} cr retired. The bond bought your bike, your berth, and Ketch’s patience. It does not charge interest. It charges attention.`}
            </p>
          </div>

          <div className="exchange-pay panel">
            <div className="board-job-type">Make a payment</div>
            <div className="exchange-pay-buttons">
              {[100, 500, 1000].map((n) => (
                <button key={n} className="btn" disabled={cleared || credits < n} onClick={() => pay(n)}>
                  {n.toLocaleString()} cr
                </button>
              ))}
              <button className="btn primary" disabled={cleared || payMax <= 0} onClick={() => pay(payMax)}>
                All I can — {payMax.toLocaleString()} cr
              </button>
            </div>
            <p className="dim">
              {cleared
                ? 'Nothing left to pay. Go ride something irresponsible.'
                : credits === 0
                  ? 'Pockets flat. The board across the square always has work.'
                  : 'Partial payments welcome. The Guild has nowhere to be for a century.'}
            </p>
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn" onClick={close}>Back to the square</button>
        </div>
      </div>
    </div>
  );
}

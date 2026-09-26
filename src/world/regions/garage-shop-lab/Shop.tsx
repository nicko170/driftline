/**
 * Shop — two renderings of Ketch's garage on the same scripted wallet.
 *
 * BaselineShop is a near-verbatim mirror of the shipped ui/GaragePanel
 * markup (same class names → same production CSS) so the audit is honest.
 * TunedShop is the rebuilt purchase flow: self-explaining buttons, a
 * buy-affirm (counting wallet, stamp, pip stagger), an inline debt ledger
 * with Exchange payment maths, and a swatch rack with roving tabindex +
 * arrow keys. Both are fed the same ShopApi so split view compares the
 * identical save state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import {
  buy,
  debtCleared,
  initialWallet,
  paints as paintsOf,
  payDebt,
  setPaint as walletSetPaint,
  BOND_ORIGINAL,
  GUILD_GOLD,
  PARTS,
  PART_COSTS,
  MAX_LEVEL,
  partCost,
  type BuyVerdict,
  type PartKey,
  type PayVerdict,
  type Wallet,
} from './wallet';

export interface ShopApi {
  wallet: Wallet;
  /** Attempts a purchase; mutates the wallet on success, returns the verdict. */
  tryBuy: (key: PartKey) => BuyVerdict;
  tryPaint: (hex: string) => void;
  tryPay: (amount: number) => PayVerdict;
  /** Duration multiplier — slow-mo ×4 when auditioning the affirm. */
  speed: number;
  sound: boolean;
  setLive: (msg: string) => void;
  /** Shop placement for the debt callout (tuned only). */
  debtCallout: 'ledger' | 'strip' | 'none';
  affirmMs: number;
  pipStagger: number;
}

const ketchQuote = '"She\'ll fly like a rumour, kid."';

/* ============================== BASELINE ============================== */
/* Mirrors ui/GaragePanel.tsx structure (production class names). */

export function BaselineShop({ api }: { api: ShopApi }) {
  const { wallet } = api;
  return (
    <div className="sheet garage gsl-baseline" data-shop="baseline">
      <header className="sheet-head">
        <h2>Ketch's Garage</h2>
        <p className="dim">
          {ketchQuote} · credits: <strong>{wallet.credits.toLocaleString()}</strong> · guild debt:{' '}
          {wallet.debt.toLocaleString()} · <kbd>Esc</kbd> to leave
        </p>
      </header>
      <div className="garage-grid">
        {PARTS.map((p) => {
          const level = wallet.upgrades[p.key];
          const maxed = level >= MAX_LEVEL;
          const cost = maxed ? 0 : PART_COSTS[level];
          return (
            <div key={p.key} className="garage-part panel">
              <div className="garage-part-head">
                <strong>{p.name}</strong>
                <span className="garage-pips" aria-label={`level ${level} of 3`}>
                  {[0, 1, 2].map((i) => (
                    <i key={i} className={i < level ? 'on' : ''} />
                  ))}
                </span>
              </div>
              <p className="dim">{p.blurb}</p>
              <button
                className="btn"
                disabled={maxed || wallet.credits < cost}
                onClick={() => api.tryBuy(p.key)}
              >
                {maxed ? 'Maxed' : `${cost.toLocaleString()} cr`}
              </button>
            </div>
          );
        })}
        <div className="garage-part panel">
          <div className="garage-part-head">
            <strong>Paint</strong>
          </div>
          <div className="garage-paints" data-swatch-rack>
            {paintsOf(wallet).map((hex) => (
              <button
                key={hex}
                className={`paint-swatch ${wallet.upgrades.paint === hex ? 'selected' : ''}`}
                style={{ background: hex }}
                aria-label={`Paint ${hex}`}
                onClick={() => api.tryPaint(hex)}
              />
            ))}
          </div>
          <p className="dim">
            {debtCleared(wallet)
              ? 'Free. The gold one you earned at the Exchange.'
              : 'Free. Ketch judges you either way.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================== TUNED ============================== */

function Pips({ level, popping }: { level: number; popping: boolean }) {
  return (
    <span className="garage-pips" aria-label={`level ${level} of ${MAX_LEVEL}`} role="img">
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          className={`${i < level ? 'on' : ''} ${popping && i === level - 1 ? 'gsl-pip-pop' : ''}`}
          style={{ ['--gsl-pip-i' as string]: i }}
        />
      ))}
    </span>
  );
}

function PartCard({ part, api }: { part: (typeof PARTS)[number]; api: ShopApi }) {
  const { wallet, speed } = api;
  const level = wallet.upgrades[part.key];
  const maxed = level >= MAX_LEVEL;
  const cost = partCost(wallet, part.key);
  const affordable = cost !== null && wallet.credits >= cost;
  const short = cost !== null && !affordable ? cost - wallet.credits : 0;

  const [bought, setBought] = useState(0); // affirm flash token
  const [denied, setDenied] = useState(0);
  useEffect(() => {
    if (!bought) return;
    const t = window.setTimeout(() => setBought(0), api.affirmMs * speed + 120);
    return () => window.clearTimeout(t);
  }, [bought, api.affirmMs, speed]);
  useEffect(() => {
    if (!denied) return;
    const t = window.setTimeout(() => setDenied(0), 320 * speed);
    return () => window.clearTimeout(t);
  }, [denied, speed]);

  const press = () => {
    const v = api.tryBuy(part.key);
    if (v.ok) setBought(v.newLevel * 100 + (bought % 100) + 1);
    else setDenied((d) => d + 1);
  };

  return (
    <article
      className={`gsl-part panel ${bought ? 'gsl-bought' : ''} ${denied ? 'gsl-denied' : ''}`}
      style={{ ['--gsl-affirm-ms' as string]: `${api.affirmMs * speed}ms` }}
    >
      <div className="garage-part-head">
        <strong>
          <span className="gsl-glyph" aria-hidden="true">
            {part.glyph}
          </span>{' '}
          {part.name}
        </strong>
        <Pips level={level} popping={bought > 0} />
      </div>
      <p className="dim">{part.blurb}</p>
      <p className="gsl-placard">
        {maxed
          ? 'All three winds fitted. Ketch has nothing left to sell you for this.'
          : `Next ▸ level ${level + 1} · ${part.levelNote}`}
      </p>
      {bought ? (
        <span className="gsl-stamp" aria-hidden="true">
          Fitted ◈
        </span>
      ) : null}
      <div className="gsl-buy-row">
        <button
          className={`btn gsl-buy ${affordable ? 'primary' : ''}`}
          aria-disabled={maxed || !affordable || undefined}
          title={maxed ? 'All three levels fitted' : !affordable ? `Needs ${short.toLocaleString()} more credits` : undefined}
          aria-label={
            maxed
              ? `${part.name}: fully fitted, level ${MAX_LEVEL}`
              : !affordable
                ? `${part.name} level ${level + 1} costs ${cost!.toLocaleString()} credits — ${short.toLocaleString()} more needed`
                : `${part.name} level ${level + 1} for ${cost!.toLocaleString()} credits`
          }
          onClick={press}
        >
          {maxed ? `Fitted · level ${MAX_LEVEL}` : !affordable ? `Need ${short.toLocaleString()} more` : `${cost!.toLocaleString()} cr ▸ level ${level + 1}`}
        </button>
        {!maxed && !affordable ? (
          <span className="gsl-deny-reason">
            {cost!.toLocaleString()} cr — you hold {wallet.credits.toLocaleString()}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/* Swatch rack with roving tabindex + arrow keys. */
function PaintRack({ api }: { api: ShopApi }) {
  const { wallet } = api;
  const rackRef = useRef<HTMLDivElement>(null);
  const swatchList = useMemo(() => paintsOf(wallet), [wallet]);
  const goldUnlocked = debtCleared(wallet);

  const [focusIdx, setFocusIdx] = useState(() => Math.max(0, swatchList.indexOf(wallet.upgrades.paint)));
  useEffect(() => {
    const cur = swatchList.indexOf(wallet.upgrades.paint);
    setFocusIdx((f) => (f >= swatchList.length ? Math.max(0, cur) : f));
  }, [wallet.upgrades.paint, swatchList]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const rack = rackRef.current;
      if (!rack) return;
      const buttons = Array.from(rack.querySelectorAll<HTMLButtonElement>('button[data-swatch]'));
      if (!buttons.length) return;
      let next = focusIdx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (focusIdx + 1) % buttons.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (focusIdx - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = buttons.length - 1;
      else return;
      e.preventDefault();
      setFocusIdx(next);
      buttons[next]?.focus();
    },
    [focusIdx],
  );

  return (
    <div
      className="gsl-swatches"
      role="group"
      aria-label="Hull paint"
      data-swatch-rack
      data-roving="true"
      ref={rackRef}
      onKeyDown={onKeyDown}
    >
      {swatchList.map((hex, i) => {
        const selected = wallet.upgrades.paint === hex;
        const lockedGold = hex === GUILD_GOLD && !goldUnlocked;
        return (
          <button
            key={hex}
            data-swatch
            tabIndex={i === focusIdx ? 0 : -1}
            aria-pressed={selected}
            aria-disabled={lockedGold || undefined}
            aria-label={
              lockedGold
                ? 'Guild Gold paint — locked. Clear the Guild bond at the Exchange to earn it.'
                : `Paint hull ${hex}${selected ? ' (current)' : ''}`
            }
            title={lockedGold ? 'Earned, never bought: clear the 8,000 cr bond' : `Paint ${hex}`}
            className={`paint-swatch gsl-swatch ${selected ? 'selected' : ''} ${lockedGold ? 'gsl-locked' : ''}`}
            style={{ ['--sw' as string]: hex, background: hex }}
            onClick={() => {
              if (lockedGold) {
                api.setLive('Guild Gold is earned, not bought — the paint unlocks when the bond clears.');
                api.tryPaint(hex); // walletSetPaint refuses non-listed hexes; call for sound parity
                return;
              }
              api.tryPaint(hex);
            }}
          >
            {selected ? (
              <span className="gsl-swatch-check" aria-hidden="true">
                ✓
              </span>
            ) : lockedGold ? (
              <span className="gsl-swatch-lock" aria-hidden="true">
                ▨
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function DebtLedger({ api }: { api: ShopApi }) {
  const { wallet } = api;
  const cleared = debtCleared(wallet);
  const paid = BOND_ORIGINAL - wallet.debt;
  const payMax = Math.min(wallet.credits, wallet.debt);
  const [denied, setDenied] = useState(0);
  useEffect(() => {
    if (!denied) return;
    const t = window.setTimeout(() => setDenied(0), 340 * api.speed);
    return () => window.clearTimeout(t);
  }, [denied, api.speed]);
  const cardShake = () => setDenied((d) => d + 1);
  return (
    <article className={`gsl-part panel exchange-ledger gsl-debt ${denied ? 'gsl-denied' : ''}`} data-debt-callout>
      <div className="exchange-ledger-head">
        <span className="board-job-type">Guild bond · pay here too</span>
        <span className={`exchange-seal ${cleared ? 'cleared' : ''}`}>
          {cleared ? '◈ CLEAR TITLE' : '◈ on the books'}
        </span>
      </div>
      <div className="exchange-outstanding">
        <AnimatedNumber value={cleared ? 0 : wallet.debt} duration={420 * api.speed} />
        <span className="hud-speed-unit"> cr owed</span>
      </div>
      <div
        className="exchange-bar"
        role="progressbar"
        aria-valuenow={Math.round((paid / BOND_ORIGINAL) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Bond paid off"
      >
        <div className="exchange-bar-fill" style={{ width: `${Math.min(100, (paid / BOND_ORIGINAL) * 100)}%` }} />
      </div>
      <div className="exchange-pay-buttons gsl-pay-row">
        {[100, 500, 1000].map((n) => (
          <button
            key={n}
            className="btn"
            aria-disabled={cleared || wallet.credits < n || undefined}
            title={cleared ? 'The bond is clear' : wallet.credits < n ? `Needs ${n.toLocaleString()} credits` : undefined}
            aria-label={`Pay ${n.toLocaleString()} credits toward the Guild bond`}
            onClick={() => {
              const v = api.tryPay(n);
              if (v.paid <= 0) cardShake();
            }}
          >
            {n.toLocaleString()} cr
          </button>
        ))}
        <button
          className="btn primary"
          aria-disabled={cleared || payMax <= 0 || undefined}
          title={cleared ? 'The bond is clear' : payMax <= 0 ? 'No credits to pay with' : undefined}
          aria-label={`Pay everything you can — ${payMax.toLocaleString()} credits — toward the Guild bond`}
          onClick={() => {
            const v = api.tryPay(payMax);
            if (v.paid <= 0) cardShake();
          }}
        >
          All I can — {payMax.toLocaleString()} cr
        </button>
      </div>
      <p className="dim exchange-ledger-note">
        {cleared
          ? 'Wax seal, twice stamped. Guild Gold is unlocked on the paint rack.'
          : 'The bond bought the bike, the berth and Ketch’s patience. It doesn’t charge interest — it charges attention.'}
      </p>
    </article>
  );
}

export function TunedShop({ api }: { api: ShopApi }) {
  const { wallet } = api;
  const cleared = debtCleared(wallet);
  return (
    <section className="gsl-shop" data-shop="tuned">
      <header className="gsl-shop-head">
        <div>
          <h3>Ketch’s Garage</h3>
          <p className="dim gsl-quote">{ketchQuote} — Ketch, sweeping sand out of a showroom of dust</p>
        </div>
        <div className="gsl-wallet" aria-label="Wallet">
          <span className="gsl-wallet-num">
            <AnimatedNumber value={wallet.credits} duration={420 * api.speed} />
          </span>
          <span className="gsl-wallet-unit">cr</span>
        </div>
      </header>

      {api.debtCallout === 'strip' && !cleared ? (
        <p className="gsl-debt-strip" data-debt-callout>
          ◈ Guild bond <strong>{wallet.debt.toLocaleString()} cr</strong> on the books — pay it at the
          Exchange, or right here in the ledger below.
        </p>
      ) : null}

      <div className="gsl-grid">
        {PARTS.map((p) => (
          <PartCard key={p.key} part={p} api={api} />
        ))}

        <article className="gsl-part panel">
          <div className="garage-part-head">
            <strong>
              <span className="gsl-glyph" aria-hidden="true">
                ▣
              </span>{' '}
              Paint
            </strong>
          </div>
          <PaintRack api={api} />
          <p className="dim">
            {cleared
              ? 'The gold one is yours — earned at the Exchange, never sold.'
              : 'Free. The gold one stays locked until the bond clears — Ketch judges you either way.'}
          </p>
        </article>

        {api.debtCallout === 'ledger' ? <DebtLedger api={api} /> : null}
      </div>
    </section>
  );
}

/* Shared pure actions wired to a Wallet getter/setter — the ShopApi factory.
 * getWallet() (rather than a captured value) keeps rapid clicks honest. */
export function makeShopApi(opts: {
  getWallet: () => Wallet;
  setWallet: (up: (w: Wallet) => Wallet) => void;
  speed: number;
  sound: boolean;
  chime: () => void;
  blipLow: () => void;
  setLive: (msg: string) => void;
  receipt: (text: string, kind: 'buy' | 'pay' | 'paint' | 'deny') => void;
  debtCallout: 'ledger' | 'strip' | 'none';
  affirmMs: number;
  pipStagger: number;
}): ShopApi {
  return {
    get wallet() {
      return opts.getWallet();
    },
    speed: opts.speed,
    sound: opts.sound,
    setLive: opts.setLive,
    debtCallout: opts.debtCallout,
    affirmMs: opts.affirmMs,
    pipStagger: opts.pipStagger,
    tryBuy: (key) => {
      const v = buy(opts.getWallet(), key);
      if (v.ok) {
        opts.setWallet(() => v.wallet);
        opts.chime();
        opts.setLive(`${v.part.name} fitted — level ${v.newLevel}. ${v.wallet.credits.toLocaleString()} credits left.`);
        opts.receipt(`−${v.cost.toLocaleString()} cr · ${v.part.name} → level ${v.newLevel} · balance ${v.wallet.credits.toLocaleString()} cr`, 'buy');
      } else {
        opts.blipLow();
        opts.setLive(
          v.reason === 'maxed'
            ? `${v.part.name} is fully fitted.`
            : `${v.part.name} costs more than you hold — ${v.short.toLocaleString()} credits short.`,
        );
        if (v.reason === 'credits')
          opts.receipt(`denied · ${v.part.name} · ${v.short.toLocaleString()} cr short`, 'deny');
      }
      return v;
    },
    tryPaint: (hex) => {
      const w = opts.getWallet();
      const was = w.upgrades.paint;
      const next = walletSetPaint(w, hex);
      opts.setWallet(() => next);
      if (next.upgrades.paint !== was) {
        opts.setLive(`Hull repainted ${hex}. Free — Ketch judges you either way.`);
        opts.receipt(`paint · ${hex}${hex === GUILD_GOLD ? ' (Guild Gold — earned)' : ''}`, 'paint');
      }
    },
    tryPay: (amount) => {
      const v = payDebt(opts.getWallet(), amount);
      if (v.paid > 0) opts.setWallet(() => v.wallet);
      return v;
    },
  };
}

/** Builds a fresh scripted wallet (exported for tests/checks parity). */
export const freshWallet = initialWallet;

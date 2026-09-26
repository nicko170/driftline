/**
 * GARAGE SHOP FLOW LAB — the purchase-flow bench.
 *
 * Rebuilds Ketch's garage out-of-game on a scripted wallet. The stage can
 * hold the pristine shipped UI (BaselineShop — production class names, the
 * honest audit target) and the tuned rebuild (TunedShop) side by side:
 * self-explaining buy buttons, a counting wallet + FITTED stamp + pip
 * stagger as the buy-affirm, a debt callout in three placements with real
 * Exchange payment maths, and a swatch rack with roving tabindex, arrow
 * keys and the locked Guild Gold ghost cell. Phone/tablet/laptop/full
 * frame widths, a slow-mo ×4 knob for the motion, a live DOM a11y pass
 * scored per variant, and a copy-CSS export aimed at src/ui/ui.css.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it
 * satisfies the region registry contract too: meta.json + anchors.json
 * describe a harmless off-world bench (center [7800, 7800]) and the
 * default export carries meta/anchors statics — the game streams nothing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import { audio } from '../../../audio/audio';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { meta } from './meta';
import { BaselineShop, TunedShop, makeShopApi } from './Shop';
import { Panel, type Bench } from './Panel';
import { runDomChecks, runLogicChecks, type CheckResult } from './checks';
import { buildCssExport } from './cssExport';
import { initialWallet, WALLET_PRESETS, type PayVerdict, type Wallet } from './wallet';
import './garage-shop-lab.css';

export { meta };

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

interface Receipt {
  id: number;
  text: string;
  kind: 'buy' | 'pay' | 'paint' | 'deny';
}

let receiptSeq = 1;

function CheckList({ title, results }: { title: string; results: CheckResult[] }) {
  const tally = { pass: 0, warn: 0, fail: 0, pending: 0 };
  for (const r of results) tally[r.status]++;
  return (
    <div className="gsl-checks" aria-label={`${title} checks`}>
      <h4>
        {title}{' '}
        <span className="gsl-check-tally">
          <b className="gsl-ok">{tally.pass}✓</b> {tally.fail > 0 && <b className="gsl-bad">{tally.fail}✗</b>}{' '}
          {tally.warn > 0 && <b className="gsl-warn">{tally.warn}△</b>}
        </span>
      </h4>
      <ul>
        {results.map((c) => (
          <li key={c.id} className={`gsl-check gsl-check-${c.status}`}>
            <i aria-hidden="true">
              {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : c.status === 'warn' ? '△' : '…'}
            </i>
            <div>
              <strong>{c.label}</strong>
              <span>{c.detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GarageShopLab() {
  const [wallet, setWalletState] = useState<Wallet>(initialWallet);
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const [bench, setBench] = useState<Bench>({
    view: 'split',
    width: 0,
    slow: false,
    sound: true,
    debtCallout: 'ledger',
    affirmMs: 650,
    pipStagger: 120,
  });
  const [receipts, setReceipts] = useState<Receipt[]>([
    { id: 0, text: 'till opened · 900 cr float', kind: 'pay' },
  ]);
  const [liveMsg, setLiveMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const tunedRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const [tunedChecks, setTunedChecks] = useState<CheckResult[]>([]);
  const [baseChecks, setBaseChecks] = useState<CheckResult[]>([]);
  const logicChecks = useMemo(runLogicChecks, []);

  const receipt = useCallback((text: string, kind: Receipt['kind']) => {
    setReceipts((r) => [{ id: receiptSeq++, text, kind }, ...r].slice(0, 9));
  }, []);

  const speed = bench.slow ? 4 : 1;
  const chime = useCallback(() => bench.sound && audio.chime(), [bench.sound]);
  const blipLow = useCallback(() => bench.sound && audio.blip(220, 0.09), [bench.sound]);

  const baseApiOpts = useMemo(
    () => ({
      getWallet: () => walletRef.current,
      setWallet: setWalletState,
      speed,
      sound: bench.sound,
      chime,
      blipLow,
      setLive: setLiveMsg,
      receipt,
      debtCallout: bench.debtCallout,
      affirmMs: bench.affirmMs,
      pipStagger: bench.pipStagger,
    }),
    [speed, bench.sound, bench.debtCallout, bench.affirmMs, bench.pipStagger, chime, blipLow, receipt],
  );

  const api = useMemo(() => {
    const a = makeShopApi(baseApiOpts);
    const pay = a.tryPay;
    a.tryPay = (amount: number): PayVerdict => {
      const v = pay(amount);
      if (v.paid > 0) {
        chime();
        setLiveMsg(
          v.cleared
            ? 'Ledger closed. Wax seal, twice stamped — the Guild owes you now.'
            : `${v.paid.toLocaleString()} credits toward the bond. ${v.wallet.debt.toLocaleString()} owed.`,
        );
        receipt(
          v.cleared
            ? `−${v.paid.toLocaleString()} cr · bond cleared · ◈ CLEAR TITLE`
            : `−${v.paid.toLocaleString()} cr · bond → ${v.wallet.debt.toLocaleString()} cr owed`,
          'pay',
        );
      } else {
        blipLow();
        setLiveMsg('Nothing moved — no credits, or the bond is already clear.');
      }
      return v;
    };
    return a;
  }, [baseApiOpts, chime, blipLow, receipt]);

  /* Run the a11y suite against whatever is mounted. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (tunedRef.current) setTunedChecks(runDomChecks(tunedRef.current, liveMsg));
      if (baseRef.current) setBaseChecks(runDomChecks(baseRef.current, liveMsg));
    }, 60);
    return () => window.clearTimeout(t);
  }, [wallet, bench, liveMsg]);

  const loadPreset = useCallback((w: Wallet) => {
    setWalletState(w);
    setLiveMsg(`Scripted wallet loaded: ${WALLET_PRESETS.find((p) => p.wallet === w)?.label ?? 'custom'}.`);
  }, []);
  const patchWallet = useCallback((w: Wallet) => setWalletState(w), []);

  const css = useMemo(
    () => buildCssExport({ affirmMs: bench.affirmMs, pipStagger: bench.pipStagger }),
    [bench.affirmMs, bench.pipStagger],
  );

  const copyCss = useCallback(() => {
    const done = () => {
      setCopied(true);
      setLiveMsg('CSS export copied — tuned garage rules, drop-in for ui.css.');
      window.setTimeout(() => setCopied(false), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(css).then(done, done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = css;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    }
  }, [css]);

  const widthStyle = bench.width ? { maxWidth: bench.width } : undefined;
  const showTuned = bench.view !== 'baseline';
  const showBase = bench.view !== 'tuned';

  return (
    <div className="gsl-root">
      <header
        className="gsl-head"
        style={{ backgroundImage: `url(${withBase('images/work/garage-shop-lab.jpg')})` }}
        role="img"
        aria-label="A sunlit desert garage bay: a rust-red hover-bike up on jacks, engine coils and paint swatches on a workbench"
      >
        <div className="gsl-head-veil">
          <h2>Garage Shop Flow Lab</h2>
          <p>
            Ketch’s till, rebuilt on a scripted wallet. Same save-state feeds a pristine mirror of
            the shipped garage and the tuned purchase flow — buy buttons that explain themselves,
            a counting wallet, the FITTED stamp, the bond where you can pay it, and a swatch rack
            you can drive from the keyboard.
          </p>
        </div>
        <div className="gsl-purse" aria-label="Scripted wallet figure">
          <span className="gsl-purse-num">{wallet.credits.toLocaleString()}</span>
          <span className="gsl-purse-unit">cr</span>
          <span className={`exchange-seal ${wallet.debt <= 0 ? 'cleared' : ''}`}>
            {wallet.debt <= 0 ? '◈ CLEAR TITLE' : `◈ ${wallet.debt.toLocaleString()} owed`}
          </span>
        </div>
      </header>

      <Panel
        wallet={wallet}
        bench={bench}
        onPreset={loadPreset}
        onPatch={patchWallet}
        onBench={(b) => setBench((x) => ({ ...x, ...b }))}
      />

      <div className={`gsl-stage-row ${bench.view === 'split' ? 'split' : ''}`}>
        {showBase ? (
          <figure className="gsl-frame">
            <figcaption>
              <span className="gsl-frame-tag">baseline · shipped</span>
              <span className="gsl-frame-dim">{bench.width ? `${bench.width} px` : 'fluid'}</span>
            </figcaption>
            <div className="gsl-stage gsl-stage-base" style={widthStyle} ref={baseRef} data-a11y-stage>
              <BaselineShop api={api} />
            </div>
          </figure>
        ) : null}
        {showTuned ? (
          <figure className="gsl-frame">
            <figcaption>
              <span className="gsl-frame-tag gsl-frame-tag-tuned">tuned · proposal</span>
              <span className="gsl-frame-dim">{bench.width ? `${bench.width} px` : 'fluid'}</span>
            </figcaption>
            <div className="gsl-stage" style={widthStyle} ref={tunedRef} data-a11y-stage>
              <TunedShop api={api} />
            </div>
          </figure>
        ) : null}
      </div>

      <div className="gsl-below">
        <aside className="gsl-tape panel" aria-label="Transaction receipts">
          <h4>Till tape</h4>
          <ul>
            {receipts.map((r) => (
              <li key={r.id} className={`gsl-receipt gsl-receipt-${r.kind}`}>
                {r.text}
              </li>
            ))}
          </ul>
          <p className="gsl-tape-hint">
            Everything the shop does lands here — the affirm has to earn its keep.
          </p>
        </aside>

        <section className="gsl-audits panel" aria-label="Accessibility pass">
          <h4>Keyboard &amp; a11y pass</h4>
          <p className="dim">
            Runs live against the mounted stages. Baseline rows fail on purpose — that’s the case
            the tuned build has to close. Tab through it yourself: arrows move within the rack,
            keys <kbd>Home</kbd>/<kbd>End</kbd> jump the ends.
          </p>
          <CheckList title="Wallet maths (store parity)" results={logicChecks} />
          {showTuned && <CheckList title="Tuned stage" results={tunedChecks} />}
          {showBase && <CheckList title="Baseline stage" results={baseChecks} />}
        </section>
      </div>

      <footer className="gsl-foot panel">
        <div>
          <h4>Ship it</h4>
          <p className="dim">
            The tuned rules with the current knobs baked in (<b>{bench.affirmMs} ms</b> affirm,{' '}
            <b>{bench.pipStagger} ms</b> pip stagger). Named for the real garage classes so the
            paste is a superset of <code>ui.css</code>.
          </p>
        </div>
        <button className="btn primary" onClick={copyCss}>
          {copied ? 'Copied ✓' : 'Copy CSS'}
        </button>
        <pre className="gsl-csspreview" aria-label="CSS export preview">
          {css}
        </pre>
      </footer>

      {/* polite announcements for every transaction */}
      <div aria-live="polite" className="gsl-sr" role="status">
        {liveMsg}
      </div>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = GarageShopLab as typeof GarageShopLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

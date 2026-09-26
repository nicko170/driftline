/**
 * UPGRADE CURVE SANDBOX — the garage feel-economy grapher.
 *
 * Tick upgrade pips for engine coils / gyro cage / boost cell and the whole
 * ledger redraws: launch curves vs the stock ghost, boost tank duty, the
 * drift-exit kick (pip-independent — a finding), top-speed bars and the
 * credit ladder per part. Every number is computed from the exact constants
 * in src/game/Bike.tsx (see physics.ts, which quotes it). A ghosted
 * flat-shaded bike replays the scripted launch on a mini skidpad, with the
 * 100 km/h gate moved to wherever the current fit actually crosses.
 *
 * Region-registry note (workshed policy): this is a lab, so meta.json +
 * anchors.json describe a harmless off-world bench and the default export
 * carries meta/anchors statics — the game streams nothing from it.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { bench, STOCK, AVG_MISSION_CR, type Ladder, type Pips } from './physics';
import { SkidpadScene, padHud } from './Skidpad';
import { LedgerFigures } from './Graphs';
import { BenchPanel } from './Controls';
import { withBase } from '../../../lib/base';
import './upgrade-curve-sandbox.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

/* -------------------------------------------------- skidpad HUD (DOM) */

function PadHud() {
  const [s, setS] = useState({ lap: 1, t: 0, cur: 0, ghost: 0, meter: 1, hold: 0, flash: 0 });
  useEffect(() => {
    const iv = window.setInterval(() => {
      setS({
        lap: padHud.lap,
        t: Math.min(padHud.t, 9),
        cur: padHud.curKmh,
        ghost: padHud.ghostKmh,
        meter: padHud.curMeter,
        hold: padHud.hold,
        flash: padHud.flash,
      });
    }, 120);
    return () => window.clearInterval(iv);
  }, []);
  return (
    <>
      <div className="ucs-padhud-top">
        <span className="ucs-padhud-chip">TAPE · LAP {s.lap}</span>
        <span className="ucs-padhud-chip num">{s.t.toFixed(1)} s</span>
        {s.hold > 0 && <span className="ucs-padhud-chip rewind">REWIND ▸</span>}
      </div>
      <div className="ucs-padhud-speeds">
        <div className="ucs-spd cur">
          <b>{Math.round(s.cur)}</b><span>km/h · this fit</span>
          <i className="ucs-meter"><i style={{ width: `${Math.round(s.meter * 100)}%` }} /></i>
        </div>
        <div className="ucs-spd ghost">
          <b>{Math.round(s.ghost)}</b><span>km/h · stock</span>
        </div>
      </div>
      <div className="ucs-padflash" style={{ opacity: s.flash }} aria-hidden />
    </>
  );
}

/* ------------------------------------------------------------- sandbox */

function UpgradeCurveSandbox() {
  const [started, setStarted] = useState(false);
  const [pips, setPips] = useState<Pips>({ ...STOCK });
  const [ladder, setLadder] = useState<Ladder>('shipped');

  // mirror into the module-level bench read by the R3F loop
  useEffect(() => {
    bench.pips = { ...pips };
    bench.ladder = ladder;
  }, [pips, ladder]);

  return (
    <div className="ucs-root">
      <header className="ucs-top">
        <div className="ucs-top-titles">
          <p className="ucs-kicker">SALT GUILD LEDGER · FEEL ECONOMY BENCH N°7</p>
          <h1>Upgrade Curve Sandbox</h1>
          <p className="ucs-top-blurb">
            Tick the pips Ketch sells you; the paper shows what a credit buys. All curves computed
            from the shipped constants in <code>src/game/Bike.tsx</code> — the skidpad below replays
            the fit against a stock ghost.
          </p>
        </div>
      </header>

      <div className="ucs-main">
        <section className="ucs-card ucs-pad">
          <div className="ucs-pad-canvas">
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [10.5, 3.9, 53], fov: 55, near: 0.3, far: 2200 }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
            >
              <SkidpadScene pips={pips} />
            </Canvas>
            {started && <PadHud />}
          </div>
          <p className="ucs-pad-foot">
            ◈ rust lane — this fit · ◇ bone lane — stock ghost · the amber gantry is the 100 km/h
            gate, pulled to wherever the fit actually crosses. 9 s tape, throttle pinned, boost
            held from 0.7 s.
          </p>
        </section>

        <BenchPanel pips={pips} ladder={ladder} onPips={setPips} onLadder={setLadder} />
      </div>

      <LedgerFigures pips={pips} ladder={ladder} avgCr={AVG_MISSION_CR} />

      {!started && (
        <div className="ucs-splash">
          <div className="ucs-splash-card">
            <div
              className="ucs-splash-art"
              style={{ backgroundImage: `url(${withBase('images/work/upgrade-curve-sandbox.jpg')})` }}
              role="img"
              aria-label="Concept art of a garage ledger desk with holographic upgrade curves over a hover-bike sketch"
            />
            <div className="ucs-splash-body">
              <p className="ucs-kicker dark">GUILD LEDGER FORM 7-B · APPROVED FOR FACTORS AND FOOLS</p>
              <h1>Upgrade Curve Sandbox</h1>
              <p>
                Ketch sells five kinds of confidence; the Salt Guild prices each one. This bench
                keeps both honest: every pip on the ladder replots the launch curve, the boost tank,
                the drift kick and the cost column against the constants the game actually ships —
                and a ghost stock bike on the skidpad shows you, in the flesh, exactly what the last
                1,800 credits did. Use it before spending, or before pricing.
              </p>
              <button className="btn primary big" onClick={() => setStarted(true)}>
                Open the ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = UpgradeCurveSandbox as typeof UpgradeCurveSandbox & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

/**
 * Radio Static Visualizer — audio-reactive art toy.
 * A recovered Driftline longwave set: dial the band, hold to listen, watch the
 * choir-teal cathode trace. See engine.ts (voices) and Scope.tsx (phosphor).
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` + `anchors.json`
 * describe a harmless off-world bench (center [5600,5600]) and the default
 * export carries `meta`/`anchors` statics — the game streams nothing from it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  RadioEngine,
  STATIONS,
  WHISPERS,
  bestLock,
  clampFreq,
  LOCK_T,
} from './engine';
import { Scope } from './Scope';
import { Dial } from './Dial';
import './rsv.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

function RadioStaticVisualizer() {
  const engineRef = useRef<RadioEngine | null>(null);
  const [engine, setEngine] = useState<RadioEngine | null>(null);
  const [freq, setFreqState] = useState(92.3);
  const freqRef = useRef(92.3);
  const [held, setHeld] = useState(false);
  const [latched, setLatched] = useState(false);
  const [ghostOn, setGhostOn] = useState(false);
  const [whisper, setWhisper] = useState('');
  const listening = held || latched;

  const lock = bestLock(freq);
  const strength = lock ? lock.t : 0;

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;
    const e = new RadioEngine();
    e.ensure();
    e.setFreq(freqRef.current);
    engineRef.current = e;
    setEngine(e);
    return e;
  }, []);

  const setFreq = useCallback(
    (f: number) => {
      const c = clampFreq(f);
      freqRef.current = c;
      setFreqState(c);
      engineRef.current?.setFreq(c);
    },
    [],
  );

  useEffect(() => {
    engineRef.current?.setListening(listening);
  }, [listening, engine]);

  // phasors + ghost UI polling (state changes are thresholded, not per-frame)
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    let last = performance.now();
    let wasOn = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const e = engineRef.current;
      if (!e) return;
      e.update(dt);
    };
    raf = requestAnimationFrame(tick);
    const ui = window.setInterval(() => {
      const e = engineRef.current;
      if (!e) return;
      const on = e.ghostLevel > 0.06;
      if (on && !wasOn && e.ghostStation) setWhisper(pick(WHISPERS[e.ghostStation]));
      if (on !== wasOn) {
        wasOn = on;
        setGhostOn(on);
      }
    }, 190);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(ui);
    };
  }, [engine]);

  // keyboard: arrows tune (shift = coarse), 1–4 jump to stations, space holds
  // listen, L toggles the latch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const coarse = e.shiftKey ? 1 : 0.1;
      if (e.key === 'ArrowLeft') { setFreq(freqRef.current - coarse); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setFreq(freqRef.current + coarse); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { setFreq(freqRef.current - 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { setFreq(freqRef.current + 1); e.preventDefault(); }
      else if (e.key >= '1' && e.key <= '4') {
        const s = STATIONS[Number(e.key) - 1];
        if (s) setFreq(s.freq);
      } else if (e.key === ' ') {
        if (e.repeat || (target && target.tagName === 'BUTTON')) return;
        e.preventDefault();
        ensureEngine().setListening(true);
        setHeld(true);
      } else if (e.key === 'l' || e.key === 'L') {
        ensureEngine();
        setLatched((v) => !v);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') setHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setFreq, ensureEngine]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  const status =
    strength >= LOCK_T
      ? `LOCKED · ${lock!.station.name}`
      : strength > 0.08
        ? `CARRIER · ${lock!.station.name}`
        : 'SEARCHING…';

  return (
    <div className="rsv-root" onPointerDownCapture={() => ensureEngine()}>
      <header className="rsv-head">
        <div>
          <h2>Radio Static Visualizer</h2>
          <p className="rsv-sub">Recovered Driftline longwave set · band seven · signals get lonely out here</p>
        </div>
        <span className="rsv-badge panel">LW·7 · WORKSHED SET</span>
      </header>

      <div className="rsv-main">
        <section className="rsv-scope-wrap" aria-label="Cathode scope">
          <Scope engine={engine} listening={listening} strength={strength} freq={freq} />
          {!listening && (
            <div className="rsv-dead">{engine ? 'DEAD AIR — hold LISTEN' : 'SET COLD — press LISTEN to power up'}</div>
          )}
          <div className={`rsv-whisper${ghostOn && listening ? ' on' : ''}`} aria-hidden="true">
            {whisper || '…'}
          </div>
        </section>

        <aside className="rsv-console">
          <div className="rsv-readout panel">
            <div className="rsv-readout-top">
              <span className="rsv-readout-freq">{freq.toFixed(2)}</span>
              <span className="rsv-readout-mhz">MHz</span>
            </div>
            <div className="rsv-readout-status" aria-live="polite">{status}</div>
            {lock && strength > 0.08 && <div className="rsv-readout-hint">{lock.station.hint}</div>}
            <div className="rsv-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(strength * 100)} aria-label="Signal strength">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`rsv-seg${strength * 10 >= i + 0.5 ? ' on' : ''}`} />
              ))}
            </div>
            <div className={`rsv-ghost-badge${ghostOn && listening ? ' on' : ''}`}>GHOST HARMONIC</div>
          </div>

          <div className="rsv-stations panel">
            <h3>Known signals</h3>
            {STATIONS.map((s, i) => {
              const active = lock?.station.id === s.id && strength >= LOCK_T;
              const near = lock?.station.id === s.id && strength > 0.08 && !active;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`rsv-station${active ? ' locked' : near ? ' near' : ''}`}
                  onClick={() => setFreq(s.freq)}
                >
                  <span className="rsv-station-name">
                    <kbd>{i + 1}</kbd> {s.name}
                  </span>
                  <span className="rsv-station-key">{s.key}</span>
                  <span className="rsv-station-freq">{s.freq.toFixed(1)}</span>
                </button>
              );
            })}
          </div>

          <div className="rsv-dial-panel panel">
            <Dial freq={freq} onFreq={setFreq} />
          </div>

          <div className="rsv-listen-panel panel">
            <button
              type="button"
              className={`rsv-listen${listening ? ' held' : ''}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setHeld(true);
              }}
              onPointerUp={() => setHeld(false)}
              onPointerCancel={() => setHeld(false)}
            >
              {listening ? 'LISTENING…' : 'HOLD TO LISTEN'}
            </button>
            <label className="rsv-latch">
              <input
                type="checkbox"
                checked={latched}
                onChange={(e) => {
                  ensureEngine();
                  setLatched(e.target.checked);
                }}
              />
              latch <kbd>L</kbd>
            </label>
          </div>
        </aside>
      </div>

      <footer className="rsv-foot">
        <span><kbd>←</kbd><kbd>→</kbd> fine tune</span>
        <span><kbd>shift</kbd> coarse</span>
        <span><kbd>1</kbd>–<kbd>4</kbd> stations</span>
        <span>hold <kbd>space</kbd> listen</span>
        <span className="dim">no stations were harmed; two were unanswered</span>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = RadioStaticVisualizer as typeof RadioStaticVisualizer & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

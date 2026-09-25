/**
 * Hand-rolled control panel for the tuner — no leva, plain styled range inputs.
 * Writes into the module-level `tuner` state; readouts poll at ~12 Hz while playing.
 */
import { useEffect, useReducer, useState } from 'react';
import { KEYS, tuner, DEFAULTS, sampleHex, clockString, exportPayload } from './palette';

function useForce() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  return bump;
}

function Slider({
  label, min, max, step, get, set, format,
}: {
  label: string; min: number; max: number; step: number;
  get: () => number; set: (v: number) => void; format: (v: number) => string;
}) {
  const force = useForce();
  const v = get();
  return (
    <label className="skt-slider">
      <span className="skt-slider-label">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { set(+e.target.value); force(); }}
        aria-label={label}
      />
      <span className="skt-slider-val">{format(v)}</span>
    </label>
  );
}

const PHASE_CHIPS: [string, number][] = [
  ['Dawn', 0.28], ['Day', 0.5], ['Dusk', 0.78], ['Night', 0.02],
];

export function TunerPanel() {
  const force = useForce();
  const [copied, setCopied] = useState(false);

  // keep readouts fresh while the cycle plays
  useEffect(() => {
    const id = window.setInterval(() => { if (tuner.playing) force(); }, 83);
    return () => window.clearInterval(id);
  }, []);

  const s = sampleHex(tuner.t);

  const copy = async () => {
    const json = JSON.stringify(exportPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = json;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="skt-panel">
      <div className="skt-head">
        <h2>Skybox Tuner</h2>
        <p>
          <span className="skt-phase">{s.phase}</span>
          <span className="skt-clock">{clockString(tuner.t)}</span>
        </p>
      </div>

      <div className="skt-scrub">
        <input
          type="range" min={0} max={999} value={Math.round(tuner.t * 999)}
          onChange={(e) => { tuner.t = +e.target.value / 999; tuner.playing = false; force(); }}
          aria-label="Time of day"
        />
        <div className="skt-ticks" aria-hidden>
          {KEYS.map((k) => (
            <span key={k.phase} style={{ left: `${k.t * 100}%` }} title={k.phase} />
          ))}
        </div>
      </div>

      <div className="skt-row">
        <button
          className="skt-btn"
          onClick={() => { tuner.playing = !tuner.playing; force(); }}
        >
          {tuner.playing ? '⏸ Pause' : '▶ Play'}
        </button>
        {PHASE_CHIPS.map(([label, t]) => (
          <button
            key={label}
            className={`skt-chip${s.phase.startsWith(label.toLowerCase().slice(0, 4)) ? ' on' : ''}`}
            onClick={() => { tuner.t = t; tuner.playing = false; force(); }}
          >
            {label}
          </button>
        ))}
      </div>

      <Slider label="Cycle / min" min={0} max={8} step={0.25} get={() => tuner.speed} set={(v) => { tuner.speed = v; }} format={(v) => `${v}`} />
      <Slider label="Fog density" min={2} max={50} step={0.5} get={() => tuner.fogDensity} set={(v) => { tuner.fogDensity = v; }} format={(v) => `${(v).toFixed(1)}e-4`} />
      <Slider label="Sun gain" min={0} max={2} step={0.05} get={() => tuner.sunGain} set={(v) => { tuner.sunGain = v; }} format={(v) => `×${v.toFixed(2)}`} />
      <Slider label="Star factor" min={0} max={2} step={0.05} get={() => tuner.starGain} set={(v) => { tuner.starGain = v; }} format={(v) => `×${v.toFixed(2)}`} />

      <div className="skt-swatches">
        {([['sky top', s.skyTop], ['horizon', s.horizon], ['fog', s.fog], ['sun', s.sun]] as const).map(([label, hex]) => (
          <div key={label} className="skt-swatch">
            <span className="skt-dot" style={{ background: hex }} />
            <span className="skt-swatch-label">{label}</span>
            <code>{hex}</code>
          </div>
        ))}
      </div>

      <div className="skt-row">
        <button className="skt-btn primary" onClick={() => void copy()}>
          {copied ? '✓ Copied' : 'Copy JSON'}
        </button>
        <button
          className="skt-btn"
          onClick={() => { Object.assign(tuner, DEFAULTS); force(); }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

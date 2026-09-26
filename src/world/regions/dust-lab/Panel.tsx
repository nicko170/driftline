/**
 * Hand-rolled control panel for the dust lab — plain styled inputs, no deps.
 * Writes into the module-level `lab` state; readouts poll the scene's stats
 * aggregate at ~8 Hz so they stay fresh without re-rendering every frame.
 */
import { useEffect, useReducer, useState } from 'react';
import { DEFAULTS, PRESETS, SHIPPED, exportPayload, lab, stats, SURFACES, type LabState, type SurfaceKind } from './state';

function useForce() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  return bump;
}

function Slider<K extends keyof LabState>({
  label, min, max, step, k, format,
}: {
  label: string; min: number; max: number; step: number; k: K; format: (v: number) => string;
}) {
  const force = useForce();
  const v = lab[k] as number;
  return (
    <label className="dlp-slider">
      <span className="dlp-slider-label">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { (lab[k] as number) = +e.target.value; force(); }}
        aria-label={label}
      />
      <span className="dlp-slider-val">{format(v)}</span>
    </label>
  );
}

function ColourRow({ kind }: { kind: SurfaceKind }) {
  const force = useForce();
  return (
    <label className="dlp-colour">
      <input
        type="color" value={lab[kind]}
        onChange={(e) => { lab[kind] = e.target.value; force(); }}
        aria-label={`${kind} dust colour`}
      />
      <span className="dlp-colour-label">
        {kind}
        <code>{lab[kind]}</code>
        {kind === 'glass' && <em> shipped: {SHIPPED.colors[kind]}</em>}
      </span>
    </label>
  );
}

export function LabPanel() {
  const force = useForce();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  // poll scene stats at ~8 Hz
  useEffect(() => {
    const id = window.setInterval(() => force(), 125);
    return () => window.clearInterval(id);
  }, []);

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

  const boost = () => {
    lab.boostUntil = performance.now() + 2200;
    force();
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    Object.assign(lab, p.set);
    force();
  };

  if (!open) {
    return (
      <button className="dlp-reopen" onClick={() => setOpen(true)} aria-label="Open particle controls">
        ⚙ Dust lab
      </button>
    );
  }

  return (
    <div className="dlp-panel">
      <div className="dlp-head">
        <h2>Dust Lab</h2>
        <button className="dlp-icon" onClick={() => setOpen(false)} aria-label="Collapse panel">–</button>
      </div>

      {/* live readouts */}
      <div className="dlp-stats" aria-live="off">
        <span><b>{stats.active}</b> live / {lab.count}</span>
        <span><b>{stats.emitPerSec.toFixed(0)}</b>/s emit</span>
        <span><b>{stats.bikeSpeed.toFixed(0)}</b> m/s</span>
        <span className={`dlp-surf is-${stats.surface}`}><i />{stats.surface}</span>
        <span><b>{stats.fps.toFixed(0)}</b> fps</span>
      </div>

      <div className="dlp-row">
        <button className="dlp-btn" onClick={() => { lab.paused = !lab.paused; force(); }}>
          {lab.paused ? '▶ Run' : '⏸ Pause'}
        </button>
        <button className="dlp-btn primary" onClick={boost}>⚡ Boost burst</button>
      </div>
      <Slider label="Bike speed" min={8} max={45} step={1} k="bikeSpeed" format={(v) => `${v.toFixed(0)} m/s`} />

      <h3>Emitter</h3>
      <Slider label="Buffer slots" min={40} max={2048} step={20} k="count" format={(v) => `${v}`} />
      <Slider label="Point size" min={0.2} max={3} step={0.05} k="size" format={(v) => v.toFixed(2)} />
      <Slider label="Lifetime" min={0.4} max={6} step={0.1} k="lifetime" format={(v) => `${v.toFixed(1)} s`} />
      <Slider label="Opacity" min={0.05} max={1} step={0.05} k="opacity" format={(v) => v.toFixed(2)} />
      <Slider label="Emit × speed" min={0} max={4} step={0.1} k="emitPerSpeed" format={(v) => v.toFixed(1)} />
      <Slider label="Spread" min={0} max={3} step={0.1} k="spread" format={(v) => `${v.toFixed(1)} m`} />
      <Slider label="Rise" min={0} max={5} step={0.1} k="rise" format={(v) => `${v.toFixed(1)} m/s`} />
      <Slider label="Turbulence" min={0} max={2} step={0.05} k="turbulence" format={(v) => v.toFixed(2)} />
      <Slider label="Drag" min={0} max={2} step={0.05} k="drag" format={(v) => v.toFixed(2)} />
      <label className="dlp-check">
        <input
          type="checkbox" checked={lab.softFade}
          onChange={(e) => { lab.softFade = e.target.checked; force(); }}
        />
        <span>Soft age-fade + growth <em>(upgrade path; off = shipped square feel)</em></span>
      </label>

      <h3>Surface colours</h3>
      {SURFACES.map((k) => <ColourRow key={k} kind={k} />)}

      <h3>Presets</h3>
      <div className="dlp-row">
        {PRESETS.map((p) => (
          <button key={p.name} className="dlp-chip" title={p.note} onClick={() => applyPreset(p)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="dlp-row">
        <button className="dlp-btn primary" onClick={() => void copy()}>
          {copied ? '✓ Copied' : 'Copy JSON'}
        </button>
        <button className="dlp-btn" onClick={() => { Object.assign(lab, DEFAULTS); force(); }}>
          Reset
        </button>
      </div>
      <p className="dlp-note">
        Defaults mirror <code>src/game/DustTrail.tsx</code>. Green preset names the plume you'd
        bet on down the Sluice.
      </p>
    </div>
  );
}

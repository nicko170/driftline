/**
 * Storm Front Sandbox — control panel. Writes into the module-level `lab`
 * state; readouts poll the sim's stats aggregate at ~8 Hz. No deps.
 */
import { useEffect, useReducer, useState } from 'react';
import {
  DEFAULTS, PRESETS, SHIPPED, exportPayload, lab, releaseStorm, recallStorm, stats, storm,
  type LabState,
} from './state';
import { setRumbleEnabled } from './audio';

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
    <label className="sfs-slider">
      <span className="sfs-slider-label">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { (lab[k] as number) = +e.target.value; force(); }}
        aria-label={label}
      />
      <span className="sfs-slider-val">{format(v)}</span>
    </label>
  );
}

const STATUS_LABEL: Record<string, string> = {
  free: 'calm air',
  hunt: 'the wall hunts',
  caught: 'swallowed',
  sheltered: 'sheltered',
};

export function SandboxPanel() {
  const force = useForce();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

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

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    Object.assign(lab, p.set);
    force();
  };

  if (!open) {
    return (
      <button className="sfs-reopen" onClick={() => setOpen(true)} aria-label="Open storm controls">
        ⚙ Storm tuning
      </button>
    );
  }

  return (
    <div className="sfs-panel">
      <div className="sfs-head">
        <h2>Storm Front Sandbox</h2>
        <button className="sfs-icon" onClick={() => setOpen(false)} aria-label="Collapse panel">–</button>
      </div>

      <div className="sfs-stats" aria-live="off">
        <span className={`sfs-pill is-${stats.status}`}>{STATUS_LABEL[stats.status] ?? stats.status}</span>
        <span>face <b>{storm.active ? `${Math.max(0, storm.face).toFixed(0)}m` : '—'}</b></span>
        <span>wall <b>{storm.active ? storm.speed.toFixed(1) : '—'}</b> m/s</span>
        <span>margin <b>{storm.active ? `${stats.margin >= 0 ? '+' : ''}${stats.margin.toFixed(1)}` : '—'}</b></span>
        <span>best <b>{stats.bestTime > 0 ? `${stats.bestTime.toFixed(1)}s` : '—'}</b></span>
        <span>out <b>{stats.escapes}</b> / {stats.attempts}</span>
        <span><b>{stats.fps.toFixed(0)}</b> fps</span>
      </div>

      <div className="sfs-row">
        {storm.active ? (
          <button className="sfs-btn" onClick={() => { recallStorm(); force(); }}>[] Call off the wall</button>
        ) : (
          <button className="sfs-btn primary" onClick={() => { releaseStorm(); force(); }}>▶ Release the wall</button>
        )}
        <button
          className="sfs-btn"
          onClick={() => { lab.camMode = lab.camMode === 'chase' ? 'wide' : 'chase'; force(); }}
        >
          ◉ {lab.camMode === 'chase' ? 'Chase cam' : 'Wide view'}
        </button>
        <button
          className={`sfs-btn ${lab.rumble ? 'primary' : ''}`}
          onClick={() => { lab.rumble = !lab.rumble; setRumbleEnabled(lab.rumble); force(); }}
        >
          {lab.rumble ? '♪ Rumble on' : '♪ Rumble off'}
        </button>
      </div>
      <label className="sfs-check">
        <input
          type="checkbox" checked={lab.autoRearm}
          onChange={(e) => { lab.autoRearm = e.target.checked; force(); }}
        />
        <span>Auto-rearm after catch / shelter</span>
      </label>

      <h3>The hunt</h3>
      <Slider label="Wall speed" min={10} max={42} step={0.5} k="stormSpeed" format={(v) => `${v.toFixed(1)} m/s`} />
      <Slider label="Rubber-band" min={0} max={0.09} step={0.005} k="rubberband" format={(v) => v.toFixed(3)} />
      <Slider label="Catch cap" min={0} max={20} step={0.5} k="catchCap" format={(v) => `+${v.toFixed(1)} m/s`} />
      <Slider label="Spawn back" min={300} max={700} step={10} k="spawnBack" format={(v) => `${v.toFixed(0)} m`} />
      <Slider label="Feel range" min={200} max={700} step={10} k="feelRange" format={(v) => `${v.toFixed(0)} m`} />
      <Slider label="Bike top" min={22} max={46} step={1} k="bikeTop" format={(v) => `${v.toFixed(0)} m/s`} />

      <h3>The wall</h3>
      <Slider label="Wall height" min={60} max={320} step={5} k="wallHeight" format={(v) => `${v.toFixed(0)} m`} />
      <Slider label="Wall radius" min={90} max={260} step={5} k="radius" format={(v) => `${v.toFixed(0)} m`} />
      <Slider label="Density" min={0.2} max={1.8} step={0.05} k="density" format={(v) => `${v.toFixed(2)}×`} />
      <Slider label="Turbulence" min={0} max={2} step={0.05} k="turbulence" format={(v) => v.toFixed(2)} />
      <Slider label="Fog base" min={0.0004} max={0.004} step={0.0002} k="fogBase" format={(v) => (v * 1000).toFixed(1)} />
      <label className="sfs-check">
        <input
          type="checkbox" checked={lab.windStreaks}
          onChange={(e) => { lab.windStreaks = e.target.checked; force(); }}
        />
        <span>Wind streaks past the rider</span>
      </label>

      <h3>Presets</h3>
      <div className="sfs-row">
        {PRESETS.map((p) => (
          <button key={p.name} className="sfs-chip" title={p.note} onClick={() => applyPreset(p)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="sfs-row">
        <button className="sfs-btn primary" onClick={() => void copy()}>
          {copied ? '✓ Copied' : 'Copy JSON'}
        </button>
        <button className="sfs-btn" onClick={() => { Object.assign(lab, DEFAULTS); force(); }}>
          Reset
        </button>
      </div>
      <p className="sfs-note">
        Defaults mirror <code>src/game/MissionDirector.tsx</code> — base {SHIPPED.stormSpeed} m/s,
        rubber-band {SHIPPED.rubberband}, radius {SHIPPED.radius}m, spawn {SHIPPED.spawnBack}m back.
        The wall hunts; you dive for the teal arch. No slow gate, just speed.
      </p>
    </div>
  );
}

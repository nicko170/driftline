/**
 * BeamPanel — the HUD slider rail. Chakra Petch labels, amber-hot tabular
 * readouts, and a distinct glyph chip per control (shape carries the meaning;
 * colour is decoration). Presets for day/dusk/twilight/night, a verdict strip
 * from the analytic model, camera-view chips, and the export buttons.
 * Writes the module-level `beam` state; readouts poll at ~10 Hz while the
 * clock plays.
 */
import { useEffect, useReducer, useState } from 'react';
import { beam, resetBeam, evaluateBeam, nightFactor, exportSnippet, exportJson, type ViewPreset } from './beam';

function useForce() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  return bump;
}

function Slider({
  glyph, tone, label, min, max, step, get, set, format,
}: {
  glyph: string; tone: 'amber' | 'teal' | 'bone'; label: string;
  min: number; max: number; step: number;
  get: () => number; set: (v: number) => void; format: (v: number) => string;
}) {
  const force = useForce();
  const v = get();
  return (
    <label className="nbt-slider">
      <span className={`nbt-glyph ${tone}`} aria-hidden>{glyph}</span>
      <span className="nbt-slider-label">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { set(+e.target.value); force(); }}
        aria-label={label}
      />
      <span className="nbt-slider-val">{format(v)}</span>
    </label>
  );
}

const PHASES: [string, number][] = [
  ['Day', 0.5],
  ['Dusk', 0.78],
  ['Twilight', 0.86],
  ['Night', 0.99],
];

const VIEW_CHIPS: [ViewPreset, string, string][] = [
  ['chase', '◇', 'Chase'],
  ['profile', '◐', 'Profile'],
  ['footprint', '▦', 'Footprint'],
];

function clockString(t: number): string {
  const mins = Math.round(t * 24 * 60) % (24 * 60);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

export function BeamPanel() {
  const force = useForce();
  const [copied, setCopied] = useState<string | null>(null);

  // keep the readouts alive while the clock plays / beam ramps at dusk
  useEffect(() => {
    const id = window.setInterval(() => force(), 100);
    return () => window.clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const v = evaluateBeam();
  const nf = nightFactor(beam.t);

  const copy = async (which: 'props' | 'json') => {
    await copyText(which === 'props' ? exportSnippet() : JSON.stringify(exportJson(), null, 2));
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="nbt-panel">
      <div className="nbt-head">
        <h2>Night Beam Tuner</h2>
        <p>
          <span className="nbt-clock">{clockString(beam.t)}</span>
          <span className="nbt-night">night ×{nf.toFixed(2)}</span>
        </p>
      </div>

      <div className="nbt-scrub">
        <input
          type="range" min={0} max={999} value={Math.round(beam.t * 999)}
          onChange={(e) => { beam.t = +e.target.value / 999; beam.playing = false; force(); }}
          aria-label="Time of day"
        />
      </div>
      <div className="nbt-row">
        <button
          className="nbt-btn"
          onClick={() => { beam.playing = !beam.playing; force(); }}
        >
          {beam.playing ? '⏸ hold sky' : '▶ run sky'}
        </button>
        {PHASES.map(([label, t]) => (
          <button
            key={label}
            className={`nbt-chip${Math.abs(beam.t - t) < 0.004 ? ' on' : ''}`}
            onClick={() => { beam.t = t; beam.playing = false; force(); }}
          >
            {label}
          </button>
        ))}
      </div>

      <Slider glyph="◉" tone="amber" label="spot intensity" min={10} max={180} step={1}
        get={() => beam.intensity} set={(x) => { beam.intensity = x; }} format={(x) => `${Math.round(x)}`} />
      <Slider glyph="◆" tone="amber" label="cone angle" min={0.2} max={0.9} step={0.01}
        get={() => beam.angle} set={(x) => { beam.angle = x; }} format={(x) => `${Math.round((x * 180) / Math.PI)}°`} />
      <Slider glyph="◈" tone="amber" label="penumbra" min={0} max={1} step={0.05}
        get={() => beam.penumbra} set={(x) => { beam.penumbra = x; }} format={(x) => x.toFixed(2)} />
      <Slider glyph="▲" tone="teal" label="decay" min={1} max={2.2} step={0.05}
        get={() => beam.decay} set={(x) => { beam.decay = x; }} format={(x) => x.toFixed(2)} />
      <Slider glyph="▼" tone="teal" label="cutoff m" min={30} max={120} step={1}
        get={() => beam.distance} set={(x) => { beam.distance = x; }} format={(x) => `${Math.round(x)}`} />
      <Slider glyph="⤓" tone="bone" label="aim drop" min={-2.6} max={-0.2} step={0.05}
        get={() => beam.aimDrop} set={(x) => { beam.aimDrop = x; }} format={(x) => x.toFixed(2)} />
      <Slider glyph="→" tone="bone" label="aim ahead m" min={8} max={28} step={0.5}
        get={() => beam.aimAhead} set={(x) => { beam.aimAhead = x; }} format={(x) => x.toFixed(1)} />
      <Slider glyph="✦" tone="teal" label="dust cone" min={0} max={0.16} step={0.005}
        get={() => beam.coneOpacity} set={(x) => { beam.coneOpacity = x; }} format={(x) => x.toFixed(3)} />
      <Slider glyph="▣" tone="amber" label="lamp glow" min={0.5} max={8} step={0.1}
        get={() => beam.lampEmissive} set={(x) => { beam.lampEmissive = x; }} format={(x) => x.toFixed(1)} />
      <Slider glyph="◐" tone="bone" label="fog gain" min={0.5} max={2} step={0.05}
        get={() => beam.fogGain} set={(x) => { beam.fogGain = x; }} format={(x) => `×${x.toFixed(2)}`} />

      <div className={`nbt-verdict ${v.tone}`}>
        <span className="nbt-verdict-stats">
          read <b>{Math.round(v.read)} m</b> · pool <b>×{v.glare.toFixed(1)}</b> · band <b>×{v.band.toFixed(1)}</b>
        </span>
        <span className="nbt-verdict-label">{v.tone === 'good' ? '✔' : v.tone === 'warn' ? '▲' : '✖'} {v.label}</span>
      </div>

      <div className="nbt-row">
        {VIEW_CHIPS.map(([id, glyph, label]) => (
          <button
            key={id}
            className={`nbt-chip view${beam.view === id ? ' on' : ''}`}
            onClick={() => { beam.view = id; force(); }}
          >
            {glyph} {label}
          </button>
        ))}
      </div>

      <div className="nbt-row">
        <button className="nbt-btn primary" onClick={() => void copy('props')}>
          {copied === 'props' ? '✓ Copied' : 'Copy Bike.tsx props'}
        </button>
        <button className="nbt-btn" onClick={() => void copy('json')}>
          {copied === 'json' ? '✓ Copied' : 'Copy JSON'}
        </button>
        <button className="nbt-btn" onClick={() => { resetBeam(); force(); }}>
          Reset shipped
        </button>
      </div>

      <p className="nbt-footnote">
        Mirror of the Headlight in <code>src/game/Bike.tsx</code> — the ramp
        (<code>on = (night − 0.12)/0.35</code>) and mount points are the game's own.
        Goal: the salt between the teal frames (20–30 m) reads, the pool under the
        nose stays a lamp, not a searchlight.
      </p>
    </div>
  );
}

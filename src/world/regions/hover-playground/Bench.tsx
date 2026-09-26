/** DOM overlays: tuning bench (sliders + presets), stat readouts, hints. */
import { useEffect, useState } from 'react';
import { useTuning, PARAM_DEFS, PARAM_GROUPS, PRESETS } from './params';
import { labTelemetry } from './telemetry';
import { audio } from '../../../audio/audio';

export function Bench() {
  const params = useTuning((s) => s.params);
  const preset = useTuning((s) => s.preset);
  const setParam = useTuning((s) => s.setParam);
  const applyPreset = useTuning((s) => s.applyPreset);
  const bumpReset = useTuning((s) => s.bumpReset);
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button className="hp-bench-toggle" onClick={() => setOpen(true)} aria-label="Open tuning bench">
        Bench
      </button>
    );
  }

  return (
    <aside className="hp-bench panel" aria-label="Bike tuning bench">
      <div className="hp-bench-head">
        <div>
          <h2>Bike Bench</h2>
          <p className="hp-bench-sub dim">Live — changes apply same-frame</p>
        </div>
        <button className="hp-bench-close" onClick={() => setOpen(false)} aria-label="Collapse bench">—</button>
      </div>

      <div className="hp-presets" role="group" aria-label="Parameter presets">
        {Object.entries(PRESETS).map(([key, p]) => (
          <button
            key={key}
            className={`hp-preset ${preset === key ? 'active' : ''}`}
            title={p.note}
            onClick={() => { applyPreset(key); audio.blip(500, 0.06); }}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && <span className="hp-preset custom" title="Sliders moved off a preset">Custom</span>}
      </div>

      {PARAM_GROUPS.map((group) => (
        <section key={group} className="hp-group">
          <h3>{group}</h3>
          {PARAM_DEFS.filter((d) => d.group === group).map((d) => (
            <label key={d.key} className="hp-row">
              <span className="hp-row-label">{d.label}</span>
              <span className="hp-chip">{d.fmt(params[d.key])}</span>
              <input
                type="range"
                min={d.min}
                max={d.max}
                step={d.step}
                value={params[d.key]}
                aria-label={d.label}
                onChange={(e) => setParam(d.key, Number(e.target.value))}
              />
            </label>
          ))}
        </section>
      ))}

      <div className="hp-bench-actions">
        <button className="btn primary" onClick={() => { bumpReset(); }}>
          Reset to spawn <kbd>R</kbd>
        </button>
      </div>
    </aside>
  );
}

interface Stats {
  speed: number; boost: number; boosting: boolean;
  grounded: boolean; drifting: boolean; driftTime: number;
  slipDeg: number; surface: string;
}

export function StatsHud() {
  const [s, setS] = useState<Stats>({ speed: 0, boost: 1, boosting: false, grounded: true, drifting: false, driftTime: 0, slipDeg: 0, surface: 'salt' });

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = labTelemetry;
      setS({
        speed: t.speed, boost: t.boost, boosting: t.boosting,
        grounded: t.grounded, drifting: t.drifting, driftTime: t.driftTime,
        slipDeg: t.slipDeg, surface: t.surface,
      });
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <div className="hp-status" aria-hidden>
        <span className={`hp-state ${s.grounded ? 'ground' : 'air'}`}>{s.grounded ? 'GROUND' : 'AIR'}</span>
        <span className={`hp-state surf-${s.surface}`}>{s.surface.toUpperCase()}</span>
        {s.drifting && (
          <span className="hp-state drift">DRIFT {s.driftTime.toFixed(1)}s · {Math.round(s.slipDeg)}°</span>
        )}
      </div>

      <div className="hp-stats">
        <div className="hp-speed">
          <span className="hp-speed-value">{Math.round(s.speed * 3.6)}</span>
          <span className="hp-speed-unit">km/h</span>
        </div>
        <div className={`hp-boostbar ${s.boosting ? 'boosting' : ''}`}>
          <div className="hp-boostbar-fill" style={{ width: `${Math.round(s.boost * 100)}%` }} />
        </div>
      </div>
    </>
  );
}

export function HintBar() {
  return (
    <p className="hp-hint dim">
      <kbd>W A S D</kbd> drive · <kbd>Shift</kbd> boost · <kbd>Space</kbd> hop ·
      <kbd>S</kbd>+steer drift · <kbd>R</kbd> reset
    </p>
  );
}

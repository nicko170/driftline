/**
 * Bench panel — everything apply-same-frame: upgrade ladder pips (0–3),
 * the headroom curve graphs, grouped tuning sliders, plus the bench
 * actions (baseline reset, respawn, copy-settings-JSON). Reading the store
 * here is safe at slider rate; the physics step reads it imperatively.
 */
import { useState } from 'react';
import {
  useTuning,
  PARAM_DEFS,
  PARAM_GROUPS,
  LADDER_INFO,
  BASELINE,
  effective,
  isCustom,
  type LadderKey,
} from './params';
import LadderCurves, { effectiveLine } from './Curves';
import { audio } from '../../../audio/audio';

const LADDER_KEYS: LadderKey[] = ['engine', 'handling', 'boost'];

export default function Panel() {
  const params = useTuning((s) => s.params);
  const ladders = useTuning((s) => s.ladders);
  const setParam = useTuning((s) => s.setParam);
  const setLadder = useTuning((s) => s.setLadder);
  const baseline = useTuning((s) => s.baseline);
  const bumpReset = useTuning((s) => s.bumpReset);
  const [open, setOpen] = useState(true);
  const [curvesOpen, setCurvesOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!open) {
    return (
      <button className="hcl-bench-toggle" onClick={() => { setOpen(true); audio.blip(760, 0.06); }} aria-label="Open handling bench">
        Bench
      </button>
    );
  }

  const custom = isCustom(params, ladders);

  const copyJson = () => {
    const payload = {
      bench: 'driftline/handling-curve-lab',
      shippingBaseline: BASELINE,
      params,
      ladders,
      effective: effective(params, ladders),
    };
    const json = JSON.stringify(payload, null, 2);
    const done = () => {
      setCopied(true);
      audio.blip(880, 0.07);
      window.setTimeout(() => setCopied(false), 1400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(done, () => fallbackCopy(json, done));
    } else {
      fallbackCopy(json, done);
    }
  };

  return (
    <aside className="hcl-panel panel" aria-label="Handling tuning bench">
      <div className="hcl-bench-head">
        <div>
          <h2>Handling Bench {custom && <span className="hcl-badge">tuned</span>}</h2>
          <p className="hcl-bench-sub dim">Live — changes apply same-frame · numbers mirror the shipping controller</p>
        </div>
        <button className="hcl-bench-close" onClick={() => setOpen(false)} aria-label="Collapse bench">—</button>
      </div>

      <p className="hcl-effective" title="Effective controller constants (sliders + fitted ladder)">
        {effectiveLine(params, ladders)}
      </p>

      <section className="hcl-group" aria-label="Upgrade ladders">
        <h3>Upgrade ladder (fitted)</h3>
        {LADDER_KEYS.map((key) => {
          const info = LADDER_INFO[key];
          const lvl = ladders[key];
          return (
            <div className="hcl-ladder" key={key}>
              <div className="hcl-ladder-head">
                <span className="hcl-ladder-name">{info.name}</span>
                <span className="hcl-ladder-per dim">{info.per}</span>
              </div>
              <div className="hcl-pips" role="group" aria-label={`${info.name} level`}>
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={`hcl-pip ${n <= lvl ? 'on' : ''} ${n === lvl ? 'current' : ''}`}
                    aria-pressed={n === lvl}
                    title={`Fit ${info.name} level ${n}`}
                    onClick={() => { setLadder(key, n); audio.blip(500 + n * 120, 0.05); }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="hcl-group">
        <h3>
          Headroom curves{' '}
          <button
            className="hcl-mini-toggle"
            onClick={() => setCurvesOpen((v) => !v)}
            aria-expanded={curvesOpen}
          >
            {curvesOpen ? 'hide' : 'show'}
          </button>
        </h3>
        {curvesOpen && <LadderCurves />}
      </section>

      {PARAM_GROUPS.map((group) => (
        <section key={group} className="hcl-group">
          <h3>{group}</h3>
          {PARAM_DEFS.filter((d) => d.group === group).map((d) => (
            <label key={d.key} className="hcl-row">
              <span className="hcl-row-label">{d.label}</span>
              <span className="hcl-chip">{d.fmt(params[d.key])}</span>
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

      <div className="hcl-actions">
        <button className="btn primary" onClick={() => { bumpReset(); }}>
          Respawn <kbd>R</kbd>
        </button>
        <button className="btn" onClick={() => { baseline(); audio.blip(440, 0.08); }}>
          Baseline
        </button>
        <button className="btn" onClick={copyJson}>
          {copied ? 'Copied ✓' : 'Copy settings JSON'}
        </button>
      </div>
    </aside>
  );
}

/** textarea fallback for non-secure-context clipboard */
function fallbackCopy(text: string, done: () => void) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    /* leave the state alone */
  }
  document.body.removeChild(ta);
}

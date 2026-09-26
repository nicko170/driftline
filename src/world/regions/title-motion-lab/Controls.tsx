/**
 * CONTROLS — every token on a slider or chip row, the network simulator, the
 * reduced-motion toggle, replay, and the export snippet the shipped
 * TitleScreen can adopt verbatim.
 */
import { useState } from 'react';
import { audio } from '../../../audio/audio';
import {
  EASES,
  EASE_ORDER,
  NETWORKS,
  NET_ORDER,
  buildExport,
  type EaseId,
  type NetId,
  type TitleTokens,
} from './tokens';

export type EpiloguePick = 'none' | 'rain' | 'quiet';

interface ControlsProps {
  tokens: TitleTokens;
  patch: (p: Partial<TitleTokens>) => void;
  reset: () => void;
  epilogue: EpiloguePick;
  setEpilogue: (p: EpiloguePick) => void;
  reduce: boolean;
  setReduce: (b: boolean) => void;
  onReplay: () => void;
}

interface SliderDef {
  key: keyof TitleTokens;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
}

const SLIDERS: SliderDef[] = [
  { key: 'baseMs', label: 'Base delay', min: 0, max: 600, step: 10, unit: 'ms', hint: 'breathing room before the kicker' },
  { key: 'stepMs', label: 'Beat step', min: 0, max: 240, step: 5, unit: 'ms', hint: 'offset between structural beats' },
  { key: 'durMs', label: 'Beat duration', min: 160, max: 900, step: 10, unit: 'ms', hint: 'how long each arrival takes' },
  { key: 'risePx', label: 'Rise', min: 0, max: 40, step: 1, unit: 'px', hint: 'entrance travel; DESIGN.md caps UI at 4px rises, the logo earns more' },
  { key: 'menuStepMs', label: 'Menu stagger', min: 0, max: 160, step: 5, unit: 'ms', hint: 'extra drumbeat between menu buttons' },
  { key: 'epiMs', label: 'Epilogue reveal', min: 200, max: 1400, step: 20, unit: 'ms', hint: 'the panel unfill duration' },
  { key: 'parallaxPx', label: 'Parallax swing', min: 0, max: 28, step: 1, unit: 'px', hint: 'nearest-layer travel at full pointer swing' },
];

const EPILOGUE_PICKS: { id: EpiloguePick; label: string }[] = [
  { id: 'none', label: 'No ending yet' },
  { id: 'rain', label: 'Rain ending' },
  { id: 'quiet', label: 'Quiet ending' },
];

export function Controls({
  tokens,
  patch,
  reset,
  epilogue,
  setEpilogue,
  reduce,
  setReduce,
  onReplay,
}: ControlsProps) {
  const [copied, setCopied] = useState(false);
  const css = buildExport(tokens);

  const copy = async () => {
    audio.blip(1180, 0.06);
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="tml-controls">
      <section className="panel tml-panel">
        <h3>Scene</h3>
        <div className="tml-chips" role="group" aria-label="Epilogue panel state">
          {EPILOGUE_PICKS.map((p) => (
            <button
              key={p.id}
              className={`tml-chip-btn ${epilogue === p.id ? 'on' : ''}`}
              onClick={() => setEpilogue(p.id)}
              aria-pressed={epilogue === p.id}
            >
              <i aria-hidden="true">{p.id === 'none' ? '▯' : '▣'}</i> {p.label}
            </button>
          ))}
        </div>
        <button
          className={`tml-chip-btn tml-reduce ${reduce ? 'on' : ''}`}
          onClick={() => setReduce(!reduce)}
          aria-pressed={reduce}
        >
          <i aria-hidden="true">{reduce ? '▣' : '▯'}</i> Reduced motion
          <span className="tml-chip-note">{reduce ? 'fades only, no parallax, tight stagger' : 'full swing'}</span>
        </button>
      </section>

      <section className="panel tml-panel">
        <h3>Easing</h3>
        <div className="tml-chips" role="group" aria-label="Easing curve">
          {EASE_ORDER.map((id: EaseId) => (
            <button
              key={id}
              className={`tml-chip-btn ${tokens.ease === id ? 'on' : ''}`}
              onClick={() => patch({ ease: id })}
              aria-pressed={tokens.ease === id}
            >
              {EASES[id].label}
            </button>
          ))}
        </div>
        <p className="tml-note">{EASES[tokens.ease].note}</p>
      </section>

      <section className="panel tml-panel">
        <h3>Network</h3>
        <div className="tml-chips" role="group" aria-label="Simulated network speed">
          {NET_ORDER.map((id: NetId) => (
            <button
              key={id}
              className={`tml-chip-btn ${tokens.net === id ? 'on' : ''}`}
              onClick={() => patch({ net: id })}
              aria-pressed={tokens.net === id}
            >
              {NETWORKS[id].label}
            </button>
          ))}
        </div>
        <p className="tml-note">
          Faces land at <strong>{NETWORKS[tokens.net].delayMs}ms</strong> — until then the replica
          renders in the system fallback stack. {NETWORKS[tokens.net].note}
        </p>
      </section>

      <section className="panel tml-panel">
        <h3>Tokens</h3>
        {SLIDERS.map((s) => (
          <label key={s.key} className="tml-slider">
            <span className="tml-slider-head">
              {s.label}
              <b>
                {tokens[s.key]}
                {s.unit}
              </b>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={tokens[s.key]}
              disabled={s.key === 'parallaxPx' && reduce}
              onChange={(e) => patch({ [s.key]: Number(e.target.value) } as Partial<TitleTokens>)}
              aria-label={s.label}
            />
            <span className="tml-slider-hint">{s.hint}</span>
          </label>
        ))}
      </section>

      <div className="tml-actions">
        <button
          className="btn primary big"
          onClick={() => {
            audio.blip(880, 0.08);
            onReplay();
          }}
        >
          ↺ Replay the entrance
        </button>
        <button className="btn" onClick={reset}>
          Reset to shipped
        </button>
      </div>

      <section className="panel tml-panel tml-export">
        <h3>Export — timing tokens</h3>
        <p className="tml-note">
          Drop into <code>ui.css</code> beside the title rules and the shipped TitleScreen inherits
          this exact choreography.
        </p>
        <pre className="tml-css">{css}</pre>
        <button className="btn small" onClick={copy}>
          {copied ? '✓ Copied to clipboard' : 'Copy CSS'}
        </button>
      </section>
    </div>
  );
}

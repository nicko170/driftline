/**
 * Codex Reader Lab — the typesetting toolbar. Sliders for size / leading /
 * measure / tracking, switches for typeface, reader mode and compare view,
 * plus reset and a copy-the-CSS export. All controls are plain labelled
 * inputs; chips carry a glyph next to their label so state never rides on
 * colour alone.
 */
import { useCallback, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  READER_MODES,
  settingsToCss,
  type ReaderFont,
  type ReaderMode,
  type ReaderSettings,
} from './data';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, unit, format, onChange }: SliderProps) {
  const shown = format ? format(value) : `${value}${unit}`;
  return (
    <label className="crl-slider">
      <span className="crl-slider-label">
        {label}
        <b>{shown}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} (${shown})`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Chip({
  active,
  glyph,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  glyph: string;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`crl-chip ${active ? 'on' : ''}`}
      aria-pressed={active}
      title={hint}
      onClick={onClick}
    >
      <i aria-hidden="true">{glyph}</i> {label}
    </button>
  );
}

export function Controls({
  settings,
  onChange,
}: {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCss = useCallback(async () => {
    const css = settingsToCss(settings);
    let ok = false;
    try {
      await navigator.clipboard.writeText(css);
      ok = true;
    } catch {
      // clipboard API denied (non-secure context, perms) — legacy fallback
      const ta = document.createElement('textarea');
      ta.value = css;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [settings]);

  return (
    <div className="crl-controls" role="group" aria-label="Typesetting controls">
      <div className="crl-ctrl-block">
        <p className="crl-ctrl-title">Type</p>
        <Slider
          label="Size"
          value={settings.size}
          min={14}
          max={22}
          step={0.5}
          unit="px"
          format={(v) => `${v.toFixed(1)}px`}
          onChange={(size) => onChange({ size })}
        />
        <Slider
          label="Leading"
          value={settings.leading}
          min={1.35}
          max={2.05}
          step={0.01}
          unit=""
          format={(v) => `×${v.toFixed(2)}`}
          onChange={(leading) => onChange({ leading })}
        />
        <Slider
          label="Measure"
          value={settings.measure}
          min={44}
          max={86}
          step={1}
          unit="ch"
          onChange={(measure) => onChange({ measure })}
        />
        <Slider
          label="Tracking"
          value={settings.tracking}
          min={-2}
          max={4}
          step={0.5}
          unit=""
          format={(v) => `${(v / 100).toFixed(2)}em`}
          onChange={(tracking) => onChange({ tracking })}
        />
      </div>

      <div className="crl-ctrl-block">
        <p className="crl-ctrl-title">Face</p>
        <div className="crl-chiprow">
          <Chip
            active={settings.font === 'sora'}
            glyph="Aa"
            label="Sora"
            hint="the UI body face"
            onClick={() => onChange({ font: 'sora' as ReaderFont })}
          />
          <Chip
            active={settings.font === 'serif'}
            glyph="Aa"
            label="Serif"
            hint="ui-serif stack — how a printed page might feel"
            onClick={() => onChange({ font: 'serif' as ReaderFont })}
          />
        </div>
        <p className="crl-ctrl-title">Sheet</p>
        <div className="crl-chiprow">
          {READER_MODES.map((m) => (
            <Chip
              key={m.id}
              active={settings.mode === m.id}
              glyph={m.glyph}
              label={m.label}
              hint={m.hint}
              onClick={() => onChange({ mode: m.id as ReaderMode })}
            />
          ))}
        </div>
      </div>

      <div className="crl-ctrl-block">
        <p className="crl-ctrl-title">Bench</p>
        <div className="crl-chiprow">
          <Chip
            active={settings.compare}
            glyph="◫"
            label="Compare"
            hint="split view: today's codex vs your tuned sheet"
            onClick={() => onChange({ compare: !settings.compare })}
          />
          <Chip
            active={false}
            glyph="↺"
            label="Reset"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
          />
          <button type="button" className="crl-chip crl-copy" onClick={copyCss}>
            <i aria-hidden="true">⧉</i> {copied ? 'CSS copied!' : 'Copy CSS'}
          </button>
        </div>
        <p className="crl-ctrl-note">
          Copy CSS hands the tuned values to the real <code>.codex-reading</code> pane.
          Settings persist between visits.
        </p>
      </div>
    </div>
  );
}

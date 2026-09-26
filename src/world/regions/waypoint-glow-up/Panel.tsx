/**
 * WAYPOINT & BEACON BENCH — control panel.
 *
 * Switches the range's colourway + station spacing, freezes motion, and drives
 * the colour-vision simulation. A legend renders every marker's swatch through
 * the SAME CVD matrix as the canvas so panel and scene never disagree, and the
 * contrast matrix measures each marker against the night backdrop under all
 * three deficiencies. "Copy spec JSON" exports the shipping constants.
 */
import { useState } from 'react';
import { withBase } from '../../../lib/base';
import {
  MARKERS, COLOURWAYS, LAYOUTS, NIGHT_BG,
  contrast, applyMatrix, markerColor, specJson,
  type BenchConfig, type ColourwayId, type LayoutId,
} from './spec';
import { CVD_LIST, CVD_MATRICES, type CvdId } from './cvd';

const CVD_COLS: Exclude<CvdId, 'none'>[] = ['protan', 'deutan', 'tritan'];
const PASS_RATIO = 3; // WCAG non-text UI guidance; markers are large, so ≥3:1 is our bar

function Grade({ ratio }: { ratio: number }) {
  return (
    <td className={ratio >= PASS_RATIO ? 'wgl-pass' : 'wgl-warn'}>
      {ratio.toFixed(2)}
      <span className="wgl-grade">{ratio >= PASS_RATIO ? ' ✓' : ' ✕'}</span>
    </td>
  );
}

export function BenchPanel({ cfg, onChange }: { cfg: BenchConfig; onChange: (c: BenchConfig) => void }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const way = COLOURWAYS[cfg.colourway];
  const cvdMatrix = cfg.cvd === 'none' ? null : CVD_MATRICES[cfg.cvd];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(specJson(way));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (!open) {
    return (
      <button className="wgl-reopen" onClick={() => setOpen(true)}>
        ◈ beacon bench
      </button>
    );
  }

  return (
    <div className="wgl-panel">
      <div className="wgl-head">
        <h2>Waypoint &amp; Beacon Bench</h2>
        <button className="wgl-icon" onClick={() => setOpen(false)} aria-label="Hide panel">×</button>
      </div>
      <img
        className="wgl-keyart"
        src={withBase('images/work/waypoint-glow-up.jpg')}
        alt="Low-poly night test range lined with glowing amber, teal and red holographic beacons under a crescent moon"
      />
      <div className="wgl-stats">
        range <b>{LAYOUTS[cfg.layout].label}</b> · colourway <b>{way.label}</b> · vision{' '}
        <b>{CVD_LIST.find((c) => c.id === cfg.cvd)?.label}</b>
      </div>

      <h3>Colourway</h3>
      <div className="wgl-row" role="group" aria-label="Colourway">
        {(Object.keys(COLOURWAYS) as ColourwayId[]).map((id) => (
          <button
            key={id}
            className={`wgl-chip${cfg.colourway === id ? ' on' : ''}`}
            aria-pressed={cfg.colourway === id}
            onClick={() => onChange({ ...cfg, colourway: id })}
          >
            {COLOURWAYS[id].label}
          </button>
        ))}
      </div>
      <p className="wgl-note">{way.note}</p>

      <h3>Station spacing</h3>
      <div className="wgl-row" role="group" aria-label="Station distance range">
        {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
          <button
            key={id}
            className={`wgl-chip${cfg.layout === id ? ' on' : ''}`}
            aria-pressed={cfg.layout === id}
            onClick={() => onChange({ ...cfg, layout: id })}
          >
            {LAYOUTS[id].label}
          </button>
        ))}
      </div>
      <p className="wgl-note">{LAYOUTS[cfg.layout].note}</p>

      <label className="wgl-check">
        <input
          type="checkbox"
          checked={cfg.motion}
          onChange={(e) => onChange({ ...cfg, motion: e.target.checked })}
        />
        <span>marker motion</span>
        <em>hoist spin, bob, scan sweep, storm churn</em>
      </label>

      <h3>Vision simulation</h3>
      <div className="wgl-row" role="group" aria-label="Colour-vision simulation">
        {CVD_LIST.map((c) => (
          <button
            key={c.id}
            className={`wgl-chip${cfg.cvd === c.id ? ' on' : ''}`}
            aria-pressed={cfg.cvd === c.id}
            onClick={() => onChange({ ...cfg, cvd: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="wgl-note">
        {CVD_LIST.find((c) => c.id === cfg.cvd)?.note} · Machado 2009 matrix runs as an SVG{' '}
        <code>feColorMatrix</code> over the live canvas — glow and fog are simulated too.
      </p>

      <h3>Shape ⇄ colour legend</h3>
      <table className="wgl-table">
        <thead>
          <tr><th>shape</th><th>marker</th><th>swatch</th></tr>
        </thead>
        <tbody>
          {MARKERS.map((d) => {
            const c = markerColor(d, way);
            const shown = cvdMatrix ? applyMatrix(c, cvdMatrix) : c;
            return (
              <tr key={d.id}>
                <td className="wgl-glyph">{d.glyph}</td>
                <td>{d.label}<em>{d.role}</em></td>
                <td>
                  <span className="wgl-swatch" style={{ background: shown, borderColor: c }} title={`${c}${cvdMatrix ? ` → ${shown} (${cfg.cvd})` : ''}`} />
                  <code>{c}</code>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>Contrast vs night backdrop <code>{NIGHT_BG}</code></h3>
      <table className="wgl-table wgl-contrast">
        <thead>
          <tr><th>marker</th><th>sRGB</th><th>protan</th><th>deutan</th><th>tritan</th></tr>
        </thead>
        <tbody>
          {MARKERS.map((d) => {
            const c = markerColor(d, way);
            return (
              <tr key={d.id}>
                <td><span className="wgl-glyph-sm">{d.glyph}</span> {d.id}</td>
                <Grade ratio={contrast(c, NIGHT_BG)} />
                {CVD_COLS.map((k) => (
                  <Grade key={k} ratio={contrast(applyMatrix(c, CVD_MATRICES[k]), NIGHT_BG)} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="wgl-note">
        bar: ≥{PASS_RATIO}:1. When a colourway dips under it — throw the <code>ghost</code> colourway
        at the range — the glyphs above the table still name every marker uniquely. That is the
        shipping accessibility rule: <b>shape is the identity; colour is decoration.</b>
      </p>

      <div className="wgl-row">
        <button className="wgl-btn primary" onClick={copy}>
          {copied ? '✓ copied' : 'copy spec JSON'}
        </button>
        <button className="wgl-btn" onClick={() => onChange({ colourway: 'shipped', layout: 'standard', motion: true, cvd: 'none' })}>
          reset bench
        </button>
      </div>
    </div>
  );
}

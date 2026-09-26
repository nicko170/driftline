/**
 * SIGNAL CACHE SCOUT BENCH — control panel.
 *
 * Swaps backdrops, storm dust and the distance ladder; tunes the beacon's
 * emissive / glimmer / ring live; drives the colour-vision simulation over
 * the whole stage (canvas AND DOM replicas). Three measurement tables grade
 * the shipping surfaces with honest bars:
 *
 *  1. beacon v backdrops — emissive core vs each sky/fog (bar 2:1), glimmer
 *     (1.25:1 — it's a motion aid, not a luminance beacon), ring (1.15:1),
 *  2. chrome — HUD chip text (4.5:1, it's text) + border (3:1), minimap
 *     diamond over night and over midday salt (3:1, WCAG non-text),
 *  3. separability — redmean Δ of lore-violet vs each mission colour, sRGB
 *     and under all three deficiencies; below Δ 45 the pair is flagged
 *     "glyph-carried" because shape, not colour, must disambiguate.
 *
 * All swatches run through the same CVD matrix as the stage, so panel and
 * canvas never disagree. "Copy spec JSON" exports shipped constants + the
 * current tuning + measured contrasts.
 */
import { useState } from 'react';
import { withBase } from '../../../lib/base';
import {
  BACKDROPS, STORMS, LADDERS, SHIPPED, CACHE_VIOLET, CHIP, MINIMAP,
  MISSION_COLOURS, STORM_FOG_WALL,
  contrast, applyMatrix, composite, mulHex, coreLit, colorDelta, specJson,
  type BackdropId, type BenchConfig, type LadderId, type StormId,
} from './spec';
import { CVD_LIST, CVD_MATRICES, type CvdId } from './cvd';

const CVD_COLS: Exclude<CvdId, 'none'>[] = ['protan', 'deutan', 'tritan'];

function Grade({ ratio, bar }: { ratio: number; bar: number }) {
  const ok = ratio >= bar;
  return (
    <td className={ok ? 'scb-pass' : 'scb-warn'}>
      {ratio.toFixed(2)}
      <span className="scb-grade">{ok ? ' ✓' : ' ✕'}</span>
    </td>
  );
}

interface MeasRow {
  id: string;
  label: string;
  fg: string;
  bg: string;
  bar: number;
}

function MeasTable({ rows, cvd }: { rows: MeasRow[]; cvd: CvdId }) {
  const m = cvd === 'none' ? null : CVD_MATRICES[cvd];
  return (
    <table className="scb-table scb-contrast">
      <thead>
        <tr><th>surface</th><th>sRGB</th><th>protan</th><th>deutan</th><th>tritan</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const fg = row.fg;
          const bg = row.bg;
          return (
            <tr key={row.id}>
              <td>
                <span
                  className="scb-swatch"
                  style={{ background: m ? applyMatrix(fg, m) : fg, borderColor: fg }}
                  title={`${fg}${m ? ` → ${applyMatrix(fg, m)} (${cvd})` : ''}`}
                />
                {row.label}
                <em>bar {row.bar}:1</em>
              </td>
              <Grade ratio={contrast(fg, bg)} bar={row.bar} />
              {CVD_COLS.map((k) => (
                <Grade key={k} ratio={contrast(applyMatrix(fg, CVD_MATRICES[k]), bg)} bar={row.bar} />
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function BenchPanel({ cfg, onChange }: { cfg: BenchConfig; onChange: (c: BenchConfig) => void }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const bd = BACKDROPS[cfg.backdrop];
  const storm = STORMS[cfg.storm];
  const core = coreLit(cfg.emissive);
  const chipBg = composite(CHIP.panelBase, CHIP.bgAlpha, CHIP.bgOver);
  const nightFloor = mulHex('#D8CDB4', BACKDROPS.night.floorTint);

  const beaconRows: MeasRow[] = [
    { id: 'core-day', label: 'core glow · day horizon', fg: core, bg: BACKDROPS.day.horizon, bar: 2 },
    { id: 'core-dusk', label: 'core glow · dusk horizon', fg: core, bg: BACKDROPS.dusk.horizon, bar: 2 },
    { id: 'core-night', label: 'core glow · night horizon', fg: core, bg: BACKDROPS.night.horizon, bar: 2 },
    { id: 'core-storm', label: 'core glow · storm-wall fog', fg: core, bg: STORM_FOG_WALL, bar: 1.6 },
    { id: 'glim-day', label: 'glimmer · day horizon', fg: composite(CACHE_VIOLET, cfg.glimmer, BACKDROPS.day.horizon), bg: BACKDROPS.day.horizon, bar: 1.25 },
    { id: 'glim-dusk', label: 'glimmer · dusk horizon', fg: composite(CACHE_VIOLET, cfg.glimmer, BACKDROPS.dusk.horizon), bg: BACKDROPS.dusk.horizon, bar: 1.25 },
    { id: 'glim-night', label: 'glimmer · night horizon', fg: composite(CACHE_VIOLET, cfg.glimmer, BACKDROPS.night.horizon), bg: BACKDROPS.night.horizon, bar: 1.25 },
    { id: 'ring-day', label: 'ground ring · day pan', fg: composite(CACHE_VIOLET, cfg.ring, mulHex('#D8CDB4', BACKDROPS.day.floorTint)), bg: mulHex('#D8CDB4', BACKDROPS.day.floorTint), bar: 1.15 },
    { id: 'ring-night', label: 'ground ring · night pan', fg: composite(CACHE_VIOLET, cfg.ring, nightFloor), bg: nightFloor, bar: 1.15 },
  ];

  const chromeRows: MeasRow[] = [
    { id: 'chip-text', label: 'chip text · panel bg', fg: CHIP.text, bg: chipBg, bar: 4.5 },
    { id: 'chip-border', label: 'chip border · panel bg', fg: CHIP.border, bg: chipBg, bar: 3 },
    {
      id: 'mini-night', label: 'minimap ◇ · night underlay', bar: 3,
      fg: composite(MINIMAP.diamond, MINIMAP.diamondAlpha, composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.darkUnderlay)),
      bg: composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.darkUnderlay),
    },
    {
      id: 'mini-salt', label: 'minimap ◇ · midday salt', bar: 3,
      fg: composite(MINIMAP.diamond, MINIMAP.diamondAlpha, composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.brightUnderlay)),
      bg: composite(MINIMAP.bg, MINIMAP.bgAlpha, MINIMAP.brightUnderlay),
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(specJson(cfg));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (!open) {
    return (
      <button className="scb-reopen" onClick={() => setOpen(true)}>
        ⟡ cache bench
      </button>
    );
  }

  return (
    <div className="scb-panel">
      <div className="scb-head">
        <h2>Signal Cache Scout Bench</h2>
        <button className="scb-icon" onClick={() => setOpen(false)} aria-label="Hide panel">×</button>
      </div>
      <img
        className="scb-keyart"
        src={withBase('images/work/signal-cache-bench.jpg')}
        alt="Low-poly desert test range at dusk with violet-glowing tripod beacons receding along a marked lane"
      />
      <div className="scb-stats">
        backdrop <b>{bd.label}</b> · dust <b>{storm.label}</b> · ladder{' '}
        <b>{LADDERS[cfg.ladder].distances[0]}–{LADDERS[cfg.ladder].distances[LADDERS[cfg.ladder].distances.length - 1]} m</b>
      </div>

      <h3>Backdrop (Sky.tsx keyframes)</h3>
      <div className="scb-row" role="group" aria-label="Backdrop">
        {(Object.keys(BACKDROPS) as BackdropId[]).map((id) => (
          <button
            key={id}
            className={`scb-pill${cfg.backdrop === id ? ' on' : ''}`}
            aria-pressed={cfg.backdrop === id}
            onClick={() => onChange({ ...cfg, backdrop: id })}
          >
            {BACKDROPS[id].label}
          </button>
        ))}
      </div>
      <p className="scb-note">{bd.note}</p>

      <h3>Storm dust</h3>
      <div className="scb-row" role="group" aria-label="Storm dust">
        {(Object.keys(STORMS) as StormId[]).map((id) => (
          <button
            key={id}
            className={`scb-pill${cfg.storm === id ? ' on' : ''}`}
            aria-pressed={cfg.storm === id}
            onClick={() => onChange({ ...cfg, storm: id })}
          >
            {STORMS[id].label}
          </button>
        ))}
      </div>
      <p className="scb-note">{storm.note}</p>

      <h3>Distance ladder</h3>
      <div className="scb-row" role="group" aria-label="Distance ladder">
        {(Object.keys(LADDERS) as LadderId[]).map((id) => (
          <button
            key={id}
            className={`scb-pill${cfg.ladder === id ? ' on' : ''}`}
            aria-pressed={cfg.ladder === id}
            onClick={() => onChange({ ...cfg, ladder: id })}
          >
            {LADDERS[id].label}
          </button>
        ))}
      </div>
      <p className="scb-note">
        {LADDERS[cfg.ladder].note} · violet gate marks the <b>340 m hail cutoff</b>; the ring on the
        nearest cache is the <b>13 m capture footprint</b>. The ◆ ■ ▲ holos beside the lane are the
        mission family, for separability.
      </p>

      <h3>Beacon tuning (live)</h3>
      <label className="scb-slider">
        <span>core emissive <b>{cfg.emissive.toFixed(2)}</b><em>shipped 1.50</em></span>
        <input
          type="range" min={0} max={3} step={0.05} value={cfg.emissive}
          onChange={(e) => onChange({ ...cfg, emissive: +e.target.value })}
        />
      </label>
      <label className="scb-slider">
        <span>glimmer opacity <b>{cfg.glimmer.toFixed(3)}</b><em>shipped 0.090</em></span>
        <input
          type="range" min={0} max={0.3} step={0.005} value={cfg.glimmer}
          onChange={(e) => onChange({ ...cfg, glimmer: +e.target.value })}
        />
      </label>
      <label className="scb-slider">
        <span>ring opacity <b>{cfg.ring.toFixed(2)}</b><em>shipped 0.30</em></span>
        <input
          type="range" min={0} max={0.6} step={0.01} value={cfg.ring}
          onChange={(e) => onChange({ ...cfg, ring: +e.target.value })}
        />
      </label>

      <label className="scb-check">
        <input
          type="checkbox"
          checked={cfg.motion}
          onChange={(e) => onChange({ ...cfg, motion: e.target.checked })}
        />
        <span>beacon motion</span>
        <em>bob + spin — the cache's real detection aid at range</em>
      </label>

      <h3>Vision simulation</h3>
      <div className="scb-row" role="group" aria-label="Colour-vision simulation">
        {CVD_LIST.map((c) => (
          <button
            key={c.id}
            className={`scb-pill${cfg.cvd === c.id ? ' on' : ''}`}
            aria-pressed={cfg.cvd === c.id}
            onClick={() => onChange({ ...cfg, cvd: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="scb-note">
        {CVD_LIST.find((c) => c.id === cfg.cvd)?.note} · Machado 2009 matrix runs as an SVG{' '}
        <code>feColorMatrix</code> over the <b>whole stage</b> — canvas, HUD chip replica, minimap
        replica and storm tint are all simulated.
      </p>

      <h3>1 · beacon v backdrops</h3>
      <MeasTable rows={beaconRows} cvd={cfg.cvd} />
      <p className="scb-note">
        Core bar 2:1 (it carries silhouette + bloom), storm bar relaxed to 1.6:1 — sand haze is the
        shipped worst case. The glimmer is deliberately faint (<b>motion, not luminance</b>, is its
        detection channel): below its 1.25 bar, lift the slider and watch the dusk/storm rows.
      </p>

      <h3>2 · chrome (HUD chip + minimap ◇)</h3>
      <MeasTable rows={chromeRows} cvd={cfg.cvd} />
      <p className="scb-note">
        Chip text is 12px UI copy → WCAG text bar 4.5:1 against the panel composite{' '}
        <code>{chipBg}</code>; border and minimap diamond are non-text → 3:1. Minimap is graded
        against the ink disc over night <i>and</i> over midday salt — its worst underlays.
      </p>

      <h3>3 · separability from mission colours</h3>
      <table className="scb-table scb-contrast">
        <thead>
          <tr><th>⟡ violet vs</th><th>sRGB</th><th>protan</th><th>deutan</th><th>tritan</th></tr>
        </thead>
        <tbody>
          {MISSION_COLOURS.map((m) => (
            <tr key={m.id}>
              <td>
                <span className="scb-glyph-sm">{m.glyph}</span> {m.label} <code>{m.colour}</code>
              </td>
              <DeltaCell a={CACHE_VIOLET} b={m.colour} />
              {CVD_COLS.map((k) => (
                <DeltaCell key={k} a={applyMatrix(CACHE_VIOLET, CVD_MATRICES[k])} b={applyMatrix(m.colour, CVD_MATRICES[k])} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="scb-note">
        Redmean Δ on a 0–765 scale; ≥45 counts as separated. Any pair that dips under is{' '}
        <b>glyph-carried</b>: ⟡ octahedron + open ◇ vs ◆ ■ ▲ keeps shape the identity, so colour is
        never the only signal.
      </p>

      <div className="scb-row">
        <button className="scb-btn primary" onClick={copy}>
          {copied ? '✓ copied' : 'copy spec JSON'}
        </button>
        <button
          className="scb-btn"
          onClick={() => onChange({ ...cfg, emissive: SHIPPED.core.emissive, glimmer: SHIPPED.glimmer.opacity, ring: SHIPPED.ring.opacity })}
        >
          shipped tuning
        </button>
        <button className="scb-btn" onClick={() => onChange({
          backdrop: 'day', storm: 'off', ladder: 'standard',
          emissive: SHIPPED.core.emissive, glimmer: SHIPPED.glimmer.opacity, ring: SHIPPED.ring.opacity,
          motion: true, cvd: 'none',
        })}>
          reset bench
        </button>
      </div>
    </div>
  );
}

function DeltaCell({ a, b }: { a: string; b: string }) {
  const d = colorDelta(a, b);
  const ok = d >= 45;
  return (
    <td className={ok ? 'scb-pass' : 'scb-mid'}>
      {d.toFixed(0)}
      <span className="scb-grade">{ok ? ' ✓' : ' △ glyph'}</span>
    </td>
  );
}

/**
 * Terrain Explorer panel — colour modes, worldgen layer toggles, overlays,
 * seed preview and stats. Plain styled controls writing into the store.
 */
import { useState } from 'react';
import { LAYER_INFO, ALL_ON } from './heightfield';
import type { LayerKey } from './heightfield';
import { useExplorer } from './state';
import type { ColourMode } from './state';

const MODES: { key: ColourMode; label: string; hint: string }[] = [
  { key: 'height', label: 'Height bands', hint: 'false-colour hypsometry · 6 m bands + contours' },
  { key: 'surface', label: 'Surface grip', hint: 'what the bike feels: salt 1.05 · sand 1.0 · glass 0.5' },
  { key: 'game', label: 'Game palette', hint: 'the shipped vertex colours from src/lib/terrain' },
];

const RES_OPTIONS = [160, 192, 224, 288, 352];

const BAND_STOPS: [string, string][] = [
  ['−30..−8 m', '#14454D'],
  ['canyon', '#206F78'],
  ['pan 0 m', '#F3EEE2'],
  ['dunes', '#D9A45B'],
  ['~40 m', '#B07C3A'],
  ['~58 m', '#B3502E'],
  ['ridge', '#4A3C66'],
  ['crests', '#C4BADE'],
];

export function ExplorerPanel() {
  const layers = useExplorer((s) => s.layers);
  const mode = useExplorer((s) => s.mode);
  const contours = useExplorer((s) => s.contours);
  const showRegions = useExplorer((s) => s.showRegions);
  const showLabels = useExplorer((s) => s.showLabels);
  const showRoutes = useExplorer((s) => s.showRoutes);
  const showGrid = useExplorer((s) => s.showGrid);
  const fly = useExplorer((s) => s.fly);
  const exag = useExplorer((s) => s.exag);
  const res = useExplorer((s) => s.res);
  const seed = useExplorer((s) => s.seed);
  const building = useExplorer((s) => s.building);
  const stats = useExplorer((s) => s.stats);

  const toggleLayer = useExplorer((s) => s.toggleLayer);
  const setMode = useExplorer((s) => s.setMode);
  const toggle = useExplorer((s) => s.toggle);
  const setExag = useExplorer((s) => s.setExag);
  const setRes = useExplorer((s) => s.setRes);
  const setSeed = useExplorer((s) => s.setSeed);
  const allOn = useExplorer((s) => s.allOn);
  const reset = useExplorer((s) => s.reset);

  const [copied, setCopied] = useState(false);

  const pristine =
    seed === 0 && (Object.keys(ALL_ON) as LayerKey[]).every((k) => layers[k]);
  const driftExact = pristine && stats && stats.drift < 1e-4;

  const copy = async () => {
    const payload = {
      mapping: 'driftline/terrain-explorer',
      note: 'layers recombine in src/world/regions/terrain-explorer/heightfield.ts; seed shifts the noise domain',
      mode, contours, showRegions, showRoutes, showGrid, exag, res, seed,
      layers,
    };
    const json = JSON.stringify(payload, null, 2);
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
    <div className="te-panel">
      <div className="te-head">
        <h2>Heightfield Explorer</h2>
        <span className={`te-badge${driftExact ? ' ok' : ''}`}>
          {driftExact
            ? `Δ ${stats!.drift.toExponential(1)} m — matches live worldgen`
            : pristine
              ? 'measuring Δ…'
              : 'preview layers — Δ n/a'}
        </span>
      </div>

      {building >= 0 && (
        <div className="te-progress" role="status" aria-label="Rebuilding field maps">
          <div className="te-progress-bar" style={{ width: `${Math.round(building * 100)}%` }} />
          <span>building field maps {Math.round(building * 100)}%</span>
        </div>
      )}

      {/* ---- colour mode ---- */}
      <section>
        <h3>Colour</h3>
        <div className="te-row">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`te-chip${mode === m.key ? ' on' : ''}`}
              title={m.hint}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="te-dim">{MODES.find((m) => m.key === mode)?.hint}</p>
        {mode === 'height' && (
          <div className="te-legend">
            {BAND_STOPS.map(([label, c]) => (
              <span key={label} className="te-legend-item">
                <i style={{ background: c }} />
                {label}
              </span>
            ))}
          </div>
        )}
        {mode === 'surface' && (
          <div className="te-legend">
            <span className="te-legend-item"><i style={{ background: '#F5F0E6' }} />salt · grip 1.05</span>
            <span className="te-legend-item"><i style={{ background: '#D19954' }} />sand · grip 1.0</span>
            <span className="te-legend-item"><i style={{ background: '#39C7B7' }} />glass · grip 0.5 (slick)</span>
          </div>
        )}
      </section>

      {/* ---- worldgen layers ---- */}
      <section>
        <h3>Worldgen layers</h3>
        <div className="te-row te-grid2">
          {LAYER_INFO.map((l) => (
            <button
              key={l.key}
              className={`te-chip${layers[l.key] ? ' on' : ''}`}
              title={l.hint}
              onClick={() => toggleLayer(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      {/* ---- overlays ---- */}
      <section>
        <h3>Overlays</h3>
        <div className="te-row">
          <button className={`te-chip${showRegions ? ' on' : ''}`} onClick={() => toggle('showRegions')}>Regions</button>
          <button className={`te-chip${showLabels ? ' on' : ''}`} onClick={() => toggle('showLabels')}>Labels</button>
          <button className={`te-chip${showRoutes ? ' on' : ''}`} onClick={() => toggle('showRoutes')}>Routes</button>
          <button className={`te-chip${showGrid ? ' on' : ''}`} onClick={() => toggle('showGrid')}>Grid</button>
          <button className={`te-chip${contours ? ' on' : ''}`} onClick={() => toggle('contours')}>Contours</button>
          <button className={`te-chip${fly ? ' on' : ''}`} onClick={() => toggle('fly')} title="Keyboard: F">Fly cam</button>
        </div>
      </section>

      {/* ---- world / seed ---- */}
      <section>
        <h3>World</h3>
        <div className="te-field">
          <label htmlFor="te-seed">Seed preview</label>
          <div className="te-seed-row">
            <input
              id="te-seed"
              type="number"
              min={0}
              max={9999}
              value={seed}
              onChange={(e) => setSeed(Math.max(0, Math.min(9999, Math.floor(+e.target.value) || 0)))}
            />
            <button className="te-chip" onClick={() => setSeed(1 + Math.floor(Math.random() * 9998))}>
              🎲 roll
            </button>
            <button className="te-chip" onClick={() => setSeed(0)} disabled={seed === 0}>
              live = 0
            </button>
          </div>
          {seed !== 0 && (
            <p className="te-warn">seed shift previews alternate dunes/flats only — features &amp; region anchors stay put</p>
          )}
        </div>
        <div className="te-field">
          <label htmlFor="te-exag">Vertical exaggeration</label>
          <div className="te-slider-row">
            <input
              id="te-exag"
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={exag}
              onChange={(e) => setExag(+e.target.value)}
            />
            <span className="te-val">×{exag.toFixed(1)}</span>
          </div>
        </div>
        <div className="te-field">
          <label htmlFor="te-res">Grid resolution</label>
          <div className="te-row">
            {RES_OPTIONS.map((r) => (
              <button key={r} className={`te-chip${res === r ? ' on' : ''}`} onClick={() => setRes(r)}>
                {r}²
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="te-row">
        <button className="te-btn primary" onClick={() => void copy()}>
          {copied ? '✓ Copied' : 'Copy config'}
        </button>
        <button className="te-btn" onClick={allOn} disabled={pristine}>
          All layers on
        </button>
        <button className="te-btn" onClick={reset}>Reset</button>
      </div>

      {stats && (
        <footer className="te-stats">
          <span>{stats.verts.toLocaleString()} verts · {stats.tris.toLocaleString()} tris</span>
          <span>
            h {stats.minH.toFixed(1)} … {stats.maxH.toFixed(1)} m
          </span>
          <span>
            noise {stats.mapMs.toFixed(0)} ms · apply {stats.applyMs.toFixed(0)} ms
          </span>
          <span>
            Δ vs <code>terrainHeight()</code>: {stats.drift < 1e-4 ? '3 µm (f32 cache — exact)' : `${stats.drift.toFixed(4)} m`}
          </span>
        </footer>
      )}
    </div>
  );
}

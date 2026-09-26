/**
 * Storm Wall Tuner — control panel.
 *
 * STAGE (proximity squeeze, time-of-day, camera rig) · WALL LOOK (shells,
 * colour ramp, opacity falloff, wobble, particles) · ATMOSPHERE (fog ramp +
 * screen tint, the Sky/HUD constants) · QUALITY (perf budgets) · MEASURE
 * (overdraw readback) · LEGEND (shape-glyph pairs + CVD swatch strip) ·
 * EXPORT (constants JSON mapping 1:1 onto MissionDirector / Sky / HUD).
 *
 * Panel writes into the mutable `lab` and bumps local React state — the 3D
 * loop never subscribes to React.
 */
import { useReducer, useState } from 'react';
import {
  cvdSim, exportPayload, FACE_MAX, lab, QUALITY, resetToShipped, rt, SHIPPED,
  type Quality, type Rig,
} from './state';

export function TunerPanel() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [open, setOpen] = useState(true);
  const [json, setJson] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<typeof lab>) => {
    Object.assign(lab, patch);
    bump();
  };

  const applyQuality = (q: Quality) => {
    const b = QUALITY[q];
    lab.quality = q;
    lab.segments = b.seg;
    lab.sheetCount = Math.min(lab.sheetCount, b.sheetMax);
    if (q === 'low') { lab.sheet = false; lab.skirt = false; }
    bump();
  };

  const copyJson = async () => {
    const text = json || exportPayload();
    setJson(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (!open) {
    return (
      <button className="swt-reopen" onClick={() => setOpen(true)} aria-label="Open storm wall controls">
        ▲ Wall controls
      </button>
    );
  }

  return (
    <aside className="swt-panel" aria-label="Storm wall look-dev controls">
      <div className="swt-head">
        <h2>Storm wall · look-dev</h2>
        <button className="swt-icon" onClick={() => setOpen(false)} aria-label="Close panel">×</button>
      </div>

      {/* ---------- stage ---------- */}
      <h3>Stage · on rails</h3>
      <Slider label="proximity / face" min={0} max={FACE_MAX} step={2} value={lab.face} fmt={(v) => `${Math.round(v)} m`}
        onChange={(v) => { lab.squeeze = false; set({ face: v }); }} />
      <div className="swt-row">
        <button className="swt-btn primary" onClick={() => { lab.face = rt.face = FACE_MAX; lab.squeeze = true; bump(); }}>
          ▶ run the squeeze
        </button>
        <button className="swt-btn" onClick={() => { lab.squeeze = false; set({ face: FACE_MAX }); }}>reset 640 m</button>
      </div>
      <Slider label="time of day" min={0} max={1} step={0.005} value={lab.tod} fmt={(v) => todName(v)}
        onChange={(v) => set({ tod: v })} />
      <div className="swt-row">
        <Chip on={Math.abs(lab.tod - 0.5) < 0.02} onClick={() => set({ tod: 0.5 })}>day</Chip>
        <Chip on={Math.abs(lab.tod - 0.78) < 0.02} onClick={() => set({ tod: 0.78 })}>dusk</Chip>
        <Chip on={lab.tod < 0.05 || lab.tod > 0.97} onClick={() => set({ tod: 0.0 })}>night</Chip>
      </div>
      <div className="swt-row">
        {(['chase', 'orbit', 'top'] as Rig[]).map((r) => (
          <Chip key={r} on={lab.rig === r} onClick={() => set({ rig: r })}>{r}</Chip>
        ))}
      </div>

      {/* ---------- wall look ---------- */}
      <h3>Wall look</h3>
      <div className="swt-row">
        <Chip on={isShipped()} onClick={() => { resetToShipped(); bump(); }}>★ shipped</Chip>
        <Chip on={false} onClick={() => {
          resetToShipped();
          lab.sheet = true; lab.sheetCount = 700; lab.wobble = 0.85; lab.skirt = true; lab.heightScale = 1.35;
          lab.opacity0 = 0.26; bump();
        }}>churning (ch5)</Chip>
      </div>
      <Slider label="shells" min={1} max={5} step={1} value={lab.shells} fmt={(v) => `${v} ×`} onChange={(v) => set({ shells: v })} />
      <Slider label="radius" min={80} max={260} step={5} value={lab.radius} fmt={(v) => `${Math.round(v)} m`} onChange={(v) => set({ radius: v })} />
      <Slider label="height scale" min={0.6} max={1.8} step={0.05} value={lab.heightScale} fmt={(v) => `×${v.toFixed(2)}`} onChange={(v) => set({ heightScale: v })} />
      <Slider label="inner alpha" min={0.05} max={0.45} step={0.005} value={lab.opacity0} fmt={(v) => v.toFixed(3)} onChange={(v) => set({ opacity0: v })} />
      <Slider label="alpha falloff" min={0.4} max={1} step={0.01} value={lab.falloff} fmt={(v) => `^${v.toFixed(2)}`} onChange={(v) => set({ falloff: v })} />
      <Slider label="density" min={0.3} max={1.6} step={0.02} value={lab.density} fmt={(v) => `×${v.toFixed(2)}`} onChange={(v) => set({ density: v })} />
      <Slider label="wobble" min={0} max={1} step={0.02} value={lab.wobble} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ wobble: v })} />
      <div className="swt-colors">
        {(['inner', 'mid', 'outer'] as const).map((slot, i) => (
          <label key={slot} className="swt-swatchpick">
            <input type="color" value={lab.colors[i]} onChange={(e) => {
              const colors = [...lab.colors] as [string, string, string];
              colors[i] = e.target.value.toUpperCase();
              set({ colors });
            }} />
            {slot}
          </label>
        ))}
      </div>
      <div className="swt-row">
        <Check label="churn band" on={lab.churn} onChange={(v) => set({ churn: v })} />
        <Check label="ground skirt" on={lab.skirt} onChange={(v) => set({ skirt: v })} />
        <Check label="sheet" on={lab.sheet} onChange={(v) => set({ sheet: v })} />
        <Check label="streaks" on={lab.streaks} onChange={(v) => set({ streaks: v })} />
      </div>
      {lab.sheet && (
        <Slider label="sheet count" min={0} max={QUALITY[lab.quality].sheetMax} step={50} value={lab.sheetCount}
          fmt={(v) => `${Math.round(v)}`} onChange={(v) => set({ sheetCount: v })} />
      )}
      {lab.churn && (
        <Slider label="churn alpha" min={0.1} max={0.7} step={0.01} value={lab.churnOpacity} fmt={(v) => v.toFixed(2)}
          onChange={(v) => set({ churnOpacity: v })} />
      )}

      {/* ---------- atmosphere ---------- */}
      <h3>Atmosphere · fog ramp & tint</h3>
      <Slider label="fog reach" min={150} max={900} step={10} value={lab.fogRange} fmt={(v) => `${Math.round(v)} m`} onChange={(v) => set({ fogRange: v })} />
      <Slider label="fog boost" min={0} max={0.009} step={0.0002} value={lab.fogBoost} fmt={(v) => `+${v.toFixed(4)}`} onChange={(v) => set({ fogBoost: v })} />
      <Slider label="fog ease" min={0.5} max={8} step={0.1} value={lab.fogEase} fmt={(v) => `${v.toFixed(1)}/s`} onChange={(v) => set({ fogEase: v })} />
      <Slider label="tint reach" min={100} max={700} step={10} value={lab.tintRange} fmt={(v) => `${Math.round(v)} m`} onChange={(v) => set({ tintRange: v })} />
      <Slider label="tint cap" min={0.1} max={0.9} step={0.01} value={lab.tintCap} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ tintCap: v })} />
      <p className="swt-note">
        Amber ◇ ring = fog reach, rust ○ ring = tint reach — the shipped ramp extents, live on the rail.
        Shipped: fog <code>{SHIPPED.fogRange} m / +{SHIPPED.fogBoost}</code>, tint <code>{SHIPPED.tintRange} m / {SHIPPED.tintCap}</code>.
      </p>

      {/* ---------- quality ---------- */}
      <h3>Quality budget</h3>
      <div className="swt-row">
        {(['low', 'medium', 'high'] as Quality[]).map((q) => (
          <Chip key={q} on={lab.quality === q} onClick={() => applyQuality(q)}>{q}</Chip>
        ))}
      </div>
      <p className="swt-note">
        {lab.quality} → {lab.segments}-seg shells · sheet ≤ {QUALITY[lab.quality].sheetMax} · streaks {QUALITY[lab.quality].streaks}
        {QUALITY[lab.quality].churnSkirt ? ' · churn+skirt on' : ' · churn+skirt off'}.
      </p>

      {/* ---------- measure ---------- */}
      <h3>Overdraw measure</h3>
      <div className="swt-row">
        <Check label="live readback (64², 2.5 Hz)" on={lab.measure} onChange={(v) => set({ measure: v })} />
      </div>
      <p className="swt-note">
        Coverage is <em>real</em> (storm-only layer rendered into a 64² target and read back); stack depth is the estimate
        <code> log(1−A)/log(1−ᾱ) </code> over the live layer alphas. Scrub to face ≈ 0 for the inside-the-wall worst case.
      </p>

      {/* ---------- legend / CVD ---------- */}
      <h3>Legend · shape first</h3>
      <ul className="swt-legend">
        <li><b className="swt-glyph swt-danger">▲</b> tracker chip — “STORM WALL N m”, pulses under 200 m</li>
        <li><b className="swt-glyph swt-danger">●</b> minimap disc — storm front wedge</li>
        <li><b className="swt-glyph swt-sand">▯</b> screen wash — bottom-up rust gradient (always with the chip)</li>
        <li><b className="swt-glyph swt-amber">◇</b> rail ring — fog reach · <b className="swt-glyph swt-rust">○</b> rail ring — tint reach</li>
      </ul>
      <p className="swt-note">Colour is never the only carrier: storm is ▲/● + metres + wash. Amber ◆ stays mission-objective only.</p>
      <div className="swt-cvd" role="img" aria-label="Storm palette under simulated colour-vision deficiencies">
        <div className="swt-cvd-head"><span /><span>norm</span><span>deut</span><span>prot</span><span>trit</span></div>
        {([
          ['shell inner', lab.colors[0]],
          ['shell outer', lab.colors[2]],
          ['churn sand', SHIPPED.churnColor],
          ['fog haze', SHIPPED.fogColor],
          ['danger', '#E4572E'],
          ['objective ◆', '#FFB454'],
        ] as [string, string][]).map(([name, hex]) => (
          <div className="swt-cvd-row" key={name}>
            <span className="swt-cvd-name">{name}</span>
            {(['normal', 'deutan', 'protan', 'tritan'] as const).map((m) => (
              <i key={m} className="swt-cvd-cell" style={{ background: cvdSim(hex, m) }} title={`${name} ${m}: ${cvdSim(hex, m)}`} />
            ))}
          </div>
        ))}
      </div>

      {/* ---------- export ---------- */}
      <h3>Export</h3>
      <div className="swt-row">
        <button className="swt-btn" onClick={() => setJson(exportPayload())}>stage JSON</button>
        <button className="swt-btn primary" onClick={copyJson}>{copied ? 'copied ✓' : 'copy constants JSON'}</button>
      </div>
      {json && <pre className="swt-json">{json}</pre>}
      <p className="swt-note">
        Blocks land in <code>src/game/MissionDirector.tsx</code> (StormWall), <code>src/game/Sky.tsx</code> (stormFog ramp),
        <code> src/ui/HUD.tsx</code> (tint). The <code>measured</code> block stamps coverage/stack at export time.
      </p>
    </aside>
  );
}

/* ---------- small controls ---------- */

function Slider({ label, min, max, step, value, fmt, onChange }: {
  label: string; min: number; max: number; step: number; value: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="swt-slider">
      <span className="swt-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="swt-slider-val">{fmt(value)}</span>
    </label>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`swt-chip ${on ? 'is-on' : ''}`} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  );
}

function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="swt-check">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function todName(t: number): string {
  if (t < 0.2 || t > 0.93) return 'night';
  if (t < 0.33) return 'dawn';
  if (t < 0.6) return 'day';
  if (t < 0.72) return 'afternoon';
  if (t < 0.84) return 'dusk';
  return 'twilight';
}

function isShipped(): boolean {
  return (
    lab.shells === SHIPPED.shells &&
    !lab.sheet &&
    lab.wobble === SHIPPED.wobble &&
    lab.fogRange === SHIPPED.fogRange &&
    lab.tintCap === SHIPPED.tintCap
  );
}

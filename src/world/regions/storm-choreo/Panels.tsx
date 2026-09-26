/**
 * Panels — the three bench cards:
 *   BenchControls · course / wall / courier / trials sliders + real-run presets
 *   ReadoutCard   · live survival %, difficulty verdict, outcome bar, min-face histogram
 *   ExportCard    · copy mission objective JSON / Director constants with a live preview
 * Everything colour-coded is also shape-coded (HUD rule). Violet-dark panels,
 * amber numeric bubbles, danger-red storm markings, tabular numerals.
 */
import { useEffect, useRef, useState } from 'react';
import {
  PRESETS, SHIPPED, HIST_BINS, HIST_MAX_M,
  exportConstantsJson, exportObjectiveJson,
  type ChoreoParams, type MCResult,
} from './sim';

/* ---------------- shared slider row ---------------- */

function Row({
  label, min, max, step, value, fmt, onChange, hint,
}: {
  label: string;
  min: number; max: number; step: number;
  value: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="sc-row" title={hint}>
      <span className="sc-rowlabel">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        aria-label={label}
      />
      <span className="sc-rowval">{fmt ? fmt(value) : value}</span>
    </label>
  );
}

const ms = (v: number) => `${v.toFixed(1)} m/s`;
const m = (v: number) => `${Math.round(v)} m`;

/* ---------------- controls ---------------- */

export function BenchControls({
  params, onParams,
}: {
  params: ChoreoParams;
  onParams: (p: ChoreoParams) => void;
}) {
  const set = (patch: Partial<ChoreoParams>) => onParams({ ...params, ...patch });
  const runM = Math.round(Math.hypot(params.shelterX, params.shelterZ));
  return (
    <section className="sc-card" aria-label="Choreography controls">
      <h3>Choreography</h3>

      <div className="sc-presets" role="group" aria-label="Real-run presets">
        {PRESETS.map((pr) => (
          <button key={pr.name} className="sc-preset" title={pr.note} onClick={() => set(pr.set)}>
            {pr.name}
          </button>
        ))}
      </div>

      <h4>Course <span className="sc-dim">— drag ◆ / ○ on the pan too</span></h4>
      <Row label="shelter east" min={-1400} max={1400} step={10} value={params.shelterX} fmt={(v) => `${Math.round(v)} m`} onChange={(v) => set({ shelterX: v })} />
      <Row label="shelter south" min={-1400} max={1400} step={10} value={params.shelterZ} fmt={(v) => `${Math.round(v)} m`} onChange={(v) => set({ shelterZ: v })} />
      <div className="sc-metricline"><span>run length</span><b>{runM} m</b></div>

      <h4>Storm wall</h4>
      <Row label="base speed" min={10} max={40} step={0.5} value={params.stormSpeed} fmt={ms} onChange={(v) => set({ stormSpeed: v })} hint={`shipped: ${SHIPPED.stormSpeed} m/s`} />
      <Row label="rubber-band" min={0} max={0.08} step={0.0025} value={params.rubberGain} fmt={(v) => v.toFixed(4)} onChange={(v) => set({ rubberGain: v })} hint={`gain on face beyond 150 m — shipped: ${SHIPPED.rubberGain}`} />
      <Row label="catch cap" min={0} max={20} step={0.5} value={params.catchCap} fmt={ms} onChange={(v) => set({ catchCap: v })} hint={`shipped: ${SHIPPED.catchCap} m/s`} />
      <Row label="wall radius" min={80} max={260} step={5} value={params.radius} fmt={m} onChange={(v) => set({ radius: v })} hint={`STORM_R — shipped: ${SHIPPED.radius} m`} />
      <Row label="spawn back" min={120} max={780} step={10} value={params.spawnBack} fmt={m} onChange={(v) => set({ spawnBack: v })} hint={`shipped: ${SHIPPED.spawnBack} m`} />

      <h4>Courier stand-in</h4>
      <Row label="top speed" min={22} max={46} step={0.5} value={params.bikeTop} fmt={ms} onChange={(v) => set({ bikeTop: v })} />
      <Row label="acceleration" min={5} max={14} step={0.5} value={params.accel} fmt={(v) => `${v.toFixed(1)} m/s²`} onChange={(v) => set({ accel: v })} />
      <Row label="human noise" min={0} max={1} step={0.05} value={params.noise} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ noise: v })} hint="reaction delay, steering wobble, throttle discipline" />
      <Row label="boost kick" min={1} max={1.6} step={0.05} value={params.boostKick} fmt={(v) => `×${v.toFixed(2)}`} onChange={(v) => set({ boostKick: v })} />
      <Row label="boost reserve" min={0} max={5} step={0.2} value={params.boostTime} fmt={(v) => `${v.toFixed(1)} s`} onChange={(v) => set({ boostTime: v })} />

      <h4>Trials</h4>
      <Row
        label="batch size" min={6} max={11} step={1}
        value={Math.round(Math.log2(params.trials))}
        fmt={() => `n=${params.trials}`}
        onChange={(v) => set({ trials: 2 ** v })}
      />
      <div className="sc-metricline">
        <span>noise deck · seed {params.seed}</span>
        <button className="sc-mini" onClick={() => set({ seed: (params.seed * 48271 + 7) % 2147483647 })}>
          re-roll ⟳
        </button>
      </div>
    </section>
  );
}

/* ---------------- readout ---------------- */

function Histogram({ mc }: { mc: MCResult }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 312, H = 96;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(1, ...Array.from(mc.hist));
    const bw = W / HIST_BINS;
    for (let i = 0; i < HIST_BINS; i++) {
      const v = mc.hist[i] / max;
      const x = i * bw;
      const faceM = ((i + 0.5) / HIST_BINS) * HIST_MAX_M;
      ctx.fillStyle = faceM < 60 ? '#E4572E' : faceM < 160 ? '#FFB454' : '#57C4B8';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + 1, H - 18 - v * (H - 30), bw - 2, Math.max(1, v * (H - 30)));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(228,215,190,0.55)';
    ctx.font = '600 8px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('0 m', 2, H - 6);
    ctx.textAlign = 'center';
    ctx.fillText(`${HIST_MAX_M / 2} m`, W / 2, H - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`${HIST_MAX_M} m`, W - 2, H - 6);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(228,215,190,0.45)';
    ctx.fillText('closest skim — survivors only', 2, 10);
  }, [mc]);
  return <canvas ref={ref} className="sc-hist" aria-hidden="true" />;
}

export function ReadoutCard({ mc, busy }: { mc: MCResult | null; busy: boolean }) {
  if (!mc) {
    return (
      <section className="sc-card sc-readout" aria-label="Difficulty readout" aria-live="polite">
        <h3>Difficulty readout</h3>
        <p className="sc-dim">dealing the deck…</p>
      </section>
    );
  }
  const v = mc.verdict;
  const pct = (n: number) => `${Math.round((n / mc.trials) * 100)}%`;
  return (
    <section className="sc-card sc-readout" aria-label="Difficulty readout" aria-live="polite">
      <h3>Difficulty readout {busy && <span className="sc-busy">…re-running</span>}</h3>

      <div className="sc-score">
        <div className="sc-big" data-cls={v.cls}>
          {Math.round(mc.survival * 100)}
          <span className="sc-pct">%</span>
        </div>
        <div className="sc-verdict" data-cls={v.cls}>
          <span className="sc-glyph" aria-hidden="true">{v.glyph}</span>
          <div>
            <b>{v.label}</b>
            <p>{v.note}</p>
          </div>
        </div>
      </div>

      <div className="sc-outbar" role="img"
        aria-label={`Outcomes: ${pct(mc.sheltered)} sheltered, ${pct(mc.caught)} swallowed, ${pct(mc.timeouts)} timed out`}>
        <span style={{ width: `${(mc.sheltered / mc.trials) * 100}%` }} className="is-safe" />
        <span style={{ width: `${(mc.caught / mc.trials) * 100}%` }} className="is-dead" />
        <span style={{ width: `${(mc.timeouts / mc.trials) * 100}%` }} className="is-lost" />
      </div>
      <p className="sc-legend">
        <span><i className="is-safe">■</i> sheltered {pct(mc.sheltered)}</span>
        <span><i className="is-dead">▲</i> swallowed {pct(mc.caught)}</span>
        <span><i className="is-lost">○</i> timed out {pct(mc.timeouts)}</span>
      </p>

      <div className="sc-stats">
        <div><span>median clear</span><b>{mc.medTime > 0 ? `${mc.medTime.toFixed(1)} s` : '—'}</b></div>
        <div><span>face p10–p90</span><b>{`${Math.round(mc.p10Face)}…${Math.round(mc.p90Face)} m`}</b></div>
        <div><span>batch</span><b> n={mc.trials} · {mc.ms.toFixed(0)} ms</b></div>
      </div>

      <Histogram mc={mc} />
    </section>
  );
}

/* ---------------- export ---------------- */

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function ExportCard({ params, mc }: { params: ChoreoParams; mc: MCResult | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const preview = JSON.stringify(exportObjectiveJson(params, mc), null, 2);
  const flash = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };
  return (
    <section className="sc-card" aria-label="Export tuned choreography">
      <h3>Export</h3>
      <div className="sc-copyrow">
        <button
          className="sc-mini"
          onClick={async () => (await copyText(JSON.stringify(exportObjectiveJson(params, mc), null, 2))) && flash('obj')}
        >
          {copied === 'obj' ? 'copied ✓' : 'copy objective JSON'}
        </button>
        <button
          className="sc-mini"
          onClick={async () => (await copyText(JSON.stringify(exportConstantsJson(params), null, 2))) && flash('dir')}
        >
          {copied === 'dir' ? 'copied ✓' : 'copy Director constants'}
        </button>
      </div>
      <pre className="sc-pre" tabIndex={0} aria-label="Mission objective JSON preview">{preview}</pre>
    </section>
  );
}

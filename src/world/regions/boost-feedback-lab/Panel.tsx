/**
 * Boost Feedback Lab — control panel. Every candidate is a chip beside the
 * shipped treatment; the chart plots the scripted tape run for all four side
 * by side (shipped dashed, selection solid amber, the rest ghosted) so curves
 * can be compared without guessing from feel alone. "Run the tape" drives the
 * scene with the same scripted run; "strobe" alternates shipped ↔ candidates
 * every 2.2 s through it, so the whole treatment can be A/B'd hands-free.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  lab, stats, setTape, exportPayload, evaluateTape,
  FOV_CANDIDATES, SHAKE_CANDIDATES, PITCH_CANDIDATES, BAR_STYLES,
  findFov, findShake, findPitch, findBar,
  TAPE_S, TAPE_BOOST, KMH,
  type CandidateDef, type FeelState,
} from './sim';
import { synth } from './synth';

type ChannelKey = 'fov' | 'shake' | 'pitch' | 'bar';

const CHANNELS: { key: ChannelKey; title: string; defs: CandidateDef[] }[] = [
  { key: 'fov', title: 'Camera FOV curve', defs: FOV_CANDIDATES },
  { key: 'shake', title: 'Boost shake', defs: SHAKE_CANDIDATES },
  { key: 'pitch', title: 'Engine pitch', defs: PITCH_CANDIDATES },
  { key: 'bar', title: 'Boost-bar drain', defs: BAR_STYLES },
];

/* ---------------------------------------------------------- chart */

const W = 344;
const H = 108;
const ML = 10;
const MR = 8;
const MT = 8;
const MB = 14;

function chartValue(key: ChannelKey, id: string, smp: FeelState): number {
  if (key === 'fov') return findFov(id).f(smp, lab.punchSize);
  if (key === 'pitch') return findPitch(id).f(smp);
  return findShake(id).f(smp) * lab.shakeAmp;
}

function Chart({ channel }: { channel: 'fov' | 'shake' | 'pitch' }) {
  const defs = channel === 'fov' ? FOV_CANDIDATES : channel === 'pitch' ? PITCH_CANDIDATES : SHAKE_CANDIDATES;
  const selected = (channel === 'shake' ? lab.shake : channel === 'pitch' ? lab.pitch : lab.fov);
  const tape = evaluateTape();

  const { series, min, max } = useMemo(() => {
    const all = defs.map((d) => tape.map((smp) => chartValue(channel, d.id, smp)));
    let mn = Infinity;
    let mx = -Infinity;
    for (const arr of all) {
      for (const v of arr) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (mx - mn < 0.01) { mx = mn + 1; }
    return { series: all, min: mn, max: mx };
    // lab.punchSize / lab.shakeAmp are read inside chartValue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, defs, tape, lab.punchSize, lab.shakeAmp]);

  const pad = (max - min) * 0.08;
  const x = (t: number) => ML + (t / TAPE_S) * (W - ML - MR);
  const y = (v: number) => MT + (1 - (v - min + pad) / (max - min + pad * 2)) * (H - MT - MB);

  const path = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(tape[i].t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const selIdx = defs.findIndex((d) => d.id === selected);
  const shipIdx = defs.findIndex((d) => d.shipped);
  const peakSel = Math.max(...series[selIdx]);
  const peakShip = Math.max(...series[shipIdx]);
  const delta = peakSel - peakShip;

  return (
    <div className="bfl-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${channel} curves over the scripted tape`}>
        {/* boost window */}
        <rect
          x={x(TAPE_BOOST[0])} y={MT}
          width={x(TAPE_BOOST[1]) - x(TAPE_BOOST[0])} height={H - MT - MB}
          className="bfl-chart-window"
        />
        {/* meter drain, teal, normalized */}
        <polyline
          className="bfl-chart-meter"
          points={tape.map((s) => `${x(s.t).toFixed(1)},${(MT + (1 - s.meter) * (H - MT - MB)).toFixed(1)}`).join(' ')}
        />
        {/* ghosts then shipped then selected */}
        {defs.map((d, i) =>
          d.shipped || d.id === selected ? null : (
            <path key={d.id} d={path(series[i])} className="bfl-chart-ghost" />
          ),
        )}
        <path d={path(series[shipIdx])} className="bfl-chart-shipped" />
        {!defs[selIdx].shipped && (
          <path d={path(series[selIdx])} className="bfl-chart-selected" />
        )}
        {/* x ticks */}
        {[2, 4, 6, 8].map((t) => (
          <text key={t} x={x(t)} y={H - 3} className="bfl-chart-tick">{t}s</text>
        ))}
        <text x={ML} y={MT + 8} className="bfl-chart-max">{max.toFixed(0)}</text>
        <text x={ML} y={H - MB - 2} className="bfl-chart-max">{min.toFixed(0)}</text>
      </svg>
      <div className="bfl-chart-legend">
        <span className="bfl-lg shipped">— shipped</span>
        <span className="bfl-lg candidate">— {defs[selIdx].label}</span>
        <span className="bfl-lg meter">— meter</span>
        <span className={`bfl-chart-delta ${delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : ''}`}>
          peak {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- panel */

export function LabPanel() {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [chartCh, setChartCh] = useState<'fov' | 'shake' | 'pitch'>('fov');
  const bump = () => setTick((n) => n + 1);
  void tick;

  const [live, setLive] = useState({ v: 0, meter: 1, hold: 0, fps: 0, tape: false });
  useEffect(() => {
    const iv = window.setInterval(
      () => setLive({ v: stats.v, meter: stats.meter, hold: stats.boostTimer, fps: stats.fps, tape: lab.tape }),
      160,
    );
    return () => window.clearInterval(iv);
  }, []);

  if (!open) {
    return (
      <button className="bfl-reopen" onClick={() => setOpen(true)}>
        ⚡ feedback bench
      </button>
    );
  }

  const pick = (key: ChannelKey, id: string) => {
    lab[key] = id;
    synth.tick(880, 0.05, 0.03);
    bump();
  };

  return (
    <div className="bfl-panel panel">
      <div className="bfl-head">
        <h2>Boost feedback</h2>
        <button className="bfl-icon" onClick={() => setOpen(false)} aria-label="collapse panel">—</button>
      </div>

      <div className="bfl-stats">
        <span><b>{Math.round(live.v * KMH)}</b> km/h</span>
        <span>meter <b>{Math.round(live.meter * 100)}%</b></span>
        <span>hold <b>{live.hold.toFixed(1)}s</b></span>
        <span><b>{live.fps}</b> fps</span>
      </div>

      {CHANNELS.map(({ key, title, defs }) => {
        const sel = (lab[key] as string) ?? '';
        const cur = defs.find((d) => d.id === sel) ?? defs[0];
        return (
          <section key={key}>
            <h3>{title}</h3>
            <div className="bfl-row">
              {defs.map((d) => (
                <button
                  key={d.id}
                  className={`bfl-chip ${sel === d.id ? 'active' : ''} ${d.shipped ? 'shipped' : ''}`}
                  onClick={() => pick(key, d.id)}
                  title={d.shipped ? 'what the game ships today' : 'candidate'}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="bfl-note">
              {cur.note} <code>{cur.formula}</code>
            </p>
            {key === 'fov' && (
              <label className="bfl-slider">
                <span className="bfl-slider-label">punch size</span>
                <input
                  type="range" min={3} max={14} step={0.5} value={lab.punchSize}
                  onChange={(e) => { lab.punchSize = parseFloat(e.target.value); bump(); }}
                />
                <span className="bfl-slider-val">{lab.punchSize.toFixed(1)}°</span>
              </label>
            )}
            {key === 'shake' && (
              <label className="bfl-slider">
                <span className="bfl-slider-label">amplitude</span>
                <input
                  type="range" min={0.3} max={2.2} step={0.05} value={lab.shakeAmp}
                  onChange={(e) => { lab.shakeAmp = parseFloat(e.target.value); bump(); }}
                />
                <span className="bfl-slider-val">×{lab.shakeAmp.toFixed(2)}</span>
              </label>
            )}
          </section>
        );
      })}

      <h3>Tape — fair A/B</h3>
      <div className="bfl-chart-tabs">
        {(['fov', 'shake', 'pitch'] as const).map((c) => (
          <button key={c} className={`bfl-chip small ${chartCh === c ? 'active' : ''}`} onClick={() => setChartCh(c)}>
            {c === 'fov' ? 'FOV' : c === 'shake' ? 'shake' : 'pitch'}
          </button>
        ))}
      </div>
      <Chart channel={chartCh} />

      <div className="bfl-row">
        <button
          className={`bfl-btn ${live.tape ? 'primary' : ''}`}
          onClick={() => { setTape(!lab.tape); bump(); }}
        >
          {live.tape ? '■ stop tape (T)' : '▶ run the tape (T)'}
        </button>
        <label className="bfl-check">
          <input
            type="checkbox" checked={lab.strobe}
            onChange={(e) => { lab.strobe = e.target.checked; if (e.target.checked && !lab.tape) setTape(true); bump(); }}
          />
          strobe shipped ↔ candidate <em>2.2 s</em>
        </label>
      </div>

      <h3>Session</h3>
      <div className="bfl-row">
        <label className="bfl-check">
          <input
            type="checkbox" checked={lab.reducedShake}
            onChange={(e) => { lab.reducedShake = e.target.checked; bump(); }}
          />
          reduced shake <em>accessibility</em>
        </label>
        <label className="bfl-check">
          <input
            type="checkbox" checked={lab.muted}
            onChange={(e) => { lab.muted = e.target.checked; synth.setMuted(e.target.checked); bump(); }}
          />
          mute <em>M</em>
        </label>
        <button
          className="bfl-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(JSON.stringify(exportPayload(), null, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? '✓ copied' : '⧉ copy preset JSON'}
        </button>
      </div>

      <p className="bfl-note dim-note">
        Shipped = <code>CameraRig.tsx · audio.ts · HUD.tsx</code> as of today. The strip is a
        feel model, not the physics build: stock constants, asymptotic speed approach.
      </p>
    </div>
  );
}

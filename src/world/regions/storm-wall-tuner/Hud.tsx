/**
 * Storm Wall Tuner — HUD overlay.
 *
 * Reproduces the shipped chrome 1:1 so look-dev happens against the real
 * composite: the `.hud-storm-tint` gradient (ui.css) with the shipped
 * opacity ramp, and the ▲ STORM WALL warning chip (same wording, urgency
 * threshold at 200 m). Plus the bench's own instruments: perf + overdraw.
 * DOM updates are polled at ~10 Hz from `rt` — no per-frame React churn.
 */
import { useEffect, useState } from 'react';
import { lab, rt, FACE_MAX } from './state';

interface Snapshot {
  face: number;
  tint: number;
  engulfed: boolean;
  squeeze: boolean;
  fogMix: number;
  fps: number;
  calls: number;
  tris: number;
  coverage: number;
  stackEst: number;
  avgAlpha: number;
  rig: string;
  quality: string;
  tod: number;
}

export function TunerHud() {
  const [s, setS] = useState<Snapshot>(() => snap());
  useEffect(() => {
    const id = window.setInterval(() => setS(snap()), 110);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="swt-hud" aria-hidden={false}>
      {/* shipped screen tint (exact ui.css gradient, shipped opacity ramp) */}
      <div className="swt-tint" style={{ opacity: s.tint }} />

      {/* shipped warning chip: amber triangle wordmark, urgent under 200 m */}
      <div className="swt-chiprow">
        <span className={`hud-storm swt-chip ${s.face < 200 ? 'urgent' : ''}`}>
          {s.engulfed ? '▲ INSIDE THE WALL' : `▲ STORM WALL ${Math.max(0, Math.round(s.face))} m`}
        </span>
        {s.squeeze && <span className="swt-squeeze">SQUEEZE RUNNING</span>}
      </div>

      {/* bench instruments */}
      <div className="swt-instr panel">
        <div className="swt-instr-row">
          <span>fps <b>{Math.round(s.fps)}</b></span>
          <span>draws <b>{s.calls}</b></span>
          <span>tris <b>{(s.tris / 1000).toFixed(1)}k</b></span>
        </div>
        <div className="swt-instr-row">
          <span title="screen pixels the storm paints (64² readback)">wall coverage <b>{(s.coverage * 100).toFixed(1)}%</b></span>
          <span title="estimated translucent stack depth over covered pixels">stack ≈ <b className={s.stackEst > 5 ? 'swt-warn' : ''}>{s.stackEst.toFixed(1)}×</b></span>
        </div>
        <div className="swt-overbar" title="overdraw cost = coverage × stack">
          <i style={{ width: `${Math.min(100, s.coverage * Math.min(s.stackEst, 8) * 12.5)}%` }} />
        </div>
        <div className="swt-instr-meta">
          {s.quality} · {s.rig} cam · fog {Math.round(s.fogMix * 100)}% · tod {s.tod.toFixed(2)}
        </div>
      </div>

      {/* face tape: the rail, compressed */}
      <div className="swt-tape">
        <i className="swt-tape-dot" style={{ left: `${(s.face / FACE_MAX) * 100}%` }} />
      </div>
    </div>
  );
}

function snap(): Snapshot {
  return {
    face: rt.face,
    tint: rt.tint,
    engulfed: rt.engulfed,
    squeeze: lab.squeeze,
    fogMix: rt.fogMix,
    fps: rt.fps,
    calls: rt.calls,
    tris: rt.tris,
    coverage: rt.coverage,
    stackEst: rt.stackEst,
    avgAlpha: rt.avgLayerAlpha,
    rig: lab.rig,
    quality: lab.quality,
    tod: lab.tod,
  };
}

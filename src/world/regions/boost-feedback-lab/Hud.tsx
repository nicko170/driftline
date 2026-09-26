/**
 * Lab HUD: real-speed readouts plus the four boost-bar *prototype* treatments.
 * The shipped bar reuses the game's own global HUD classes (ui.css) so it is
 * pixel-faithful; the candidates are new. Polls the module stats at ~11 Hz —
 * same throttled pattern the game HUD uses so nothing re-renders per frame.
 */
import { useEffect, useRef, useState } from 'react';
import {
  lab, stats, activeIds, findFov, findShake, findPitch, findBar,
  KMH, TAPE_S, TAPE_BOOST, strobeOnShipped,
} from './sim';
import { synth } from './synth';

interface Snap {
  v: number;
  meter: number;
  boosting: boolean;
  boostTimer: number;
  fov: number;
  pitch: number;
  amp: number;
  fps: number;
  tape: boolean;
  tapeT: number;
  strobeShipped: boolean;
  ids: { fov: string; shake: string; pitch: string; bar: string };
}

function useSnap(): Snap {
  const read = (): Snap => ({
    v: stats.v,
    meter: stats.meter,
    boosting: stats.boosting,
    boostTimer: stats.boostTimer,
    fov: stats.fov,
    pitch: stats.pitch,
    amp: stats.amp,
    fps: stats.fps,
    tape: lab.tape,
    tapeT: lab.tapeT,
    strobeShipped: strobeOnShipped(lab),
    ids: activeIds(lab),
  });
  const [snap, setSnap] = useState<Snap>(read);
  useEffect(() => {
    const iv = window.setInterval(() => setSnap(read()), 90);
    return () => window.clearInterval(iv);
  }, []);
  return snap;
}

/* --------------------------------------------------- bar prototypes */

function BarShipped({ meter, boosting }: { meter: number; boosting: boolean }) {
  return (
    <div className={`hud-boostbar ${boosting ? 'boosting' : ''}`}>
      <div className="hud-boostbar-fill" style={{ width: `${meter * 100}%` }} />
    </div>
  );
}

const CELL_COUNT = 8;

function BarCells({ meter, boosting }: { meter: number; boosting: boolean }) {
  const lit = Math.max(0, Math.min(CELL_COUNT, Math.ceil(meter * CELL_COUNT)));
  const prevLit = useRef(lit);
  useEffect(() => {
    if (lit < prevLit.current) synth.tick(1250 + lit * 90);
    prevLit.current = lit;
  }, [lit]);
  return (
    <div className={`bfl-cells ${boosting ? 'boosting' : ''}`} role="img" aria-label={`boost ${Math.round(meter * 100)}%`}>
      {Array.from({ length: CELL_COUNT }, (_, i) => (
        <i key={i} className={i < lit ? 'lit' : ''} />
      ))}
    </div>
  );
}

function BarRing({ meter }: { meter: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const arc = 0.75; // 270° of the circle
  return (
    <svg className="bfl-ring-svg" viewBox="0 0 76 76" aria-hidden>
      <circle
        cx="38" cy="38" r={R} fill="none"
        className="bfl-ring-track"
        strokeDasharray={`${arc * C} ${C}`}
        transform="rotate(135 38 38)"
      />
      <circle
        cx="38" cy="38" r={R} fill="none"
        className="bfl-ring-fill"
        strokeDasharray={`${meter * arc * C} ${C}`}
        transform="rotate(135 38 38)"
      />
    </svg>
  );
}

function BarTach({ meter, boosting }: { meter: number; boosting: boolean }) {
  // needle sweeps −160°..−20° (left = empty, right = full)
  const angle = -160 + meter * 140;
  const rad = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(rad) * 38;
  const y = 52 + Math.sin(rad) * 38;
  return (
    <svg className="bfl-tach-svg" viewBox="0 0 100 66" aria-hidden>
      <path d="M 12 52 A 38 38 0 0 1 88 52" className="bfl-tach-track" fill="none" />
      <path d="M 76 22.7 A 38 38 0 0 1 88 52" className="bfl-tach-redline" fill="none" />
      {[0, 0.25, 0.5, 0.75, 1].map((m) => {
        const a = ((-160 + m * 140) * Math.PI) / 180;
        return (
          <line
            key={m}
            x1={50 + Math.cos(a) * 33} y1={52 + Math.sin(a) * 33}
            x2={50 + Math.cos(a) * 38} y2={52 + Math.sin(a) * 38}
            className="bfl-tach-tick"
          />
        );
      })}
      <line x1="50" y1="52" x2={x} y2={y} className={`bfl-tach-needle ${boosting ? 'boosting' : ''}`} />
      <circle cx="50" cy="52" r="3.4" className="bfl-tach-hub" />
    </svg>
  );
}

/* --------------------------------------------------------------- HUD */

export function LabHud() {
  const s = useSnap();
  const kmh = Math.round(s.v * KMH);
  const bar = s.ids.bar;
  return (
    <>
      {/* tape progress strip */}
      {s.tape && (
        <div className="bfl-tape strip" role="status" aria-label="scripted tape running">
          <span className="bfl-tape-label">TAPE</span>
          <div className="bfl-tape-track">
            <div
              className="bfl-tape-window"
              style={{
                left: `${(TAPE_BOOST[0] / TAPE_S) * 100}%`,
                width: `${((TAPE_BOOST[1] - TAPE_BOOST[0]) / TAPE_S) * 100}%`,
              }}
            />
            <div className="bfl-tape-fill" style={{ width: `${(s.tapeT / TAPE_S) * 100}%` }} />
          </div>
          <span className="bfl-tape-time">{s.tapeT.toFixed(1)}s</span>
          {lab.strobe && (
            <span className={`bfl-strobe ${s.strobeShipped ? 'shipped' : ''}`}>
              {s.strobeShipped ? 'SHIPPED' : 'CANDIDATE'}
            </span>
          )}
        </div>
      )}

      {/* active treatment readout */}
      <div className="bfl-treatment">
        <span>cam <b>{findFov(s.ids.fov).label}</b></span>
        <span>shake <b>{findShake(s.ids.shake).label}</b></span>
        <span>pitch <b>{findPitch(s.ids.pitch).label}</b></span>
        <span>bar <b>{findBar(bar).label}</b></span>
      </div>

      {/* speed cluster + selected boost bar */}
      <div className={`bfl-speed ${bar === 'ring' ? 'with-ring' : ''}`}>
        {bar === 'ring' && <BarRing meter={s.meter} />}
        <div className="bfl-speed-main">
          <div className="bfl-speed-value">
            {kmh}
            <span className="bfl-speed-unit">km/h</span>
          </div>
          {bar === 'bar' && <BarShipped meter={s.meter} boosting={s.boosting} />}
          {bar === 'cells' && <BarCells meter={s.meter} boosting={s.boosting} />}
          {bar === 'tach' && <BarTach meter={s.meter} boosting={s.boosting} />}
          {bar === 'ring' && <div className="bfl-ring-caption">tap <b>{Math.round(s.meter * 100)}%</b> left</div>}
          <div className="bfl-speed-hint">
            {s.boosting ? `BOOST · hold ${s.boostTimer.toFixed(1)}s` : s.tape ? 'tape is driving' : 'hold Shift / the button to boost'}
          </div>
        </div>
      </div>

      {/* hold-to-boost button (touch + mouse) */}
      <button
        type="button"
        className={`bfl-boostbtn ${s.boosting ? 'boosting' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault();
          if (!lab.tape) lab.wantBoost = true;
        }}
        onPointerUp={() => { lab.wantBoost = false; }}
        onPointerLeave={() => { lab.wantBoost = false; }}
        onPointerCancel={() => { lab.wantBoost = false; }}
        aria-pressed={s.boosting}
      >
        {s.tape ? 'TAPE DRIVING' : 'HOLD TO BOOST'}
      </button>
    </>
  );
}

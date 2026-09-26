/**
 * HUD overlays for the bench: status chips (ground/air, painted surface with
 * its live grip multiplier, drift state), a drift-reward flash chip, the
 * speed/boost cluster, and the telemetry scope strip with a shape+colour
 * legend (colour-blind-safe: every trace keeps its glyph, colour is a bonus).
 */
import { useEffect, useState } from 'react';
import { tele } from './telemetry';
import { useTuning, type SurfaceKind } from './params';
import Scope from './Scope';

const SURF_GLYPH: Record<SurfaceKind, string> = { salt: '■', sand: '▲', glass: '◆' };

interface Snap {
  speed: number;
  boost: number;
  boosting: boolean;
  grounded: boolean;
  drifting: boolean;
  driftTime: number;
  slipDeg: number;
  surface: SurfaceKind;
  rewardLive: number;
  lastReward: number;
  lastKick: number;
  rewardAge: number;
}

function snapshot(): Snap {
  return {
    speed: tele.speed,
    boost: tele.boost,
    boosting: tele.boosting,
    grounded: tele.grounded,
    drifting: tele.drifting,
    driftTime: tele.driftTime,
    slipDeg: tele.slipDeg,
    surface: tele.surface,
    rewardLive: tele.rewardLive,
    lastReward: tele.lastReward,
    lastKick: tele.lastKick,
    rewardAge: performance.now() / 1000 - tele.rewardStamp,
  };
}

export function StatusChips() {
  const [s, setS] = useState<Snap>(snapshot);
  const gripSalt = useTuning((p) => p.params.gripSalt);
  const gripSand = useTuning((p) => p.params.gripSand);
  const gripGlass = useTuning((p) => p.params.gripGlass);

  useEffect(() => {
    const id = window.setInterval(() => setS(snapshot()), 100);
    return () => window.clearInterval(id);
  }, []);

  const grip = s.grounded
    ? (s.surface === 'salt' ? gripSalt : s.surface === 'sand' ? gripSand : gripGlass)
    : null;

  return (
    <div className="hcl-status" aria-hidden>
      <span className={`hcl-state ${s.grounded ? 'ground' : 'air'}`}>{s.grounded ? 'GROUND' : 'AIR'}</span>
      <span className={`hcl-state surf-${s.surface}`}>
        {SURF_GLYPH[s.surface]} {s.surface.toUpperCase()}
        {grip != null && <em> ×{grip.toFixed(2)}</em>}
      </span>
      {s.drifting && (
        <span className="hcl-state drift">
          DRIFT {s.driftTime.toFixed(1)}s · {Math.round(s.slipDeg)}° · ◉ {Math.round(s.rewardLive * 100)}%
        </span>
      )}
      {!s.drifting && s.rewardAge < 1.8 && s.lastReward > 0 && (
        <span className="hcl-state rewarded">
          ◉ +{Math.round(s.lastReward * 100)}% boost · kick +{s.lastKick.toFixed(1)} m/s
        </span>
      )}
    </div>
  );
}

export function SpeedHud() {
  const [s, setS] = useState<Snap>(snapshot);
  useEffect(() => {
    const id = window.setInterval(() => setS(snapshot()), 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hcl-stats">
      <div className="hcl-speed">
        <span className="hcl-speed-value">{Math.round(s.speed * 3.6)}</span>
        <span className="hcl-speed-unit">km/h</span>
      </div>
      <div className={`hcl-boostbar ${s.boosting ? 'boosting' : ''}`}>
        <div className="hcl-boostbar-fill" style={{ width: `${Math.round(s.boost * 100)}%` }} />
      </div>
    </div>
  );
}

export function ScopeStrip() {
  return (
    <div className="hcl-scope-wrap panel" aria-label="Telemetry: speed, slip, drift reward window, boost">
      <div className="hcl-scope">
        <Scope />
      </div>
      <div className="hcl-scope-legend dim">
        <span className="lg-speed">▬ speed</span>
        <span className="lg-slip">≋ slip</span>
        <span className="lg-window">▲ drift window</span>
        <span className="lg-boost">▮ boost</span>
        <span className="lg-lane">▔ ground: ■ salt · ▲ sand · ◆ glass</span>
      </div>
    </div>
  );
}

export function HintBar() {
  return (
    <p className="hcl-hint dim">
      <kbd>W A S D</kbd> drive · <kbd>Shift</kbd> boost · <kbd>Space</kbd> hop ·
      <kbd>S</kbd>+steer drift · <kbd>R</kbd> respawn
    </p>
  );
}

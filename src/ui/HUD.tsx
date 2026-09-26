/**
 * HUD — reads mut telemetry at ~10Hz into local state. Speed, boost, compass,
 * minimap, mission tracker, waypoint marker, interact prompt, radio ticker,
 * cargo integrity, escort/storm/scout meters and the fail/retry banner.
 */
import { useEffect, useRef, useState } from 'react';
import { telemetry } from '../telemetry';
import { useGameStore, useSaveStore } from '../state/store';
import { missionsById } from '../missions/library';
import { REGIONS } from '../world/registry';
import { WORLD_HALF } from '../world/layout';
import { pickLine, character, characters } from '../dialogue/library';
import { audio } from '../audio/audio';

const COMPASS_POINTS: [number, string][] = [
  [0, 'N'],
  [Math.PI / 2, 'E'],
  [Math.PI, 'S'],
  [-Math.PI / 2, 'W'],
];

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Everyone with radio lines can chime in, weighted by who's alive in content. */
function radioCast(): string[] {
  const out: string[] = [];
  for (const c of characters.values()) if (c.lines.radio?.length) out.push(c.id);
  return out.length ? out : ['ketch'];
}

export default function HUD() {
  const [, force] = useState(0);
  const minimap = useRef<HTMLCanvasElement>(null);
  const credits = useSaveStore((s) => s.credits);
  const debt = useSaveStore((s) => s.debt);
  const activeMissionId = useGameStore((s) => s.activeMissionId);
  const objectiveIndex = useGameStore((s) => s.objectiveIndex);
  const objectiveCount = useGameStore((s) => s.objectiveCount);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const missionFailed = useGameStore((s) => s.missionFailed);
  const cargoIntegrity = useGameStore((s) => s.cargoIntegrity);
  const radioLine = useGameStore((s) => s.radioLine);
  const mode = useGameStore((s) => s.mode);

  // throttle telemetry → react at 10Hz
  useEffect(() => {
    const id = window.setInterval(() => {
      force((n) => n + 1);
      drawMinimap(minimap.current);
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // ambient radio chatter while riding (subtitles are always on)
  useEffect(() => {
    if (mode !== 'riding') return;
    const cast = radioCast();
    const id = window.setInterval(() => {
      const g = useGameStore.getState();
      if (g.mode !== 'riding' || g.radioLine || Math.random() > 0.3) return;
      const who = cast[Math.floor(Math.random() * cast.length)];
      const line = pickLine(who, 'radio');
      if (line) {
        g.say(who, line);
        audio.radioBlip();
      }
    }, 14000);
    return () => window.clearInterval(id);
  }, [mode]);

  const mission = activeMissionId ? missionsById.get(activeMissionId) : null;
  const objective = mission?.objectives[objectiveIndex];
  const objPoint = mission ? telemetry.objective : null;
  const targetDist = objPoint ? Math.hypot(objPoint.x - telemetry.x, objPoint.z - telemetry.z) : null;
  const waypointBearing = objPoint ? Math.atan2(objPoint.x - telemetry.x, -(objPoint.z - telemetry.z)) : null;

  const kmh = Math.round(telemetry.speed * 3.4);
  const showMarker = mission && objPoint && !telemetry.marker.behind;

  return (
    <div className="hud" aria-hidden={mode !== 'riding'}>
      {/* compass */}
      <div className="hud-compass">
        <div className="hud-compass-inner">
          {COMPASS_POINTS.map(([ang, label]) => {
            const off = angDiff(ang, telemetry.heading);
            if (Math.abs(off) > 0.9) return null;
            return (
              <span key={label} className="hud-compass-tick" style={{ left: `${50 + (off / 0.9) * 48}%` }}>
                {label}
              </span>
            );
          })}
          {waypointBearing !== null && Math.abs(angDiff(waypointBearing, telemetry.heading)) < 0.9 && (
            <span
              className="hud-compass-waypoint"
              style={{ left: `${50 + (angDiff(waypointBearing, telemetry.heading) / 0.9) * 48}%` }}
            >
              ◆
            </span>
          )}
        </div>
      </div>

      {/* minimap */}
      <canvas ref={minimap} className="hud-minimap" width={156} height={156} aria-label="Minimap" />

      {/* mission tracker */}
      {mission && (
        <div className="hud-mission panel">
          <div className="hud-mission-title">{mission.title}</div>
          <div className="hud-mission-obj">
            {objective?.label ?? objective?.type ?? ''}
            {objective?.type === 'collect' && ` (${objectiveCount}/${objective.count ?? 3})`}
            {objective?.type === 'race' && ` gate ${objectiveCount + 1}/${objective.targets?.length ?? 0}`}
          </div>
          {targetDist !== null && <div className="hud-mission-dist">{Math.round(targetDist)} m</div>}
          {timeLeft !== null && <div className={`hud-mission-time ${timeLeft < 15 ? 'urgent' : ''}`}>{Math.ceil(timeLeft)}s</div>}

          {/* fragile cargo */}
          {cargoIntegrity !== null && (
            <div className="hud-cargo" aria-label={`Cargo integrity ${Math.round(cargoIntegrity * 100)} percent`}>
              <span className="hud-cargo-label">◻ {mission.cargo?.label ?? 'fragile cargo'}</span>
              <div className={`hud-cargo-bar ${cargoIntegrity < 0.35 ? 'low' : ''}`}>
                <div className="hud-cargo-fill" style={{ width: `${cargoIntegrity * 100}%` }} />
              </div>
            </div>
          )}

          {/* escort range meter */}
          {telemetry.escort && (
            <div className={`hud-escort ${telemetry.escort.out > 0 ? 'warn' : ''}`}>
              {telemetry.escort.out > 0
                ? `⟲ RETURN TO CONVOY — ${Math.max(0, Math.ceil((1 - telemetry.escort.out) * 10))}s`
                : `convoy ${Math.round(telemetry.escort.dist)} m`}
            </div>
          )}

          {/* scout scan progress */}
          {telemetry.scout && telemetry.scout.progress > 0 && (
            <div className="hud-scout">
              SCANNING <span className="hud-scout-bar"><span className="hud-scout-fill" style={{ width: `${telemetry.scout.progress * 100}%` }} /></span>
            </div>
          )}

          {/* storm proximity */}
          {telemetry.storm && (
            <div className={`hud-storm ${telemetry.storm.dist < 200 ? 'urgent' : ''}`}>
              ▲ STORM WALL {Math.max(0, Math.round(telemetry.storm.dist))} m
            </div>
          )}
        </div>
      )}

      {/* storm screen tint */}
      {telemetry.storm && (
        <div
          className="hud-storm-tint"
          style={{ opacity: Math.min(0.55, Math.max(0, 1 - telemetry.storm.dist / 380) * 0.55) }}
        />
      )}

      {/* fail banner with retry */}
      {missionFailed && (
        <div className="hud-fail panel">
          <div className="hud-fail-reason">{missionFailed.reason}</div>
          <div className="hud-fail-actions">
            <button
              className="btn primary small"
              onClick={() => { audio.blip(660, 0.07); useGameStore.getState().retryFailed(); }}
            >
              Retry the run
            </button>
            <button
              className="btn small"
              onClick={() => { audio.blip(330, 0.07); useGameStore.getState().dismissFail(); }}
            >
              Let it go
            </button>
          </div>
        </div>
      )}

      {/* waypoint marker (projected) */}
      {showMarker && (
        <div
          className="hud-marker"
          style={{ left: `${telemetry.marker.x * 100}%`, top: `${telemetry.marker.y * 100}%` }}
          aria-label="Waypoint"
        >
          ◆
          {targetDist !== null && <span className="hud-marker-dist">{Math.round(targetDist)}m</span>}
        </div>
      )}

      {/* slow-down hint inside capture radius */}
      {telemetry.slowHint && mode === 'riding' && (
        <div className="hud-slow panel">◆ SLOWER — ease off to make the hand-off</div>
      )}

      {/* interact prompt */}
      {telemetry.interact && mode === 'riding' && (
        <div className="hud-interact panel">
          <kbd>E</kbd> {telemetry.interact.label}
        </div>
      )}

      {/* speed + boost */}
      <div className="hud-speed cluster">
        <div className="hud-speed-value">{kmh}<span className="hud-speed-unit">km/h</span></div>
        <div className={`hud-boostbar ${telemetry.boosting ? 'boosting' : ''}`}>
          <div className="hud-boostbar-fill" style={{ width: `${telemetry.boost * 100}%` }} />
        </div>
        <div className="hud-hints">
          {telemetry.drifting ? 'DRIFT — release for boost' : telemetry.grounded ? '' : 'AIRBORNE'}
        </div>
      </div>

      {/* credits */}
      <div className="hud-credits panel">
        <span className="hud-credits-value">{credits.toLocaleString()}</span> cr
        {debt > 0 && <span className="hud-debt">· debt {debt.toLocaleString()}</span>}
      </div>

      {/* radio ticker */}
      {radioLine && Date.now() - radioLine.t < 7000 && (
        <div className="hud-radio panel">
          <span className="hud-radio-tag">RADIO</span>
          <strong>{character(radioLine.who)?.name ?? radioLine.who}:</strong> {radioLine.text}
        </div>
      )}
    </div>
  );
}

function drawMinimap(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const S = canvas.width;
  const scale = S / (WORLD_HALF * 2);

  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(20, 16, 31, 0.72)';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  ctx.fill();

  const px = (wx: number) => S / 2 + wx * scale;
  const pz = (wz: number) => S / 2 + wz * scale;

  // regions
  for (const region of REGIONS.values()) {
    const { center, radius } = region.meta;
    ctx.beginPath();
    ctx.arc(px(center[0]), pz(center[1]), Math.max(3, radius * scale), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(176, 124, 58, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(176, 124, 58, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // storm wall (danger wedge)
  if (telemetry.storm) {
    ctx.beginPath();
    ctx.arc(px(telemetry.storm.x), pz(telemetry.storm.z), telemetry.storm.r * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(228, 87, 46, 0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(228, 87, 46, 0.8)';
    ctx.stroke();
  }

  // waypoint (canonical — follows moving targets)
  if (telemetry.objective && useGameStore.getState().activeMissionId) {
    ctx.fillStyle = '#FFB454';
    ctx.save();
    ctx.translate(px(telemetry.objective.x), pz(telemetry.objective.z));
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
    ctx.restore();
  }

  // escort convoy (teal square) / chase target (rust triangle)
  if (telemetry.convoy) {
    ctx.fillStyle = '#57C4B8';
    ctx.fillRect(px(telemetry.convoy.x) - 2.6, pz(telemetry.convoy.z) - 2.6, 5.2, 5.2);
  }
  if (telemetry.chase) {
    ctx.fillStyle = '#E4572E';
    ctx.save();
    ctx.translate(px(telemetry.chase.x), pz(telemetry.chase.z));
    ctx.beginPath();
    ctx.moveTo(0, -4.4);
    ctx.lineTo(3.6, 3.2);
    ctx.lineTo(-3.6, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // player arrow
  ctx.save();
  ctx.translate(px(telemetry.x), pz(telemetry.z));
  ctx.rotate(-telemetry.heading);
  ctx.fillStyle = '#F3EEE2';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

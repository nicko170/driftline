/**
 * HUD — reads mut telemetry at ~10Hz into local state. Speed, boost, compass,
 * minimap, mission tracker, waypoint marker, interact prompt, radio ticker.
 */
import { useEffect, useRef, useState } from 'react';
import { telemetry } from '../telemetry';
import { useGameStore, useSaveStore } from '../state/store';
import { missionsById } from '../missions/library';
import { REGIONS, getAnchor } from '../world/registry';
import { WORLD_HALF } from '../world/layout';
import { pickLine } from '../dialogue/library';
import { character } from '../dialogue/library';
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
    const id = window.setInterval(() => {
      const g = useGameStore.getState();
      if (g.mode !== 'riding' || g.radioLine || Math.random() > 0.3) return;
      const cast = telemetry.interact ? 'ketch' : ['ketch', 'tamsin-cho', 'ketch'][Math.floor(Math.random() * 3)];
      const line = pickLine(cast, 'radio');
      if (line) {
        g.say(cast, line);
        audio.radioBlip();
      }
    }, 14000);
    return () => window.clearInterval(id);
  }, [mode]);

  // clear stale mission-fail banner
  useEffect(() => {
    if (!missionFailed) return;
    const t = window.setTimeout(() => useGameStore.getState().setMode('riding'), 100);
    return () => window.clearTimeout(t);
  }, [missionFailed]);

  const mission = activeMissionId ? missionsById.get(activeMissionId) : null;
  const objective = mission?.objectives[objectiveIndex];
  const objectiveRef = objective?.type === 'race' ? objective.targets?.[objectiveCount] : objective?.target;
  const targetAnchor = objectiveRef ? getAnchor(objectiveRef) : null;
  const targetDist = targetAnchor ? Math.hypot(targetAnchor.x - telemetry.x, targetAnchor.z - telemetry.z) : null;
  const waypointBearing = targetAnchor ? Math.atan2(targetAnchor.x - telemetry.x, -(targetAnchor.z - telemetry.z)) : null;

  const kmh = Math.round(telemetry.speed * 3.4);
  const showMarker = mission && targetAnchor && !telemetry.marker.behind;

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
        </div>
      )}

      {/* fail banner */}
      {missionFailed && <div className="hud-fail panel">{missionFailed}</div>}

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

  // waypoint
  const g = useGameStore.getState();
  const mission = g.activeMissionId ? missionsById.get(g.activeMissionId) : null;
  const obj = mission?.objectives[g.objectiveIndex];
  const ref = obj?.type === 'race' ? obj.targets?.[g.objectiveCount] : obj?.target;
  const anchor = ref ? getAnchor(ref) : null;
  if (anchor) {
    ctx.fillStyle = '#FFB454';
    ctx.save();
    ctx.translate(px(anchor.x), pz(anchor.z));
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
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

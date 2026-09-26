/**
 * HUD — reads mut telemetry at ~10Hz into local state. Speed, boost, compass,
 * minimap, mission tracker, waypoint marker, interact prompt, radio ticker,
 * cargo integrity, escort/storm/scout meters and the fail/retry banner.
 */
import { useEffect, useRef, useState } from 'react';
import { telemetry } from '../telemetry';
import { useGameStore, useSaveStore, type Faction } from '../state/store';
import { missionsById } from '../missions/library';
import { REGIONS } from '../world/registry';
import { WORLD_HALF } from '../world/layout';
import { SIGNAL_CACHES } from '../game/caches';
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
interface BandVoice {
  id: string;
  home: string;
  faction: string;
}
let bandVoices: BandVoice[] | null = null;
function radioCast(): BandVoice[] {
  if (bandVoices) return bandVoices;
  const out: BandVoice[] = [];
  for (const c of characters.values()) {
    if (c.lines.radio?.length) out.push({ id: c.id, home: c.home, faction: c.faction });
  }
  bandVoices = out.length ? out : [{ id: 'ketch', home: 'saltmouth', faction: 'driftline' }];
  return bandVoices;
}

/** On-world region the rider is inside (centre + radius + skirt), nearest wins. */
export function localBandRegion(): { slug: string; name: string } | null {
  let slug: string | null = null;
  let name = '';
  let bestD = Infinity;
  for (const mod of REGIONS.values()) {
    const m = mod.meta;
    // skip off-world lab benches (centres kilometres beyond the world edge)
    if (Math.abs(m.center[0]) > 1800 || Math.abs(m.center[1]) > 1800) continue;
    const d = Math.hypot(telemetry.x - m.center[0], telemetry.z - m.center[1]);
    if (d < m.radius + 260 && d < bestD) {
      bestD = d;
      slug = m.slug;
      name = m.name;
    }
  }
  return slug ? { slug, name } : null;
}

const REP_FACTIONS = new Set(['guild', 'choir', 'reclaimers']);
const _weights: number[] = [];

/**
 * Band-weighted voice pick — the relay band sounds like where you are and who
 * owes you a favour: locals talk loudest on their home band (+6), factions
 * you've earned rep with key up more (up to +8), and the Driftline always
 * keeps a little extra airtime (+1). Long-range voices stay possible, just
 * fainter — it's one desert, one sky.
 */
function pickRadioVoice(local: string | null, rep: Record<Faction, number>): string {
  const cast = radioCast();
  _weights.length = 0;
  let total = 0;
  for (const v of cast) {
    let w = 1;
    if (local && v.home === local) w += 6;
    if (v.faction === 'driftline') w += 1;
    if (REP_FACTIONS.has(v.faction)) {
      w += Math.min(8, Math.max(0, (rep[v.faction as Faction] ?? 0) * 0.12));
    }
    _weights.push(w);
    total += w;
  }
  let roll = Math.random() * total;
  for (let i = 0; i < cast.length; i++) {
    roll -= _weights[i];
    if (roll <= 0) return cast[i].id;
  }
  return cast[cast.length - 1].id;
}

/** Achievement / unlock toasts — one at a time from the game store queue. */
function AchToasts() {
  const toasts = useGameStore((s) => s.toasts);
  const shiftToast = useGameStore((s) => s.shiftToast);
  const current = toasts[0];
  useEffect(() => {
    if (!current) return;
    const id = window.setTimeout(() => useGameStore.getState().shiftToast(), 4800);
    return () => window.clearTimeout(id);
  }, [current]);
  if (!current) return null;
  return (
    <div className="ach-toast panel" role="status" onClick={shiftToast}>
      <span className="ach-toast-icon" aria-hidden>{current.icon}</span>
      <span className="ach-toast-body">
        <span className="ach-toast-kicker">{current.kicker ?? 'Log entry unlocked'}</span>
        <strong>{current.title}</strong>
        <span className="ach-toast-desc">{current.desc}</span>
      </span>
    </div>
  );
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
    const id = window.setInterval(() => {
      const g = useGameStore.getState();
      if (g.mode !== 'riding' || g.radioLine || Math.random() > 0.3) return;
      const band = localBandRegion();
      const who = pickRadioVoice(band?.slug ?? null, useSaveStore.getState().rep);
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

      {/* storm screen tint — mission walls bite harder; weather fronts haze earlier */}
      {(() => {
        const s = telemetry.storm;
        const f = telemetry.front;
        const tint = Math.max(
          s ? Math.min(0.55, Math.max(0, 1 - s.dist / 380) * 0.55) : 0,
          f ? (f.engulfed ? 0.5 : Math.min(0.45, Math.max(0, 1 - f.dist / 520) * 0.45)) : 0,
        );
        return tint > 0.02 ? <div className="hud-storm-tint" style={{ opacity: tint }} /> : null;
      })()}

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

      {/* signal cache hint */}
      {telemetry.signal && mode === 'riding' && (
        <div className="hud-signal panel">
          ⟡ faint signal · {Math.round(telemetry.signal.dist)} m
        </div>
      )}

      {/* ambient weather front — storm season rolls through free ride */}
      {telemetry.front && mode === 'riding' && (
        <div className={`hud-front panel ${telemetry.front.engulfed || telemetry.front.dist < 240 ? 'urgent' : ''}`}>
          {telemetry.front.engulfed
            ? '▲ IN THE WALL — shelter at a settlement or ride it out'
            : `▲ STORM FRONT · ${Math.round(telemetry.front.dist)} m`}
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

      {/* radio ticker — tag names the local band when you're inside one */}
      {radioLine && Date.now() - radioLine.t < 7000 && (
        <div className="hud-radio panel">
          <span className="hud-radio-tag">
            {(() => {
              const band = localBandRegion();
              return band ? `RADIO · ${band.name.toUpperCase()}` : 'RADIO · LONG STATIC';
            })()}
          </span>
          <strong>{character(radioLine.who)?.name ?? radioLine.who}:</strong> {radioLine.text}
        </div>
      )}

      {/* achievement / unlock toasts */}
      <AchToasts />
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

  // ambient weather front (dashed sand ring — shape differs from the mission wedge)
  const front = telemetry.front;
  if (front) {
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(px(front.x), pz(front.z), Math.max(4, front.r * scale), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(217, 164, 91, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(217, 164, 91, 0.9)';
    ctx.save();
    ctx.translate(px(front.x), pz(front.z));
    ctx.beginPath();
    ctx.moveTo(0, -4.4);
    ctx.lineTo(3.6, 3.2);
    ctx.lineTo(-3.6, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

  // nearby uncollected signal caches (violet open diamonds — the record glyph)
  const codexNow = new Set(useSaveStore.getState().codex);
  ctx.strokeStyle = 'rgba(154, 134, 208, 0.9)';
  ctx.lineWidth = 1.4;
  for (const c of SIGNAL_CACHES) {
    if (codexNow.has(c.lore)) continue;
    if (Math.abs(c.x - telemetry.x) > 420 || Math.abs(c.z - telemetry.z) > 420) continue;
    const sx = px(c.x);
    const sy = pz(c.z);
    if (sx < 4 || sx > S - 4 || sy < 4 || sy > S - 4) continue;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 3.6);
    ctx.lineTo(sx + 3.6, sy);
    ctx.lineTo(sx, sy + 3.6);
    ctx.lineTo(sx - 3.6, sy);
    ctx.closePath();
    ctx.stroke();
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

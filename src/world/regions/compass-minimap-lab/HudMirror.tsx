/**
 * HudMirror — the game's compass pill and projected waypoint marker, rendered
 * with the real HUD CSS classes but driven by the lab's fake world. Uses the
 * shared navmath so the formulas under test are exactly the ones swept by the
 * invariant checks.
 */
import { COMPASS_POINTS, COMPASS_WINDOW, angDiff, bearingTo, chaseCam, projectMarker } from './navmath';
import type { LabWorld } from './world';

const ASPECT = 16 / 9;

export function HudMirror({ world }: { world: LabWorld }) {
  const w = world;
  const bearing = bearingTo(w.player.x, w.player.z, w.waypoint.x, w.waypoint.z);
  const cam = chaseCam(w.speed, w.boosting);
  const proj = projectMarker(
    w.player.x, w.player.z, w.heading,
    w.waypoint.x, w.waypoint.z,
    w.speed, ASPECT, w.boosting,
  );
  const rawOutside =
    proj.rawX < 0 || proj.rawX > 1 || proj.rawY < 0 || proj.rawY > 1;

  return (
    <section className="cml-panel cml-mirror" aria-label="HUD mirror">
      <h3>HUD mirror <span className="cml-sub">real game classes, fake world</span></h3>

      {/* compass — same markup + classes as src/ui/HUD.tsx */}
      <div className="cml-compass-stage">
        <div className="hud-compass">
          <div className="hud-compass-inner">
            {COMPASS_POINTS.map(([ang, label]) => {
              const off = angDiff(ang, w.heading);
              if (Math.abs(off) > COMPASS_WINDOW) return null;
              return (
                <span key={label} className="hud-compass-tick" style={{ left: `${50 + (off / 0.9) * 48}%` }}>
                  {label}
                </span>
              );
            })}
            {Math.abs(angDiff(bearing, w.heading)) < COMPASS_WINDOW && (
              <span
                className="hud-compass-waypoint"
                style={{ left: `${50 + (angDiff(bearing, w.heading) / 0.9) * 48}%` }}
              >
                ◆
              </span>
            )}
          </div>
        </div>
        <div className="cml-readout">
          heading <b>{deg(w.heading)}°</b> · waypoint bearing <b>{deg(bearing)}°</b> ·{' '}
          Δ <b>{deg(angDiff(bearing, w.heading))}°</b>{' '}
          {Math.abs(angDiff(bearing, w.heading)) >= COMPASS_WINDOW && <em>(off-compass)</em>}
        </div>
      </div>

      {/* projected marker viewport */}
      <div className="cml-viewport" aria-label="Projected waypoint marker viewport">
        <div className="cml-viewport-horizon" />
        {/* ghost at the raw projection — proves the clamp is doing work */}
        {!proj.behind && rawOutside && (
          <div
            className="cml-ghost"
            style={{ left: `${proj.rawX * 100}%`, top: `${proj.rawY * 100}%` }}
            aria-hidden
          >
            ◇
          </div>
        )}
        {!proj.behind ? (
          <div
            className="hud-marker"
            style={{ left: `${proj.x * 100}%`, top: `${proj.y * 100}%` }}
            aria-label="Waypoint"
          >
            ◆
            <span className="hud-marker-dist">{Math.round(proj.dist)}m</span>
          </div>
        ) : (
          <div className="cml-behind-chip">TARGET BEHIND CAMERA — marker hidden</div>
        )}
        <div className="cml-viewport-readout">
          fov {cam.fov.toFixed(1)}° · cam {cam.dist.toFixed(1)}m back · {w.boosting ? 'BOOST' : w.speed > 0 ? `${Math.round(w.speed * 3.4)} km/h` : 'idling'}
          {rawOutside && !proj.behind && <> · clamped from ({proj.rawX.toFixed(2)}, {proj.rawY.toFixed(2)})</>}
        </div>
      </div>
    </section>
  );
}

function deg(rad: number): string {
  return String(Math.round(((rad * 180) / Math.PI + 540) % 360 - 180));
}

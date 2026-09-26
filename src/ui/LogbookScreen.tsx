/**
 * /logbook — the courier's logbook: lifetime ride stats + the achievement
 * ledger. Unlocked achievements show full detail; locked ones show a hint
 * (hidden story ones show only static).
 */
import { Link } from 'react-router-dom';
import { useSaveStore } from '../state/store';
import { ACHIEVEMENTS } from '../game/achievements';

function km(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;
}
function secs(s: number): string {
  return s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${s.toFixed(1)}s`;
}

export default function LogbookScreen() {
  const stats = useSaveStore((s) => s.stats);
  const achievements = useSaveStore((s) => s.achievements);
  const unlocked = new Set(achievements);
  const done = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

  return (
    <div className="logbook-screen">
      <header className="sheet-head logbook-head">
        <div>
          <h1>Courier's Logbook</h1>
          <p className="dim">
            {done} of {ACHIEVEMENTS.length} log entries unlocked — the desert keeps score even when nobody's counting.
          </p>
        </div>
        <Link className="btn" to="/">← Title</Link>
      </header>
      <div className="logbook-body">
        <section className="logbook-stats panel" aria-label="Lifetime ride stats">
          <div className="logbook-stat"><span>DISTANCE RIDDEN</span><b>{km(stats.distanceM)}</b></div>
          <div className="logbook-stat"><span>TOP SPEED</span><b>{Math.round(stats.topSpeedKmh)} km/h</b></div>
          <div className="logbook-stat"><span>JOBS COMPLETED</span><b>{stats.missionsDone}</b></div>
          <div className="logbook-stat"><span>STORMS OUTRUN</span><b>{stats.stormsOutrun}</b></div>
          <div className="logbook-stat"><span>HOPS</span><b>{stats.jumps}</b></div>
          <div className="logbook-stat"><span>TOTAL DRIFT TIME</span><b>{secs(stats.driftTimeS)}</b></div>
          <div className="logbook-stat"><span>LONGEST DRIFT</span><b>{secs(stats.bestDriftS)}</b></div>
          <div className="logbook-stat"><span>TIME AIRBORNE</span><b>{secs(stats.airTimeS)}</b></div>
          <div className="logbook-stat"><span>LONGEST FLIGHT</span><b>{secs(stats.biggestAirS)}</b></div>
          <div className="logbook-stat"><span>BOOSTS BURNED</span><b>{stats.boostsUsed}</b></div>
        </section>
        <ul className="ach-grid" aria-label="Achievements">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            const hidden = a.hidden && !isUnlocked;
            return (
              <li key={a.id} className={`ach-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                <span className="ach-card-icon" aria-hidden>{hidden ? '▯' : a.icon}</span>
                <div>
                  <h4>{isUnlocked ? a.title : hidden ? '▯▯▯ signal not recovered' : a.title}</h4>
                  <p>{isUnlocked ? a.desc : hidden ? 'Finish the story to hear this one.' : a.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

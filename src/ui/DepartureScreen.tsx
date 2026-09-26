/**
 * Departure screen — the dispatch-office manifest shown between ▸ Play and the
 * first rideable frame. Stamps clear as real milestones land:
 *   ENGINE WARM      → audio engine up (GameScreen's mount effect)
 *   ROUTES STREAMED  → all on-world region modules loaded (registry)
 *   LAMPS LIT        → first rendered frame (FrameBeacon, after Suspense)
 *   CLEARANCE        → all of the above + a minimum dwell, so it never strobes
 * Any key dismisses once clearance is granted; a failsafe timer guarantees the
 * rider is never trapped. While visible it eats hop/interact/pause edges so
 * nothing leaks into gameplay underneath (same rule as ChapterCard).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { REGIONS, onWorldRegionsLoaded, subscribeRegions } from '../world/registry';
import { onFirstFrame } from '../game/frameBeacon';
import { useSaveStore } from '../state/store';
import { chapterMeta, currentChapter } from '../missions/chapters';
import { input } from '../input/input';
import { audio } from '../audio/audio';
import { withBase } from '../lib/base';

const MIN_DWELL_MS = 1700;
const FAILSAFE_MS = 9500;
const TIP_MS = 2600;

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const TIPS = [
  'Shift boosts. The meter refills when you lay off — and a clean drift exit pays some back.',
  'Brake while steering to drift. Lean out of the slide and the bike rewards you.',
  'Space hops. You steer in the air — hop the gate rocks, land on the far line.',
  'Deliveries pay better when the cargo arrives pretty. Watch the integrity bar.',
  'Violet ⟡ glimmers on the flats are signal caches — ride through them to crack the codex open.',
  'Amber ◆ missions, teal ■ escorts, rust ▲ chases, red discs mean storm. Shapes first, colour second.',
  'The Guild Exchange takes payment plans. The Guild takes everything eventually.',
  'Storms hunt at courier speed. You are faster. Barely. Keep the shelter anchor on the compass.',
  'Night riding: your headlight comes on by itself. The violet dark hides caches better than danger.',
  'Slow down on approach — dropoffs don’t count past a walking pace.',
  'The radio chatters more when someone on the channel likes you. Rep is earned, not bought.',
  'Any crate, any storm, any door. — the Driftline creed',
];

type Stamp = 'engine' | 'routes' | 'lamps';

const STEPS: { id: Stamp; label: string }[] = [
  { id: 'engine', label: 'Engine warm' },
  { id: 'routes', label: 'Routes streamed' },
  { id: 'lamps', label: 'Lamps lit' },
];

export default function DepartureScreen() {
  const missionsDone = useSaveStore((s) => s.missionsDone);
  const [stamps, setStamps] = useState<Record<Stamp, boolean>>({ engine: false, routes: false, lamps: false });
  const [clearance, setClearance] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const born = useRef(performance.now());

  const meta = useMemo(() => {
    const { chapter } = currentChapter(missionsDone);
    return chapter >= 1 ? chapterMeta(chapter) : undefined;
  }, [missionsDone]);

  const region = REGIONS.get('saltmouth')?.meta;
  const manifestNo = 100 + ((missionsDone.length * 37 + 53) % 900);

  // stamp: engine warm (audio.resume ran on mount — brief fade-in for the stamp)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setStamps((s) => (s.engine ? s : { ...s, engine: true }));
      audio.blip(620, 0.06);
    }, 320);
    return () => window.clearTimeout(t);
  }, []);

  // stamp: routes streamed
  useEffect(() => {
    const check = () => {
      if (!onWorldRegionsLoaded()) return;
      setStamps((s) => {
        if (s.routes) return s;
        audio.blip(780, 0.06);
        return { ...s, routes: true };
      });
    };
    check();
    return subscribeRegions(check);
  }, []);

  // stamp: lamps lit (first real frame)
  useEffect(
    () =>
      onFirstFrame(() => {
        setStamps((s) => {
          if (s.lamps) return s;
          audio.blip(940, 0.07);
          return { ...s, lamps: true };
        });
      }),
    []
  );

  // clearance: all stamps + minimum dwell; failsafe always wins
  useEffect(() => {
    const allStamped = stamps.engine && stamps.routes && stamps.lamps;
    if (!allStamped || clearance) return;
    const wait = Math.max(0, MIN_DWELL_MS - (performance.now() - born.current));
    const t = window.setTimeout(() => {
      setClearance(true);
      audio.chime();
    }, wait);
    return () => window.clearTimeout(t);
  }, [stamps, clearance]);

  useEffect(() => {
    const t = window.setTimeout(() => setClearance(true), FAILSAFE_MS);
    return () => window.clearTimeout(t);
  }, []);

  // rotating dispatch tips while you wait
  useEffect(() => {
    if (clearance) return;
    const id = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_MS);
    return () => window.clearInterval(id);
  }, [clearance]);

  // eat input edges so nothing fires underneath (hop onto a rock, board popping open)
  useEffect(() => {
    if (gone) return;
    const id = window.setInterval(() => {
      input.hop = false;
      input.interact = false;
      input.pause = false;
    }, 50);
    return () => window.clearInterval(id);
  }, [gone]);

  // dismiss: any key once cleared; auto-dismiss shortly after clearance
  const dismiss = () => {
    setLeaving((l) => {
      if (!l) window.setTimeout(() => setGone(true), 460);
      return true;
    });
  };
  useEffect(() => {
    if (!clearance) return;
    const onKey = () => dismiss();
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(dismiss, 1400);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearance]);

  if (gone) return null;

  return (
    <div
      className={`departure${leaving ? ' leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Departure manifest — loading the run"
    >
      <div
        className="departure-art"
        style={{ backgroundImage: `url(${withBase('images/title/departure.jpg')})` }}
        aria-hidden="true"
      />
      <div className="departure-scrim" aria-hidden="true" />
      <div className="departure-panel">
        <div className="dep-kicker">
          Driftline dispatch — Departure{meta ? ` · Chapter ${ROMAN[meta.n - 1] ?? meta.n}` : ''}
        </div>
        <h1 className="dep-title">{region?.name ?? 'Saltmouth'}</h1>
        {meta && <p className="dep-chapter">{meta.title} — {meta.logline}</p>}
        <p className="dep-blurb">{region?.blurb ?? 'The hub of the Glass Desert routes.'}</p>
        <div className="dep-rule" aria-hidden="true">◆ ◆ ◆</div>

        <div className="dep-manifest">
          <div className="dep-manifest-head">
            <span>Manifest № K-9/{manifestNo}</span>
            <span className="dep-manifest-dest">dest. the open line</span>
          </div>
          {STEPS.map((s) => (
            <div key={s.id} className={`dep-step${stamps[s.id] ? ' done' : ''}`}>
              <span className="dep-box" aria-hidden="true">{stamps[s.id] ? '◆' : '◇'}</span>
              <span>{s.label}</span>
              <span className="dep-step-state">{stamps[s.id] ? 'stamped' : 'pending'}</span>
            </div>
          ))}
        </div>

        <p className="dep-tip" aria-live="polite">{TIPS[tip]}</p>

        <div className={`dep-foot${clearance ? ' ready' : ''}`}>
          {clearance ? '◆ CLEARANCE GRANTED — PRESS ANY KEY TO RIDE' : 'Waiting on the tower…'}
        </div>
      </div>
    </div>
  );
}

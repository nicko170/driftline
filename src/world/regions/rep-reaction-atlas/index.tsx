/**
 * REP REACTION ATLAS — the dispatch office's card table.
 *
 * Three faction columns with amber needle gauges scrub standing from HOSTILE
 * to KIN; a scripted courier loops the Saltmouth survey across every on-world
 * band while the bench restages the *shipping* radio pipeline (band rule,
 * weight rules and cadence mirrored from src/ui/HUD.tsx; cast and lines live
 * from the content libraries). The coverage matrix separates what ships, what
 * the runtime is ready for, and what is a true gap — then exports the whole
 * sheet as a claim list for the writers.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [9200, 7400])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it. No scene steering: pure DOM + one canvas map over live
 * content.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { Anchor, RegionMeta, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  BANDS,
  CAST,
  CELL_STYLE,
  DEFAULT_REP,
  FACTION_BY_ID,
  GAUGE_MAX,
  GAUGE_MIN,
  ONWORLD,
  PRESETS,
  REP_GATED,
  ROUTE_LENGTH,
  SATURATION_REP,
  SLIDER_FACTIONS,
  STOPS,
  bandAt,
  bandFor,
  buildMatrix,
  buildFlags,
  pointAt,
  type RepState,
  type SliderFaction,
} from './data';
import RepGauge from './Gauge';
import RideMap from './RideMap';
import RadioDeck from './Deck';
import { CoverageMatrix, FlagsList } from './Matrix';
import './atlas.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

/** full survey loop duration, seconds */
const LOOP_SECONDS = 80;
const SCRUB_STEPS = 1000;

function RepColumn({
  faction,
  value,
  onChange,
}: {
  faction: SliderFaction;
  value: number;
  onChange: (v: number) => void;
}) {
  const fac = FACTION_BY_ID[faction]!;
  const band = bandFor(value);
  const airBonus = Math.min(8, Math.max(0, value * 0.12));
  const saturated = value >= SATURATION_REP;
  const gates = REP_GATED.filter((g) => g.rep[faction] != null).length;

  /** What ships / what's silent at THIS standing — glyph + colour per CELL_STYLE. */
  const rows: { state: keyof typeof CELL_STYLE; text: string }[] = [
    {
      state: 'shipped',
      text:
        airBonus > 0
          ? `radio keys up +${airBonus.toFixed(1)} per ${fac.short} voice${saturated ? ' — capped; past 67 adds nothing' : ''}`
          : value < 0
            ? 'radio reads HOSTILE as zero — no cold shoulder ships'
            : 'radio unbothered at this standing',
    },
    {
      state: 'ready',
      text: gates > 0 ? `${gates} board jobs gate on this standing` : `0 board jobs gate on ${fac.short} standing (schema ready)`,
    },
    { state: 'gap', text: 'shop prices never move with standing' },
    { state: 'gap', text: `no ${band.label.toLowerCase()}-branched lines or callouts` },
    ...(faction === 'guild'
      ? [{ state: 'shipped' as const, text: 'exchange barks at bond 25/50/75 % + wax-seal clear line' }]
      : []),
  ];

  return (
    <section className="rra-column" style={{ ['--fc' as string]: fac.color }} aria-label={`${fac.name} standing`}>
      <header className="rra-column-head">
        <span className="rra-fac">
          <i aria-hidden="true">{fac.glyph}</i> {fac.name}
        </span>
        <span className="rra-band-chip" style={{ ['--bc' as string]: band.color }}>
          <i aria-hidden="true">{band.glyph}</i> {band.label}
        </span>
      </header>

      <RepGauge value={value} band={band} color={fac.color} />

      <div className="rra-slider-row">
        <input
          type="range"
          min={GAUGE_MIN}
          max={GAUGE_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${fac.name} standing, ${GAUGE_MIN} to ${GAUGE_MAX}`}
        />
        <output className="rra-standing" aria-live="polite">
          {value > 0 ? `+${value}` : value}
        </output>
      </div>

      <div className="rra-presets" role="group" aria-label="Posture presets">
        {PRESETS.map((p) => (
          <button
            key={p.band.id}
            className={`rra-preset${band.id === p.band.id ? ' is-set' : ''}`}
            style={{ ['--bc' as string]: p.band.color }}
            onClick={() => onChange(p.value)}
            title={`${p.band.label} (${p.value})`}
          >
            {p.band.glyph}
          </button>
        ))}
      </div>

      <ul className="rra-reacts">
        {rows.map((r, i) => (
          <li key={i} style={{ ['--sc' as string]: CELL_STYLE[r.state].color }}>
            <i aria-hidden="true">{CELL_STYLE[r.state].glyph}</i> {r.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RepReactionAtlas() {
  const [rep, setRep] = useState<RepState>({ ...DEFAULT_REP, guild: 34, choir: 12, reclaimers: 52 });
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [spin, setSpin] = useState(0);

  const pos = useMemo(() => pointAt(t), [t]);
  const band = useMemo(() => bandAt(pos.x, pos.z), [pos]);
  const bandSlug = band?.slug ?? null;

  /* ride loop */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((v) => (v + dt / LOOP_SECONDS) % 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  /* a fresh face on the radio whenever the ride enters a new band */
  const lastBand = useRef(bandSlug);
  useEffect(() => {
    if (lastBand.current !== bandSlug) {
      lastBand.current = bandSlug;
      setSpin((s) => s + 1);
    }
  }, [bandSlug]);

  const setStanding = (f: SliderFaction) => (v: number) => setRep((r) => ({ ...r, [f]: v }));

  /* nearest stop, for the wayline chips */
  const nearestStop = useMemo(() => {
    let best = 0;
    let bestD = Infinity;
    STOPS.forEach((s, i) => {
      const d = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }, [pos]);

  const matrix = useMemo(buildMatrix, []);
  const gapCount = useMemo(
    () => matrix.flatMap((r) => Object.values(r.cells)).filter((c) => c.state === 'gap').length,
    [matrix],
  );
  const warnCount = useMemo(() => buildFlags().filter((f) => f.severity === 'warn').length, []);
  const km = (t * ROUTE_LENGTH) / 1000;

  return (
    <div className="rra-root">
      {/* ---------------- header ---------------- */}
      <header
        className="rra-head"
        style={{ backgroundImage: `url(${withBase('images/work/rep-reaction-atlas.jpg')})` }}
        role="img"
        aria-label="A dispatch-office card table in a dusk-lit caravan: three cloth ledger mats in ochre, teal and rust, brass needle gauges with amber hands, a squat radio glowing with violet static, cards and coloured string pinned across the tabletop"
      >
        <div className="rra-head-veil">
          <p className="rra-kicker">DISPATCH OFFICE · CARD TABLE</p>
          <h2>Rep Reaction Atlas</h2>
          <p>
            Scrub what the desert thinks of you and listen to it change. The gauges set Guild, Choir and
            Reclaimer standing; the courier rides the Saltmouth survey through every band; the bench restages
            the shipping radio line-by-line and marks every surface that should answer to standing — and the
            ones that answer to nothing at all. Shape carries the news everywhere — colour is decoration.
          </p>
        </div>
        <div className="rra-tally" aria-label="Atlas tally">
          <span>
            <strong>{CAST.length}</strong> voices on the cast
          </span>
          <span>
            <strong>{ONWORLD.length}</strong> bands on the survey
          </span>
          <span>
            <strong>{gapCount}</strong> true gaps marked
          </span>
          {warnCount > 0 && (
            <span className="rra-tally-flag">
              ⚠ <strong>{warnCount}</strong> warn flag{warnCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </header>

      {/* ---------------- 1 · the standings ---------------- */}
      <section className="rra-sheet">
        <header className="rra-sheet-head">
          <h3>
            <i aria-hidden="true">◉</i> Set the standings
          </h3>
          <p>
            Three columns, three ledgers. The needle runs irreverent <b>−20</b> to beloved <b>+120</b>; the
            posture chips hop the bands (✖ hostile · △ wary · ▢ neutral · ◈ friendly · ❖ kin — the ledger
            bench&apos;s rails). Each column answers honestly for what its standing moves tonight.
          </p>
        </header>
        <div className="rra-columns">
          {SLIDER_FACTIONS.map((f) => (
            <RepColumn key={f} faction={f} value={rep[f]} onChange={setStanding(f)} />
          ))}
        </div>
      </section>

      {/* ---------------- 2 · the survey ride ---------------- */}
      <section className="rra-sheet">
        <header className="rra-sheet-head">
          <h3>
            <i aria-hidden="true">〽</i> The Saltmouth survey
          </h3>
          <p>
            One courier, one loop, {STOPS.length} stops — every band the band rule can name (the rule is
            shipping&apos;s own: nearest region within radius + 260 m, off-world benches skipped — the
            workshed pan sneaks in, see the flags). Ride it, scrub it, click the map to jump the courier;
            the radio below plays by the exact shipped weights.
          </p>
        </header>

        <RideMap t={t} band={band} onScrub={(v) => { setT(v); setPlaying(false); }} />

        <div className="rra-ride-bar">
          <button className="btn" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? '❚❚ hold position' : '▸ ride the survey'}
          </button>
          <input
            type="range"
            className="rra-scrub"
            min={0}
            max={SCRUB_STEPS}
            value={Math.round(t * SCRUB_STEPS)}
            onChange={(e) => {
              setT(Number(e.target.value) / SCRUB_STEPS);
              setPlaying(false);
            }}
            aria-label="Scrub the survey ride"
          />
          <span className="rra-ride-read" aria-live="polite">
            <b>{km.toFixed(1)}</b> km of {(ROUTE_LENGTH / 1000).toFixed(1)} ·{' '}
            {band ? (
              <>
                band <b>{band.name}</b> (danger {band.danger})
              </>
            ) : (
              <b>long static</b>
            )}
          </span>
        </div>

        <div className="rra-stops" aria-label="Survey stops">
          {STOPS.map((s, i) => (
            <span key={s.slug} className={`rra-stop${i === nearestStop ? ' is-here' : ''}${bandSlug === s.slug ? ' is-band' : ''}`}>
              <i aria-hidden="true">{i + 1}</i> {s.name}
            </span>
          ))}
        </div>

        <RadioDeck rep={rep} band={band} spin={spin} onSpin={() => setSpin((s) => s + 1)} />
      </section>

      {/* ---------------- 3 · the coverage matrix ---------------- */}
      <section className="rra-sheet">
        <header className="rra-sheet-head">
          <h3>
            <i aria-hidden="true">▦</i> The coverage matrix
          </h3>
          <p>
            Surfaces down the left, factions across the top, and every cell marked with what the shipping
            build does about it: ✓ shipped · ◌ runtime-ready but silent · ✕ no hook — a true gap · — not
            applicable. Counts are read live from the mission and character libraries.
          </p>
        </header>
        <CoverageMatrix rep={rep} />
      </section>

      {/* ---------------- 4 · flags ---------------- */}
      <section className="rra-sheet">
        <header className="rra-sheet-head">
          <h3>
            <i aria-hidden="true">▯</i> Flags the survey raised
          </h3>
          <p>
            Warn flags carry ⚠ — things a player will quietly never see. Notes ride ◌ ❖ ◇ — seams the bench
            found while restaging the pipeline.
          </p>
        </header>
        <FlagsList />
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="rra-foot">
        <p>
          Method: the Atlas mirrors the shipping pipeline, it doesn&apos;t invent one — cast, weight rules
          (base 1 · +6 home · +1 driftline · +min(8, rep×0.12)) and band rule (radius + 260 m, ±1800 m
          on-world cut) are restaged from <code>src/ui/HUD.tsx</code>; chatter cadence (14 s tick, 30 %
          chance) is the shipping tick, and voice/line picks are seeded per spin so sliders never re-roll
          a subtitle. Mission gates, payouts and line buckets are scanned live from{' '}
          <code>src/content/missions</code> and <code>src/content/characters</code> at load — no fixtures.
          Posture bands are the Rep Ledger Bench&apos;s rail proposal (
          {BANDS.map((b) => `${b.glyph} ${b.label.toLowerCase()} ${b.min === -Infinity ? '<0' : b.until == null ? `${b.min}+` : `${b.min}–${b.until - 1}`}`).join(' · ')}
          ); the save itself stores raw rep with no named tiers.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = RepReactionAtlas as typeof RepReactionAtlas & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

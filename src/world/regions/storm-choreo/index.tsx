/**
 * STORM CHOREO — storm-wall pursuit tuning bench.
 *
 * Stage the DRIFTLINE storm objective on a top-down tactical pan: drag the
 * shelter diamond and the storm spawn ring (or ride the sliders) and a seeded
 * Monte Carlo courier crowd — straight-line intent with reaction delay,
 * heading wobble, panic dodge and a finite boost reserve — re-runs the chase
 * against the exact pursuit math shipped in src/game/MissionDirector.tsx.
 * Survival probability flips live, graded from POSTAGE RUN to FUNERAL
 * WEATHER; spectral replays animate single trials and leave ghost ribbons;
 * tuned courses export as mission objective JSON for writers.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [6600, 6600])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useEffect, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  DEFAULTS, mulberry32, runMonteCarlo, runTrial,
  type ChoreoParams, type MCResult, type TrailPoint,
} from './sim';
import {
  TacticalCanvas, computeBounds, type Spectate, type Ghost,
} from './TacticalCanvas';
import { BenchControls, ReadoutCard, ExportCard } from './Panels';
import './choreo.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function StormChoreo() {
  const [params, setParams] = useState<ChoreoParams>(DEFAULTS);
  const [mc, setMc] = useState<MCResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [spectate, setSpectate] = useState<Spectate | null>(null);
  const [speed, setSpeed] = useState(2);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const specSeed = useRef(1);

  /* debounce the Monte Carlo batch so slider drags stay fluid; a new course
     retires the replay in flight and its ghost ribbons (stale geometry) */
  useEffect(() => {
    setBusy(true);
    setSpectate(null);
    setGhosts([]);
    const id = window.setTimeout(() => {
      setMc(runMonteCarlo(params));
      setBusy(false);
    }, 140);
    return () => window.clearTimeout(id);
  }, [params]);

  const runOne = () => {
    specSeed.current += 1;
    const deck = params.seed + specSeed.current * 0x9e3779b9;
    const tr = runTrial(params, mulberry32(deck), true);
    const trace = tr.trace ?? [];
    setSpectate({ id: specSeed.current, out: tr.out, trace, bounds: computeBounds(trace, params.radius) });
  };

  const onSpecEnd = (out: Spectate['out'], trace: TrailPoint[]) => {
    setGhosts((g) => [...g.slice(-7), { pts: trace.map((q) => ({ x: q.x, z: q.z })), out }]);
    setSpectate(null);
  };

  const verdict = mc?.verdict;

  return (
    <div className="sc-root">
      <header
        className="sc-head"
        style={{ backgroundImage: `url(${withBase('images/work/storm-choreo.jpg')})` }}
        role="img"
        aria-label="A wall of amber sand towering over a lone hover-bike courier on the salt flats"
      >
        <div className="sc-head-veil">
          <p className="sc-kicker">workshed · pursuit tuning</p>
          <h2>Storm Choreo</h2>
          <p>
            Restage the storm objective on the tactical pan — shelter anchor, spawn offset,
            pursuit curve, wall radius — and watch survival odds flip live over a seeded
            Monte Carlo courier crowd. Tune for <b>tense but fair</b>, then export the
            objective JSON for the writers. The wall math here is the wall math in the game.
          </p>
        </div>
      </header>

      <div className="sc-grid">
        <section className="sc-stage" aria-label="Tactical storm pan">
          <TacticalCanvas
            params={params}
            ghosts={ghosts}
            onParams={setParams}
            spectate={spectate}
            speed={speed}
            onSpecEnd={onSpecEnd}
          />

          <div className="sc-topline" aria-live="polite">
            {verdict ? (
              <>
                <span className="sc-topnum">{Math.round(mc!.survival * 100)}%</span>
                <span className="sc-topverdict" data-cls={verdict.cls}>
                  <i aria-hidden="true">{verdict.glyph}</i> {verdict.label}
                </span>
                <span className="sc-topdim">over n={mc!.trials} couriers · {busy ? 're-running…' : 'settled'}</span>
              </>
            ) : (
              <span className="sc-topdim">dealing the deck…</span>
            )}
          </div>

          <div className="sc-actions">
            <button className="sc-run" onClick={runOne}>
              ▸ run a trial
            </button>
            <div className="sc-speed" role="group" aria-label="Replay speed">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  className={speed === s ? 'is-on' : ''}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <p className="sc-hint">drag ◆ shelter · ○ wall spawn — sliders mirror them for keyboard</p>
        </section>

        <div className="sc-side">
          <BenchControls params={params} onParams={setParams} />
          <ReadoutCard mc={mc} busy={busy} />
          <ExportCard params={params} mc={mc} />
        </div>
      </div>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = StormChoreo as typeof StormChoreo & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

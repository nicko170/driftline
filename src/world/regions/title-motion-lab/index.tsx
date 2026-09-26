/**
 * TITLE MOTION LAB — the front door, tuned.
 *
 * The shipped TitleScreen's entrance rebuilt as a tunable instrument: layered
 * key-art parallax, beat-by-beat menu choreography, the epilogue-panel reveal,
 * and font-swap states under simulated slow networks — with a timeline
 * readout and exportable CSS timing tokens for the shipped screen.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [8600, -8200])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import { EPILOGUES } from '../../../missions/endings';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  DEFAULT_TOKENS,
  NETWORKS,
  buildSchedule,
  menuReadyAt,
  settleAt,
  type TitleTokens,
} from './tokens';
import { Stage } from './Stage';
import { Timeline } from './Timeline';
import { Controls, type EpiloguePick } from './Controls';
import './title-motion.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function TitleMotionLab() {
  const [tokens, setTokens] = useState<TitleTokens>(DEFAULT_TOKENS);
  const [epiloguePick, setEpiloguePick] = useState<EpiloguePick>('none');
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [runKey, setRunKey] = useState(1);
  const [fontsIn, setFontsIn] = useState(true);

  /* Honest floor report: are the brand faces actually ready in this session? */
  const brandReady = useMemo(
    () =>
      typeof document !== 'undefined' &&
      typeof document.fonts?.check === 'function' &&
      document.fonts.check('700 32px "Chakra Petch"', 'D'),
    [],
  );

  const patch = useCallback(
    (p: Partial<TitleTokens>) => setTokens((t) => ({ ...t, ...p })),
    [],
  );
  const reset = useCallback(() => setTokens(DEFAULT_TOKENS), []);
  const replay = useCallback(() => setRunKey((k) => k + 1), []);

  /* Font-swap simulation: on every replay (or network change) the replica
   * drops to the system fallback stack until the simulated delay lands. */
  useEffect(() => {
    const delay = NETWORKS[tokens.net].delayMs;
    if (delay === 0) {
      setFontsIn(true);
      return;
    }
    setFontsIn(false);
    const id = window.setTimeout(() => setFontsIn(true), delay);
    return () => window.clearTimeout(id);
  }, [runKey, tokens.net]);

  const epilogue = useMemo(
    () =>
      epiloguePick === 'none'
        ? null
        : (EPILOGUES.find((e) => e.id === epiloguePick) ?? null),
    [epiloguePick],
  );

  const schedule = useMemo(
    () => buildSchedule(tokens, { epilogue: epiloguePick !== 'none', reduce }),
    [tokens, epiloguePick, reduce],
  );
  const ready = menuReadyAt(schedule);
  const settle = settleAt(schedule);

  return (
    <div className="tml-root">
      <header
        className="tml-head"
        style={{ backgroundImage: `url(${withBase('images/work/title-motion-lab.jpg')})` }}
        role="img"
        aria-label="A motion bench in a salt-flats workshop: title key art on an easel with ghosted arrival frames, amber timing strips below"
      >
        <div className="tml-head-veil">
          <h2>Title Motion Lab</h2>
          <p>
            The screen every player meets first, taken apart and put back on springs. Tune the
            parallax strata, the entrance beat-by-beat, the epilogue reveal, and how the title
            holds together while the brand faces are still coming down the pipe — then export the
            timing tokens the shipped screen can adopt verbatim.
          </p>
        </div>
        <div className="tml-tally" aria-label="Bench readout">
          <span>
            <strong>{schedule.length}</strong> beats
          </span>
          <span>
            menu actionable <strong>{Math.round(ready)}ms</strong>
          </span>
          <span>
            settled <strong>{Math.round(settle)}ms</strong>
          </span>
          <span>
            faces <strong>{NETWORKS[tokens.net].delayMs}ms</strong> · {NETWORKS[tokens.net].label}
          </span>
        </div>
      </header>

      <div className="tml-grid">
        <Stage
          tokens={tokens}
          schedule={schedule}
          epilogue={epilogue}
          reduce={reduce}
          runKey={runKey}
          fontsIn={fontsIn}
        />
        <Controls
          tokens={tokens}
          patch={patch}
          reset={reset}
          epilogue={epiloguePick}
          setEpilogue={setEpiloguePick}
          reduce={reduce}
          setReduce={setReduce}
          onReplay={replay}
        />
      </div>

      <Timeline schedule={schedule} fontDelayMs={NETWORKS[tokens.net].delayMs} />

      <footer className="tml-foot">
        <p>
          Bench rules the lab enforces: the replica renders with the game’s own{' '}
          <code>ui.css</code> title classes and the real epilogue data — polish lands where it
          ships. Entrance beats are pure CSS animations keyed by custom properties; replay is a
          remount, not an animation library. Parallax runs one rAF loop, writes styles only past a
          0.05px dead zone, and parks entirely under reduced motion, which also swaps every rise
          for a fade — <em>shape carries meaning, colour never stands alone</em> (✓ pass, ▲ over
          budget, ◆ font swap, ┃ budget rule). Network states only simulate the font wait; the
          real faces {brandReady ? 'are cached in this session' : 'are still loading in this session'}{' '}
          — the brand always arrives, late guests or not.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = TitleMotionLab as typeof TitleMotionLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

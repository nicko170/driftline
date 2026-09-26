/**
 * RADIO WEIGHT SANDBOX — the band-chatter tuning bench.
 *
 * A night salt flat soundstage: one amber-lit relay mast ringed by teleport
 * plinths (one per on-world band + Long Static), scope consoles flickering.
 * Pick a band, simulate faction rep, roll 100/1000 chatter picks and compare
 * the observed histogram against the theoretical stacked weights — the exact
 * math the shipped HUD pickRadioVoice runs (see weights.ts, SHIPPED mirror).
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [7600, 6000])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  bandList,
  computeWeights,
  rollPicks,
  kickPulse,
  type RepFaction,
  type RepInput,
} from './weights';
import { pickLine } from '../../../dialogue/library';
import { SandboxScene } from './Scene';
import { BandPanel, RepPanel, RollPanel, ExportPanel } from './Panel';
import { Histogram } from './Histogram';
import './sandbox.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function exportJson(
  band: string | null,
  rep: RepInput,
  rows: ReturnType<typeof computeWeights>['rows'],
  total: number,
  rolls: number,
  counts: Record<string, number>,
): string {
  return JSON.stringify(
    {
      bench: 'radio-weight-sandbox',
      mirror: 'HUD.tsx pickRadioVoice (iteration 11): 1 + 6·home + 1·driftline + min(8, rep×0.12)',
      band,
      rep,
      totalWeight: Number(total.toFixed(3)),
      rolls,
      voices: rows.map((r) => ({
        id: r.id,
        faction: r.faction,
        home: r.home,
        base: r.base,
        local: r.local,
        lifer: r.lifer,
        repBonus: Number(r.repBonus.toFixed(2)),
        weight: Number(r.w.toFixed(3)),
        share: Number(r.share.toFixed(5)),
        observed: rolls > 0 ? Number(((counts[r.id] ?? 0) / rolls).toFixed(5)) : null,
        count: counts[r.id] ?? 0,
      })),
    },
    null,
    2,
  );
}

function RadioWeightSandbox() {
  const bands = useMemo(() => bandList(), []);
  const [band, setBand] = useState<string | null>('saltmouth');
  const [rep, setRep] = useState<RepInput>({ guild: 0, choir: 0, reclaimers: 0 });
  const [rolls, setRolls] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastPick, setLastPick] = useState<{ id: string; line: string } | null>(null);
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { rows, total } = useMemo(() => computeWeights(band, rep), [band, rep]);

  const reset = useCallback(() => {
    setRolls(0);
    setCounts({});
    setLastPick(null);
  }, []);

  // stale dice lie: re-tuning the bench clears the run
  const retuneBand = useCallback(
    (slug: string | null) => {
      setBand(slug);
      reset();
      kickPulse(0.6);
    },
    [reset],
  );
  const retuneRep = useCallback(
    (f: RepFaction, v: number) => {
      setRep((prev) => ({ ...prev, [f]: v }));
      reset();
    },
    [reset],
  );

  const roll = useCallback(
    (n: number) => {
      const picked = rollPicks(rows, total, n);
      setCounts((prev) => {
        const next = { ...prev };
        for (const [k, v] of picked) next[k] = (next[k] ?? 0) + v;
        return next;
      });
      setRolls((r) => r + n);
      // show a sampled voice with an actual radio line — the ticker feel
      const ids = [...picked.keys()];
      const lastId = ids[ids.length - 1];
      if (lastId) {
        const line = pickLine(lastId, 'radio');
        if (line) setLastPick({ id: lastId, line });
      }
      kickPulse(1);
    },
    [rows, total],
  );

  const payload = useMemo(
    () => exportJson(band, rep, rows, total, rolls, counts),
    [band, rep, rows, total, rolls, counts],
  );
  const copy = useCallback(() => {
    navigator.clipboard
      ?.writeText(payload)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => window.prompt('Copy the weights JSON:', payload));
  }, [payload]);

  // hotkeys: R rolls 100, X resets
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const tag = el?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement)?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'r') roll(100);
      else if (k === 'x') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [roll, reset]);

  const bandName = bands.find((b) => b.slug === band)?.name ?? 'Long Static';
  const top = rows[0];

  return (
    <div className="rws-root">
      <header className="rws-head">
        <div>
          <h2>Radio Weight Sandbox</h2>
          <p className="rws-sub">
            Tuning bench for the shipped band-weighted chatter — <code>1 + 6·home + 1·lifers + min(8, rep×0.12)</code>.
            Step on a plinth, fake some rep, roll the dice.
          </p>
        </div>
        <div className="rws-tally" aria-label="Bench tally">
          <span>
            <strong>{rows.length}</strong> voices
          </span>
          <span>
            <strong>{bands.length - 1}</strong> bands
          </span>
          <span>
            <strong>Σ{total.toFixed(0)}</strong> weight
          </span>
          {top && (
            <span className="rws-tally-top">
              loudest: <strong>{top.name}</strong> {(top.share * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </header>

      <div className="rws-main">
        <section className="rws-stage" aria-label="Soundstage — pick a plinth">
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 13.5, 30], fov: 46, near: 0.5, far: 400 }} gl={{ antialias: true }}>
            <SandboxScene band={band} hoverName={hoverName} onPickBand={retuneBand} onHoverBand={setHoverName} />
          </Canvas>
          <div className="rws-stage-chip panel">
            {hoverName ? (
              <>◇ plinth · {hoverName}</>
            ) : (
              <>
                RADIO · <strong>{band === null ? 'LONG STATIC' : bandName.toUpperCase()}</strong>
              </>
            )}
          </div>
          {lastPick && (
            <div className="rws-stage-line panel" aria-live="polite">
              <span className="rws-stage-who">{rows.find((r) => r.id === lastPick.id)?.name ?? lastPick.id}</span>
              <span className="rws-stage-say">“{lastPick.line}”</span>
            </div>
          )}
        </section>

        <aside className="rws-console">
          <BandPanel bands={bands} band={band} onBand={retuneBand} />
          <RepPanel rep={rep} onRep={retuneRep} />
          <RollPanel rolls={rolls} total={total} voices={rows.length} onRoll={roll} onReset={reset} />
          <ExportPanel payload={payload} copied={copied} onCopy={copy} />
        </aside>
      </div>

      <Histogram rows={rows} counts={counts} rolls={rolls} band={band} />

      <footer className="rws-foot">
        <span>
          <kbd>R</kbd> roll 100
        </span>
        <span>
          <kbd>X</kbd> reset
        </span>
        <span>click a plinth to change band</span>
        <span className="dim">one desert, one sky — long-range voices stay possible</span>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = RadioWeightSandbox as typeof RadioWeightSandbox & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

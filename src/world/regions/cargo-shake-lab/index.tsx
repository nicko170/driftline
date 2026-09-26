/**
 * CARGO SHAKE LAB — the fragile-cargo tuning bench.
 *
 * A ghost hover-bike runs canned bump sequences (small rock, gantry leg, hard
 * landing, storm clip, full gauntlet) down a salt test pan while the shipped
 * damage chain is tuned live: impact threshold, shield soak per level, and the
 * FRAGILE_DMG coefficient. A big integrity gauge rides the HUD, two gauge
 * pylons stand at the start line, the scatter + payout charts argue in SVG,
 * and a stashed "ghost A" param set replays alongside for A/B. Copy JSON
 * drops a MissionDirector-ready tuning payload on the clipboard.
 *
 * Region-registry note (workshed policy): this is a lab, so meta.json +
 * anchors.json describe a harmless off-world bench and the default export
 * carries meta/anchors statics — the game streams nothing from it.
 *
 * Keys: R run/stop · G ghost replay · A stash params as ghost A · 1–5 pick a
 * sequence · M mute.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { LabScene } from './Scene';
import { LabPanel } from './Panel';
import { LabHud } from './Hud';
import { lab, startRun, SEQUENCES, resetRun } from './sim';
import { synth } from './synth';
import { withBase } from '../../../lib/base';
import './cargo-shake-lab.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function CargoShakeLab() {
  const [started, setStarted] = useState(false);

  // keyboard: R run/stop, G ghost, A stash, 1-5 sequence, M mute
  useEffect(() => {
    if (!started) return;
    const isForm = (e: KeyboardEvent) =>
      ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement | null)?.tagName ?? '');
    const down = (e: KeyboardEvent) => {
      if (isForm(e) || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'r') {
        if (lab.running) {
          lab.running = false;
          resetRun();
        } else {
          startRun();
          synth.tick(760, 0.05);
        }
      } else if (k === 'g') {
        if (!lab.stash) lab.stash = { ...lab.params };
        lab.ghostOn = !lab.ghostOn;
        synth.tick(lab.ghostOn ? 990 : 620, 0.05);
      } else if (k === 'a') {
        lab.stash = { ...lab.params };
        lab.ghostOn = true;
        synth.tick(1180, 0.06);
      } else if (k === 'm') {
        lab.muted = !lab.muted;
        synth.setMuted(lab.muted);
      } else if (k >= '1' && k <= '5') {
        const seq = SEQUENCES[parseInt(k, 10) - 1];
        if (seq) {
          lab.seq = seq.id;
          if (lab.running) startRun();
          else resetRun();
        }
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [started]);

  // own the synth for the lab's lifetime
  useEffect(() => () => synth.stop(), []);

  return (
    <div className="csl-root">
      <div className="csl-canvas">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [2.2, 3.1, 9.2], fov: 60, near: 0.3, far: 3200 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <LabScene />
        </Canvas>
      </div>

      {started && (
        <>
          <LabPanel />
          <LabHud />
          <p className="csl-hint">
            <kbd>R</kbd> run · <kbd>G</kbd> ghost replay · <kbd>A</kbd> stash A · <kbd>1–5</kbd> sequence · <kbd>M</kbd> mute
          </p>
        </>
      )}

      {!started && (
        <div className="csl-splash">
          <div className="csl-splash-card panel">
            <div
              className="csl-splash-art"
              style={{ backgroundImage: `url(${withBase('images/work/cargo-shake-lab.jpg')})` }}
              role="img"
              aria-label="Concept art of a ghost hover-bike with a strapped cargo crate crossing a marked salt test pan toward a gantry gate"
            />
            <div className="csl-splash-body">
              <h1>Cargo Shake Lab</h1>
              <p>
                Fragile jobs live or die on three numbers buried in the codebase: the impact floor
                that ignores small taps, the shield soak that eats medium ones, and the coefficient
                that turns what's left into lost pay. This bench runs a ghost bike through scripted
                hits — the rock, the gantry leg, the landing you swore was soft — so those numbers
                stop being guesses. Tune, stash an A/B ghost, watch the payout curve, copy the JSON.
              </p>
              <button
                className="btn primary big"
                onClick={() => {
                  synth.start();
                  synth.tick(660, 0.09);
                  setStarted(true);
                }}
              >
                Roll the ghost out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = CargoShakeLab as typeof CargoShakeLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

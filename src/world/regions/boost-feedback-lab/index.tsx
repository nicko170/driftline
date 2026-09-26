/**
 * BOOST FEEDBACK LAB — the boost-feel bench.
 *
 * A ghost telemetry model rides a treadmill speed strip; hold Shift (or the
 * button) to boost while candidate camera-FOV curves, boost shakes, engine
 * pitch curves and boost-bar drain styles audition against the shipped
 * treatment. "Run the tape" replays one identical scripted run; "strobe"
 * alternates shipped ↔ candidate through it. Ships constants/presets via
 * "copy preset JSON".
 *
 * Region-registry note (workshed policy): this is a lab, so meta.json +
 * anchors.json describe a harmless off-world bench and the default export
 * carries meta/anchors statics — the game streams nothing from it.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { LabScene } from './Scene';
import { LabPanel } from './Panel';
import { LabHud } from './Hud';
import { lab, setTape } from './sim';
import { synth } from './synth';
import { withBase } from '../../../lib/base';
import './boost-feedback-lab.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function BoostFeedbackLab() {
  const [started, setStarted] = useState(false);

  // keyboard: Shift/Space = boost, T = tape, M = mute
  useEffect(() => {
    if (!started) return;
    const isForm = (e: KeyboardEvent) =>
      ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement | null)?.tagName ?? '');
    const down = (e: KeyboardEvent) => {
      if (isForm(e) || e.repeat) return;
      if (e.key === 'Shift' || e.key === ' ') lab.wantBoost = true;
      else if (e.key.toLowerCase() === 't') setTape(!lab.tape);
      else if (e.key.toLowerCase() === 'm') {
        lab.muted = !lab.muted;
        synth.setMuted(lab.muted);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === ' ') lab.wantBoost = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [started]);

  // own the synth for the lab's lifetime
  useEffect(() => {
    return () => synth.stop();
  }, []);

  return (
    <div className="bfl-root">
      <div className="bfl-canvas">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 3.2, 8.5], fov: 60, near: 0.3, far: 3200 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <LabScene />
        </Canvas>
      </div>

      {started && (
        <>
          <LabPanel />
          <LabHud />
          <p className="bfl-hint">hold <kbd>Shift</kbd> or <kbd>Space</kbd> boost · <kbd>T</kbd> run the tape · <kbd>M</kbd> mute</p>
        </>
      )}

      {!started && (
        <div className="bfl-splash">
          <div className="bfl-splash-card panel">
            <div
              className="bfl-splash-art"
              style={{ backgroundImage: `url(${withBase('images/work/boost-feedback-lab.jpg')})` }}
              role="img"
              aria-label="Concept art of a hover-bike boosting down a marked salt speed-trial strip"
            />
            <div className="bfl-splash-body">
              <h1>Boost Feedback Lab</h1>
              <p>
                Boost is the sweetest three seconds in DRIFTLINE, and the shipped treatment is a
                binary step: FOV ×1.25, pitch +26 Hz, one silent camera. This bench auditions the
                alternatives live — punch-in FOV, rumble that ramps hot, spool-up engine bloom,
                charge cells that tick as they drain — against the shipped curve, on a scripted
                tape you can strobe back and forth. Judge by feel, verify on the chart, copy the
                winning preset.
              </p>
              <button
                className="btn primary big"
                onClick={() => {
                  synth.start();
                  synth.tick(660, 0.09, 0.05);
                  setStarted(true);
                }}
              >
                Warm the strip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = BoostFeedbackLab as typeof BoostFeedbackLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

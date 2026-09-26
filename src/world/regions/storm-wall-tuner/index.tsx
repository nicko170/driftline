/**
 * STORM WALL TUNER — storm look-dev bench on rails.
 *
 * The shipping storm wall (nested fog shells + churn band, from
 * MissionDirector.tsx) is parked on a fixed rail — no riding, no hunting:
 * scrub face proximity, time-of-day and quality presets while the real fog
 * ramp and HUD screen tint (Sky.tsx / HUD.tsx constants) play over a salt
 * pan. A storm-only 64² readback measures screen coverage and translucent
 * stack depth live. "Copy constants JSON" emits drop-in blocks.
 * Sibling benches: storm-front-sandbox (how it hunts), storm-choreo (mission
 * math) — this one owns how it *looks* and what it *costs*.
 *
 * Region-registry note (workshed policy): this is a lab, so meta.json +
 * anchors.json describe a harmless off-world bench (center [6050, 6050]) and
 * the default export carries meta/anchors statics — the game streams nothing
 * from it.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { TunerScene } from './Scene';
import { TunerHud } from './Hud';
import { TunerPanel } from './Panel';
import { FACE_MAX, lab, rt, type Rig } from './state';
import { withBase } from '../../../lib/base';
import './tuner.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

const RIG_ORDER: Rig[] = ['chase', 'orbit', 'top'];

function StormWallTuner() {
  const [started, setStarted] = useState(false);

  // hotkeys: C rig · P squeeze · R reset · [ ] scrub proximity
  useEffect(() => {
    if (!started) return;
    const isForm = (e: KeyboardEvent) =>
      ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement | null)?.tagName ?? '');
    const onKey = (e: KeyboardEvent) => {
      if (isForm(e) || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'c') lab.rig = RIG_ORDER[(RIG_ORDER.indexOf(lab.rig) + 1) % RIG_ORDER.length];
      else if (k === 'p') { lab.face = rt.face = FACE_MAX; lab.squeeze = true; }
      else if (k === 'r') { lab.squeeze = false; lab.face = FACE_MAX; }
      else if (k === '[') { lab.squeeze = false; lab.face = Math.min(FACE_MAX, lab.face + 20); }
      else if (k === ']') { lab.squeeze = false; lab.face = Math.max(0, lab.face - 20); }
      else return;
      // the scene reads lab directly; nothing else to poke
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started]);

  return (
    <div className="swt-root">
      <div className="swt-canvas">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 8.5, 30], fov: 60, near: 0.3, far: 3200 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <TunerScene />
        </Canvas>
      </div>

      {started && (
        <>
          <TunerHud />
          <TunerPanel />
          <p className="swt-keys">
            <kbd>C</kbd> camera · <kbd>P</kbd> squeeze · <kbd>R</kbd> reset · <kbd>[</kbd>/<kbd>]</kbd> scrub proximity
          </p>
        </>
      )}

      {!started && (
        <div className="swt-splash">
          <div className="swt-splash-card panel">
            <div
              className="swt-splash-art"
              style={{ backgroundImage: `url(${withBase('images/work/storm-wall-tuner.jpg')})` }}
              role="img"
              aria-label="Concept art of a courier's ghost bike facing a towering wall of sand on a measured salt-pan rail"
            />
            <div className="swt-splash-body">
              <p className="swt-splash-kicker">Driftline workshed · VFX bench</p>
              <h1>Storm Wall Tuner</h1>
              <p>
                Storm season ships in chapter 3, and the wall has to read as terror at 600 m and as
                weather at zero — without spending the whole frame on stacked translucency. This
                bench pins the shipping wall to a rail so you can scrub proximity, time-of-day and
                quality presets, watch the real fog ramp and screen tint land, measure overdraw on a
                live 64² readback, then copy tuned constants straight into the game.
              </p>
              <button className="btn primary big" onClick={() => setStarted(true)}>
                Raise the wall
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = StormWallTuner as typeof StormWallTuner & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

/**
 * HANDLING CURVE LAB — the bike-feel tuning bench.
 *
 * A figure-eight salt pan (Bernoulli lemniscate, painted amber) with honest
 * grip zones — salt ×1.0 / sand ×0.8 / glass ×0.5 — where the *shipping*
 * hover-bike controller runs with its constants re-derived from the tuning
 * store every physics step (sliders + 0–3 upgrade ladders apply same-frame;
 * fixed feel constants are copied verbatim from src/game/Bike.tsx).
 * A scrolling scope strips speed / lateral slip / drift reward window /
 * boost over ~8 s, with a surface lane under it; ladder curve graphs draw
 * level-0→3 pips so headroom reads at a glance. 'Baseline' snaps back to
 * the shipping numbers; 'Copy settings JSON' exports the tune.
 *
 * Region-registry note (workshed policy): meta.json + anchors.json describe
 * a harmless off-world bench (centre 7400/6600) and the default export
 * carries meta/anchors statics — gameplay never streams it.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { bindInput } from '../../../input/input';
import { audio } from '../../../audio/audio';
import { withBase } from '../../../lib/base';
import { useTuning } from './params';
import LabBike from './LabBike';
import ChaseCam from './ChaseCam';
import { PanGround, Obstacles, HorizonRing, DustTrail, DustMotes } from './LabWorld';
import Panel from './Panel';
import { StatusChips, SpeedHud, ScopeStrip, HintBar } from './Hud';
import './handling-curve-lab.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function HandlingCurveLab() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    bindInput();
    // silence the lab bike's engine voice on the way out
    return () => {
      if (audio.ready) audio.updateVehicle(0, 0, false);
    };
  }, []);

  // R = respawn at the apex checkbar (bypasses text inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'r') useTuning.getState().bumpReset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="hcl-root">
      <Canvas
        className="hcl-canvas"
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 58, near: 0.3, far: 1600, position: [104, 7, -22] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#F0E7CE']} />
        <fog attach="fog" args={['#E9DCBE', 210, 800]} />

        <hemisphereLight args={['#FFF2DC', '#C99E66', 0.8]} />
        <directionalLight
          position={[120, 150, 60]}
          intensity={1.7}
          color="#FFE3B3"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-170}
          shadow-camera-right={170}
          shadow-camera-top={170}
          shadow-camera-bottom={-170}
          shadow-camera-near={20}
          shadow-camera-far={420}
          shadow-bias={-0.0004}
        />

        <Physics paused={!started} timeStep={1 / 60} gravity={[0, -9.81, 0]}>
          <PanGround />
          <Obstacles />
          <LabBike />
        </Physics>
        <HorizonRing />
        <DustTrail />
        <DustMotes />
        <ChaseCam />
      </Canvas>

      {started && (
        <>
          <Panel />
          <StatusChips />
          <ScopeStrip />
          <SpeedHud />
          <HintBar />
        </>
      )}

      {!started && (
        <div className="hcl-splash">
          <div className="hcl-splash-card panel">
            <div
              className="hcl-splash-art"
              style={{ backgroundImage: `url(${withBase('images/work/handling-curve-lab.jpg')})` }}
              role="img"
              aria-label="Concept art of a rust-red hover-bike carving a painted figure-eight on a salt pan"
            />
            <div className="hcl-splash-body">
              <h1>Handling Curve Lab</h1>
              <p>
                Every argument about bike feel ends here. Ride the painted eight — salt grips, sand
                scrubs, the teal glass lanes slide — while the scope strips your speed, slip, drift
                window and boost economy live. Then grab the sliders or fit ladder parts 0–3: the
                curves redraw, the feel changes the same frame, and <em>baseline</em> snaps you back
                to what shipped. Find the feel, copy the JSON.
              </p>
              <button
                className="btn primary big"
                onClick={() => {
                  audio.resume();
                  audio.blip(520, 0.08);
                  setStarted(true);
                }}
              >
                Ride the bench
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = HandlingCurveLab as typeof HandlingCurveLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;

/**
 * HOVER PLAYGROUND — a no-stakes hover-bike physics sandbox.
 * Bespoke salt-pan dunes map (not the main world); every bike parameter
 * is a live slider; presets snap the feel; R / button resets to spawn.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { bindInput } from '../../../input/input';
import { audio } from '../../../audio/audio';
import { withBase } from '../../../lib/base';
import SandBike from './SandBike';
import ChaseCam from './ChaseCam';
import { SandGround, Obstacles, HorizonRing, DustTrail, DustMotes } from './SandWorld';
import { Bench, StatsHud, HintBar } from './Bench';
import { useTuning } from './params';
import './hover-playground.css';

export { meta } from './meta';

export default function HoverPlayground() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    bindInput();
  }, []);

  // R = reset to spawn (bypasses text inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'r') {
        useTuning.getState().bumpReset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="hp-root">
      <Canvas
        className="hp-canvas"
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 58, near: 0.3, far: 1600, position: [0, 6, 84] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#F0E7CE']} />
        <fog attach="fog" args={['#E9DCBE', 200, 780]} />

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
          <SandGround />
          <Obstacles />
          <SandBike />
        </Physics>
        <HorizonRing />
        <DustTrail />
        <DustMotes />
        <ChaseCam />
      </Canvas>

      {started && (
        <>
          <Bench />
          <StatsHud />
          <HintBar />
        </>
      )}

      {!started && (
        <div className="hp-splash">
          <div className="hp-splash-card panel">
            <div
              className="hp-splash-art"
              style={{ backgroundImage: `url(${withBase('images/work/hover-playground.jpg')})` }}
              role="img"
              aria-label="Concept art of a hover-bike on a gridded salt pan"
            />
            <div className="hp-splash-body">
              <h1>Hover Playground</h1>
              <p>
                A no-stakes bench for the Driftline hover-bike. Ride the gridded salt pan, slide the
                glass lane, hit the kickers — then grab the sliders and tune hover spring, grip,
                boost and drift until it feels like <em>yours</em>. Changes apply the same frame.
              </p>
              <button
                className="btn primary big"
                onClick={() => {
                  audio.resume();
                  audio.blip(520, 0.08);
                  setStarted(true);
                }}
              >
                Start tuning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

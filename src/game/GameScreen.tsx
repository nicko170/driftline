/**
 * /play — the game screen. R3F canvas + React DOM HUD/overlays.
 */
import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { useNavigate } from 'react-router-dom';
import Terrain from './Terrain';
import Bike from './Bike';
import CameraRig from './CameraRig';
import Sky from './Sky';
import DustTrail from './DustTrail';
import MissionDirector from './MissionDirector';
import InteractionSystem from './InteractionSystem';
import RegionStream, { RegionColliders } from './RegionStream';
import HUD from '../ui/HUD';
import MissionBoard from '../ui/MissionBoard';
import GaragePanel from '../ui/GaragePanel';
import DialogueBox from '../ui/DialogueBox';
import PauseMenu from '../ui/PauseMenu';
import TouchControls from '../ui/TouchControls';
import { bindInput, consume } from '../input/input';
import { useGameStore, useSaveStore } from '../state/store';
import { audio } from '../audio/audio';

export default function GameScreen() {
  const navigate = useNavigate();
  const quality = useSaveStore((s) => s.settings.quality);
  const physicsPaused = useGameStore((s) => s.physicsPaused);
  const mode = useGameStore((s) => s.mode);

  useEffect(() => {
    bindInput();
    audio.resume();
  }, []);

  // pause key handling (edge-triggered, polled lightly)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!consume('pause')) return;
      const g = useGameStore.getState();
      if (g.mode === 'riding') {
        g.setMode('paused');
        g.setPhysicsPaused(true);
        audio.blip(440, 0.09);
      } else if (g.mode === 'paused') {
        g.setMode('riding');
        g.setPhysicsPaused(false);
      } else {
        g.setMode('riding'); // close board/garage/dialogue overlays
      }
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  // audio volume follows settings
  const volume = useSaveStore((s) => s.settings.volume);
  const muted = useSaveStore((s) => s.settings.muted);
  useEffect(() => {
    audio.setVolume(volume);
    audio.setMuted(muted);
  }, [volume, muted]);

  const dpr = quality === 'low' ? [0.75, 1] : quality === 'medium' ? [1, 1.5] : [1, 2];

  return (
    <div className="game-screen">
      <Canvas
        className="game-canvas"
        shadows={quality !== 'low'}
        dpr={dpr as [number, number]}
        camera={{ fov: 60, near: 0.3, far: 3200, position: [0, 8, 24] }}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Sky />
          <Physics paused={physicsPaused} timeStep={1 / 60} gravity={[0, -9.81, 0]}>
            <Terrain />
            <RegionColliders />
            <Bike />
          </Physics>
          <RegionStream />
          <MissionDirector />
          <InteractionSystem />
          <DustTrail />
          <CameraRig />
        </Suspense>
      </Canvas>

      <HUD />
      <TouchControls />
      {mode === 'board' && <MissionBoard />}
      {mode === 'garage' && <GaragePanel />}
      {mode === 'dialogue' && <DialogueBox />}
      {mode === 'paused' && (
        <PauseMenu
          onQuitToTitle={() => {
            useGameStore.getState().setPhysicsPaused(false);
            useGameStore.getState().setMode('riding');
            navigate('/');
          }}
        />
      )}
    </div>
  );
}

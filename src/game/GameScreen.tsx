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
import AmbientTraffic from './AmbientTraffic';
import SignalCaches from './SignalCaches';
import HUD from '../ui/HUD';
import MissionBoard from '../ui/MissionBoard';
import GaragePanel from '../ui/GaragePanel';
import ExchangePanel from '../ui/ExchangePanel';
import DialogueBox from '../ui/DialogueBox';
import PauseMenu from '../ui/PauseMenu';
import TouchControls from '../ui/TouchControls';
import ChapterCard from '../ui/ChapterCard';
import ChapterOutroCard from '../ui/ChapterOutroCard';
import DepartureScreen from '../ui/DepartureScreen';
import Effects from './Effects';
import { FrameBeacon } from './frameBeacon';
import { currentChapter } from '../missions/chapters';
import { bindInput, consume } from '../input/input';
import { useGameStore, useSaveStore } from '../state/store';
import { audio } from '../audio/audio';
import { evaluateAchievements } from './achievements';
import { ensureOnWorldRegions } from '../world/registry';

export default function GameScreen() {
  const navigate = useNavigate();
  const quality = useSaveStore((s) => s.settings.quality);
  const physicsPaused = useGameStore((s) => s.physicsPaused);
  const mode = useGameStore((s) => s.mode);

  useEffect(() => {
    bindInput();
    audio.resume();
    evaluateAchievements(); // catch any save-state unlocks from a previous session
    ensureOnWorldRegions(); // lazy region modules: props + colliders stream in behind rapier
  }, []);

  // pause key handling (edge-triggered, polled lightly)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!consume('pause')) return;
      // a pending chapter card owns Esc/E
      const save = useSaveStore.getState();
      const pendingChapter = (() => {
        const { chapter } = currentChapter(save.missionsDone);
        return chapter >= 1 && !save.chaptersSeen.includes(chapter) ? chapter : null;
      })();
      if (pendingChapter !== null) return;
      const g = useGameStore.getState();
      // a chapter-outro debrief card owns Esc too
      if (g.chapterOutro !== null && g.mode === 'riding') return;
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
          <FrameBeacon />
          <Sky />
          <Physics paused={physicsPaused} timeStep={1 / 60} gravity={[0, -9.81, 0]}>
            <Terrain />
            <RegionColliders />
            <Bike />
          </Physics>
          <RegionStream />
          <AmbientTraffic />
          <SignalCaches />
          <MissionDirector />
          <InteractionSystem />
          <DustTrail />
          <CameraRig />
          {quality === 'high' && <Effects />}
        </Suspense>
      </Canvas>

      <HUD />
      <TouchControls />
      <ChapterCard />
      <ChapterOutroCard />
      <DepartureScreen />
      {mode === 'board' && <MissionBoard />}
      {mode === 'garage' && <GaragePanel />}
      {mode === 'exchange' && <ExchangePanel />}
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

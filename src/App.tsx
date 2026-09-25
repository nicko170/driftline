import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import TitleScreen from './ui/TitleScreen';
import CreditsScreen from './ui/CreditsScreen';
import { LabRoutes } from './lab/Lab';
import { audio } from './audio/audio';

const GameScreen = lazy(() => import('./game/GameScreen'));
const CodexScreen = lazy(() => import('./ui/CodexScreen'));

function Splash() {
  return <div className="boot">DRIFTLINE</div>;
}

export default function App() {
  // audio needs a user gesture; prepare on first interaction anywhere
  useEffect(() => {
    const warm = () => audio.resume();
    window.addEventListener('pointerdown', warm, { once: true });
    window.addEventListener('keydown', warm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
    };
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/" element={<TitleScreen />} />
          <Route path="/play" element={<GameScreen />} />
          <Route path="/codex" element={<CodexScreen />} />
          <Route path="/credits" element={<CreditsScreen />} />
          <Route path="/lab/*" element={<LabRoutes />} />
          <Route path="*" element={<TitleScreen />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

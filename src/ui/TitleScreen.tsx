/** Title screen — key art, menu, colophon. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSaveStore } from '../state/store';
import { useGameStore } from '../state/store';
import { withBase } from '../lib/base';
import { endingFor } from '../missions/endings';
import { audio } from '../audio/audio';

export default function TitleScreen() {
  const navigate = useNavigate();
  const hasSave = useSaveStore((s) => s.hasSave);
  const flags = useSaveStore((s) => s.flags);
  const newGame = useSaveStore((s) => s.newGame);
  const [confirmNew, setConfirmNew] = useState(false);
  const ending = endingFor(flags);

  const play = () => {
    audio.resume();
    audio.blip(880, 0.1);
    useGameStore.getState().setPhysicsPaused(false);
    useGameStore.getState().setMode('riding');
    navigate('/play');
  };

  return (
    <div className="title-screen" style={{ backgroundImage: `url(${withBase('images/title/keyart.jpg')})` }}>
      <div className="title-scrim" />
      <main className="title-main">
        <p className="title-kicker">KESSA-9 · THE GLASS DESERT</p>
        <h1 className="title-logo">DRIFTLINE</h1>
        <p className="title-tag">
          Any crate. Any storm. Any door. — You're Ash Varga: a new courier with a second-hand
          hover-bike, a debt, and a package that shouldn't exist.
        </p>
        {ending && (
          <aside className="title-epilogue panel">
            <span className="title-epilogue-kicker">{ending.kicker}</span>
            <strong className="title-epilogue-title">{ending.title}</strong>
            <p>{ending.text}</p>
            <p className="dim">{ending.coda}</p>
          </aside>
        )}
        <nav className="title-menu" aria-label="Main menu">
          {hasSave && !confirmNew && (
            <button className="btn primary big" onClick={play}>▶ Play — continue the run</button>
          )}
          {(!hasSave || confirmNew) && (
            <button className="btn primary big" onClick={() => { newGame(); play(); }}>▶ Play — new run</button>
          )}
          {hasSave && !confirmNew && (
            <button className="btn" onClick={() => setConfirmNew(true)}>New run</button>
          )}
          {confirmNew && <button className="btn" onClick={() => setConfirmNew(false)}>Keep my save</button>}
          <Link className="btn" to="/codex">Codex</Link>
          <Link className="btn" to="/logbook">Logbook</Link>
          <Link className="btn" to="/lab">Lab</Link>
          <Link className="btn" to="/credits">Credits</Link>
        </nav>
        <p className="title-hint">
          <kbd>W A S D</kbd> ride · <kbd>Shift</kbd> boost · <kbd>Space</kbd> hop · <kbd>E</kbd> interact · gamepad & touch supported
        </p>
      </main>
      <footer className="title-foot">
        DRIFTLINE was designed and built autonomously by Kimi K3 running on GreenThread.
      </footer>
    </div>
  );
}

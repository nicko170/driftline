import { Link } from 'react-router-dom';

export default function CreditsScreen() {
  return (
    <div className="credits-screen">
      <div className="sheet">
        <header className="sheet-head">
          <h1>Credits</h1>
        </header>
        <div className="credits-body">
          <p><strong>DRIFTLINE</strong> — a hover-bike courier adventure set on Kessa-9.</p>
          <p>
            Designed and built autonomously by <strong>Kimi K3</strong> running on{' '}
            <strong>GreenThread</strong>: game design, art direction, code, writing, key art and
            audio — every part of it.
          </p>
          <p>
            Built with React, TypeScript, Vite, React Three Fiber, drei, rapier, zustand and the
            Web Audio API. No art assets were downloaded; images are generated, every sound is
            synthesised, and the world is procedural.
          </p>
          <p className="dim">
            For the couriers who ride between the lights. Flat salt and a following wind.
          </p>
          <Link className="btn" to="/">← Back to title</Link>
        </div>
      </div>
    </div>
  );
}

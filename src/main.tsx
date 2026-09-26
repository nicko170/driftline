import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/ui.css';

// Dev/QA affordances: capture ?skyt=<t> / #skyt=<t> and ?dbg at bootstrap into
// sessionStorage — SPA navigation (/ → /play) drops the query/hash before the
// game modules run, so Sky/GameScreen read the stashed values instead.
// (Used by night-riding playtests; no effect on normal play.)
try {
  const src = location.search + '&' + location.hash;
  const m = /[?&#]skyt=([0-9.]+)/.exec(src);
  if (m) sessionStorage.setItem('dev.skyt', m[1]);
  if (/[?&#]dbg/.test(src)) sessionStorage.setItem('dev.dbg', '1');
} catch {
  /* storage unavailable — dev flags simply off */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

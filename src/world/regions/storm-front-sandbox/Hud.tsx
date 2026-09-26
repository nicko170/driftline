/**
 * Storm Front Sandbox — in-canvas HUD chrome as DOM overlays.
 *
 * Everything updates from a single rAF loop writing to refs — zero React
 * re-renders per frame. Mirrors the game's storm language: danger-red threat
 * readout, amber objective, teal shelter. The full-screen ochre tint follows
 * wall intensity so you can tune the "inside the murk" feel.
 */
import { useEffect, useRef } from 'react';
import { bike, lab, stats, storm } from './state';

export function SandboxHud() {
  const speedEl = useRef<HTMLSpanElement>(null);
  const speedKmh = useRef<HTMLSpanElement>(null);
  const faceEl = useRef<HTMLSpanElement>(null);
  const faceBar = useRef<HTMLDivElement>(null);
  const statusEl = useRef<HTMLSpanElement>(null);
  const msgEl = useRef<HTMLDivElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const marginEl = useRef<HTMLSpanElement>(null);
  const tintEl = useRef<HTMLDivElement>(null);
  const rootEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastMsg = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = Math.abs(bike.speed);
      if (speedEl.current) speedEl.current.textContent = s.toFixed(0);
      if (speedKmh.current) speedKmh.current.textContent = (s * 3.6).toFixed(0);
      if (faceEl.current) faceEl.current.textContent = storm.active ? `${Math.max(0, storm.face).toFixed(0)}m` : '—';
      if (faceBar.current) {
        const frac = storm.active ? Math.max(0, Math.min(1, storm.face / lab.spawnBack)) : 0;
        faceBar.current.style.width = `${frac * 100}%`;
        faceBar.current.classList.toggle('is-close', storm.active && storm.face < 90);
      }
      if (statusEl.current) {
        const statusText: Record<string, string> = {
          free: 'CALM AIR',
          hunt: 'THE WALL HUNTS',
          caught: 'SWALLOWED',
          sheltered: 'SHELTERED',
        };
        statusEl.current.textContent = statusText[stats.status] ?? stats.status;
        statusEl.current.parentElement?.setAttribute('data-status', stats.status);
      }
      if (timeEl.current) timeEl.current.textContent = stats.runTime > 0 ? `${stats.runTime.toFixed(1)}s` : '—';
      if (marginEl.current) {
        marginEl.current.textContent = storm.active ? `${stats.margin >= 0 ? '+' : ''}${stats.margin.toFixed(1)} m/s` : '—';
        marginEl.current.classList.toggle('is-bad', storm.active && stats.margin < 0);
      }
      const msg = performance.now() < stats.msgUntil ? stats.msg : '';
      if (msg !== lastMsg) {
        lastMsg = msg;
        if (msgEl.current) msgEl.current.textContent = msg;
      }
      if (msgEl.current) msgEl.current.style.opacity = msg ? '1' : '0';
      if (tintEl.current) {
        const t = Math.min(0.86, storm.intensity * storm.intensity * 1.05 * lab.density);
        tintEl.current.style.opacity = t.toFixed(3);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="sfs-hud" ref={rootEl} aria-hidden="true">
      <div ref={tintEl} className="sfs-tint" />
      <div className="sfs-topline">
        <span className="sfs-status" data-status="free">
          <i className="sfs-dot" />
          <span ref={statusEl}>CALM AIR</span>
        </span>
        <div className="sfs-facewrap">
          <span className="sfs-facelabel">FACE</span>
          <div className="sfs-facebar"><div ref={faceBar} className="sfs-facefill" /></div>
          <span className="sfs-faceval" ref={faceEl}>—</span>
        </div>
        <span className="sfs-margin" ref={marginEl}>—</span>
      </div>
      <div ref={msgEl} className="sfs-msg" />
      <div className="sfs-speedtape">
        <span className="sfs-speednum" ref={speedEl}>0</span>
        <span className="sfs-speedunit">m/s · <b ref={speedKmh}>0</b> km/h</span>
        <span className="sfs-timer">RUN <b ref={timeEl}>—</b></span>
      </div>
      <p className="sfs-keys">WASD ride · SHIFT boost · SPACE hop · C camera · R release the wall</p>
    </div>
  );
}

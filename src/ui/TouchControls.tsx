/**
 * Touch controls — shown only on touch devices. Left stick = steer+throttle,
 * right side: boost & hop buttons. Writes straight into the shared input state.
 */
import { useRef, useState } from 'react';
import { input } from '../input/input';
import { useGameStore } from '../state/store';

export default function TouchControls() {
  const [enabled] = useState(() => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  const stick = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mode = useGameStore((s) => s.mode);

  if (!enabled || mode !== 'riding') return null;

  const setStick = (dx: number, dy: number) => {
    const r = 52;
    const nx = Math.max(-1, Math.min(1, dx / r));
    const ny = Math.max(-1, Math.min(1, dy / r));
    input.steer = nx;
    input.throttle = Math.max(0, -ny);
    input.brake = Math.max(0, ny);
    const nub = stick.current?.querySelector('.touch-stick-nub') as HTMLElement | null;
    if (nub) nub.style.transform = `translate(${nx * r * 0.55}px, ${ny * r * 0.55}px)`;
  };

  return (
    <div className="touch">
      <div
        ref={stick}
        className="touch-stick"
        onTouchStart={(e) => {
          const t = e.changedTouches[0];
          active.current = t.identifier;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }}
        onTouchMove={(e) => {
          for (const t of Array.from(e.changedTouches)) {
            if (t.identifier === active.current) setStick(t.clientX - origin.current.x, t.clientY - origin.current.y);
          }
        }}
        onTouchEnd={(e) => {
          for (const t of Array.from(e.changedTouches)) {
            if (t.identifier === active.current) {
              active.current = null;
              setStick(0, 0);
            }
          }
        }}
      >
        <div className="touch-stick-nub" />
      </div>
      <div className="touch-buttons">
        <button
          className="touch-btn"
          onTouchStart={(e) => { e.preventDefault(); input.boost = true; }}
          onTouchEnd={() => { input.boost = false; }}
        >
          BOOST
        </button>
        <button className="touch-btn" onTouchStart={(e) => { e.preventDefault(); input.hop = true; }}>
          HOP
        </button>
        <button className="touch-btn small" onClick={() => { input.interact = true; }}>
          E
        </button>
        <button className="touch-btn small" onClick={() => { input.pause = true; }}>
          ❚❚
        </button>
      </div>
    </div>
  );
}

/**
 * Dial.tsx — rotary tuning knob (pointer-drag + wheel), with an accessible
 * hidden range input carrying the same value for keyboard/AT users.
 */
import { useEffect, useRef } from 'react';
import { BAND_HI, BAND_LO, STATIONS, clampFreq } from './engine';

export interface DialProps {
  freq: number;
  onFreq: (f: number) => void;
}

const TICKS = 28;

export function Dial({ freq, onFreq }: DialProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x0: number; y0: number; f0: number } | null>(null);
  const freqRef = useRef(freq);
  freqRef.current = freq;

  // non-passive wheel so we can preventDefault page scroll
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = (e.deltaY > 0 ? -1 : 1) * (e.shiftKey ? 1 : 0.2);
      onFreq(clampFreq(freqRef.current + step));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onFreq]);

  const angle = -135 + ((freq - BAND_LO) / (BAND_HI - BAND_LO)) * 270;

  return (
    <div className="rsv-dial">
      <div
        ref={wrapRef}
        className="rsv-knob-wrap"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { x0: e.clientX, y0: e.clientY, f0: freqRef.current };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          const df = (d.y0 - e.clientY) * 0.06 + (e.clientX - d.x0) * 0.02;
          onFreq(clampFreq(d.f0 + df));
        }}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
      >
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i} className="rsv-tick" style={{ transform: `rotate(${(i / TICKS) * 360}deg)` }} />
        ))}
        {STATIONS.map((s) => {
          const a = -135 + ((s.freq - BAND_LO) / (BAND_HI - BAND_LO)) * 270;
          return (
            <span
              key={s.id}
              className={`rsv-tick-station${s.id === 'mother' ? ' is-mother' : ''}`}
              style={{ transform: `rotate(${a}deg)` }}
            />
          );
        })}
        <div className="rsv-knob" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="rsv-knob-notch" />
        </div>
      </div>
      <input
        className="rsv-sr"
        type="range"
        min={BAND_LO}
        max={BAND_HI}
        step={0.05}
        value={freq}
        aria-label="Radio frequency in megahertz"
        onChange={(e) => onFreq(clampFreq(Number(e.target.value)))}
      />
      <div className="rsv-freq-row">
        <span className="rsv-freq">{freq.toFixed(2)}</span>
        <span className="rsv-mhz">MHz · LW·7</span>
      </div>
      <div className="rsv-step-row">
        <button type="button" className="rsv-step" onClick={() => onFreq(clampFreq(freq - 1))}>−1</button>
        <button type="button" className="rsv-step" onClick={() => onFreq(clampFreq(freq - 0.1))}>−0.1</button>
        <button type="button" className="rsv-step" onClick={() => onFreq(clampFreq(freq + 0.1))}>+0.1</button>
        <button type="button" className="rsv-step" onClick={() => onFreq(clampFreq(freq + 1))}>+1</button>
      </div>
    </div>
  );
}

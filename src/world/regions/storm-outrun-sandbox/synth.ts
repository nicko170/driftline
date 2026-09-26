/**
 * STORM OUTRUN SANDBOX — procedural wind/rumble, tuned by the mix sliders.
 *
 * Mirrors src/audio/audio.ts `setStorm(intensity)`: a brown-noise rumble bed
 * through a lowpass plus a bandpassed white-noise wind layer, both gain +
 * pitch driven by storm intensity with a setTargetAtTime ease. Every constant
 * is live from `lab` (rumbleMax / windMax / rumbleHzMin / rumbleHzAdd /
 * easeTc) so the mix itself is what's being tuned. Parameter writes are
 * throttled to ~12 Hz to keep the automation list short.
 */
import { lab } from './sim';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let rumbleGain: GainNode | null = null;
let rumbleFilter: BiquadFilterNode | null = null;
let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;
let muted = false;
let lastDrive = 0;

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < len; i++) {
    if (brown) {
      v = (v + (Math.random() * 2 - 1) * 0.02) * 0.998;
      ch[i] = v * 3.2;
    } else {
      ch[i] = Math.random() * 2 - 1;
    }
  }
  return buf;
}

function ensure(): boolean {
  if (ac) return true;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  ac = new Ctor();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.85;
  master.connect(ac.destination);

  // rumble bed (the wall itself)
  const rum = ac.createBufferSource();
  rum.buffer = noiseBuffer(ac, 4, true);
  rum.loop = true;
  rumbleFilter = ac.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 160;
  rumbleGain = ac.createGain();
  rumbleGain.gain.value = 0;
  rum.connect(rumbleFilter).connect(rumbleGain).connect(master);
  rum.start();

  // wind layer (speed + storm howl)
  const win = ac.createBufferSource();
  win.buffer = noiseBuffer(ac, 3, false);
  win.loop = true;
  windFilter = ac.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 620;
  windFilter.Q.value = 0.8;
  windGain = ac.createGain();
  windGain.gain.value = 0;
  win.connect(windFilter).connect(windGain).connect(master);
  win.start();
  return true;
}

export const synth = {
  start() {
    if (!ensure()) return;
    void ac?.resume();
  },
  stop() {
    if (!ac) return;
    const t = ac.currentTime;
    rumbleGain?.gain.setTargetAtTime(0, t, 0.1);
    windGain?.gain.setTargetAtTime(0, t, 0.1);
    void ac.suspend();
  },
  setMuted(m: boolean) {
    muted = m;
    if (ac && master) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.05);
  },
  isMuted() {
    return muted;
  },
  /** UI blip — panel presses, tape restart. */
  tick(freq = 660, dur = 0.09, vol = 0.05) {
    if (!ensure() || !ac || !master) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  /** Outcome stamp: two-note chime (escaped) or low thud (taken). */
  stamp(escaped: boolean) {
    if (!ensure() || !ac || !master) return;
    if (escaped) {
      this.tick(720, 0.1, 0.05);
      window.setTimeout(() => this.tick(1080, 0.14, 0.05), 110);
    } else {
      this.tick(96, 0.35, 0.12);
    }
  },
  /**
   * Per-frame drive. `intensity` 0..1 follows the shipped ramp
   * (clamp01(1 − face / audioRange)) computed by the caller; the MIX is lab's.
   */
  drive(intensity: number, speedFrac: number) {
    if (!ac || !rumbleGain || !windGain || !rumbleFilter || !windFilter) return;
    const now = performance.now();
    if (now - lastDrive < 80) return;
    lastDrive = now;
    const t = ac.currentTime;
    const i = Math.min(1, Math.max(0, intensity));
    const tc = Math.max(0.05, lab.easeTc);
    rumbleGain.gain.setTargetAtTime(Math.min(lab.rumbleMax, i * lab.rumbleMax), t, tc);
    rumbleFilter.frequency.setTargetAtTime(120 + i * 160, t, tc * 1.3);
    const rumbleHz = lab.rumbleHzMin + i * lab.rumbleHzAdd;
    // ride the lowpass floor with the tuned rumble band so pitch is audible
    windFilter.frequency.setTargetAtTime(400 + speedFrac * 26 * 30 + rumbleHz * 3, t, tc);
    windGain.gain.setTargetAtTime(Math.min(lab.windMax, Math.max(i * lab.windMax, speedFrac * 0.16)), t, tc);
  },
};

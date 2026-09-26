/**
 * A small procedural radio-static bed for the slow-read mode.
 * White noise through a wandering bandpass, a faint station carrier, and a
 * per-word crackle tick on word boundaries. Own AudioContext so the game's
 * engine mix is untouched; level honours save settings at start().
 */
import { useSaveStore } from '../../../state/store';

class StaticBed {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private level = 0.05;

  get running(): boolean {
    return !!this.ctx;
  }

  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const { volume, muted } = useSaveStore.getState().settings;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // hiss: looped noise through a slowly wandering bandpass
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.8;
    const hiss = ctx.createGain();
    hiss.gain.value = 0.5;
    src.connect(bp);
    bp.connect(hiss);
    hiss.connect(master);
    src.start();

    // carrier: a faint station somewhere on band nine
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 96;
    const cg = ctx.createGain();
    cg.gain.value = 0.07;
    carrier.connect(cg);
    cg.connect(master);
    carrier.start();

    // wander
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 420;
    lfo.connect(lg);
    lg.connect(bp.frequency);
    lfo.start();

    this.level = 0.05 * (muted ? 0 : volume);
    master.gain.setTargetAtTime(this.level, ctx.currentTime, 0.7);
    this.ctx = ctx;
    this.master = master;
  }

  /** Word-boundary tick — a tiny radio ping riding over the hiss. */
  crackle(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1400 + Math.random() * 1100, t);
    o.frequency.exponentialRampToValueAtTime(280, t + 0.03);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }

  stop(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    this.ctx = null;
    this.master = null;
    window.setTimeout(() => void ctx.close().catch(() => undefined), 700);
  }
}

export const staticBed = new StaticBed();

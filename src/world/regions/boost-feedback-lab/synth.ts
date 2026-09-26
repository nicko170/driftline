/**
 * A small, self-contained engine voice for the lab. Deliberately separate from
 * src/audio/audio.ts (the game singleton): the bench needs to audition
 * *candidate* pitch mappings, so the pitch comes in pre-computed. Gain is kept
 * modest — this is a tuning room, not a launch pad.
 */
export class BoostSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private sub: OscillatorNode | null = null;
  private subGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private muted = false;

  get running(): boolean {
    return !!this.ctx;
  }

  /** Create on a user gesture; safe to call repeatedly. */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // engine: saw → lowpass, plus a sine sub an octave down
    const engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 60;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 850;
    engineFilter.Q.value = 1.1;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 30;
    const subGain = ctx.createGain();
    subGain.gain.value = 0;
    sub.connect(subGain);
    subGain.connect(master);

    engine.start();
    sub.start();

    // wind: looped noise through a band-pass that opens with speed
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    noise.start();

    this.ctx = ctx;
    this.master = master;
    this.engine = engine;
    this.engineFilter = engineFilter;
    this.engineGain = engineGain;
    this.sub = sub;
    this.subGain = subGain;
    this.windGain = windGain;
    this.windFilter = windFilter;
  }

  /** Per-frame update. pitch comes from the selected candidate curve. */
  update(pitch: number, speedNorm: number, boosting: boolean): void {
    if (!this.ctx || !this.engine || !this.sub) return;
    const t = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(Math.max(20, pitch), t, 0.05);
    this.sub.frequency.setTargetAtTime(Math.max(12, pitch * 0.5), t, 0.06);
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(650 + speedNorm * 1400 + (boosting ? 500 : 0), t, 0.12);
    }
    if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(0.045 + speedNorm * 0.05 + (boosting ? 0.035 : 0), t, 0.08);
    }
    if (this.subGain) {
      this.subGain.gain.setTargetAtTime(0.05 + speedNorm * 0.04, t, 0.1);
    }
    if (this.windGain && this.windFilter) {
      this.windGain.gain.setTargetAtTime(Math.min(0.16, speedNorm * 0.2), t, 0.2);
      this.windFilter.frequency.setTargetAtTime(380 + speedNorm * 1500, t, 0.25);
    }
  }

  /** Little tick for HUD events (charge cells popping). */
  tick(freq = 1500, dur = 0.035, vol = 0.04): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  stop(): void {
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.sub = null;
    this.subGain = null;
    this.windGain = null;
    this.windFilter = null;
  }
}

/** One synth per lab mount. */
export const synth = new BoostSynth();

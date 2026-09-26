/**
 * A compact bench voice for the cargo lab: a quiet engine hum that spools when
 * the ghost bike runs, impact thuds scaled to damage, a soft tick for soaked or
 * sub-threshold grazes, and a two-note chime when a run finishes. Deliberately
 * separate from the game's audio singleton — this is a tuning room.
 */
export class CargoSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
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
    master.gain.value = this.muted ? 0 : 0.85;
    master.connect(ctx.destination);

    const engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 62;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    engine.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    engine.start();

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.engine = engine;
    this.engineGain = gain;
    this.engineFilter = filter;
    this.noiseBuf = buf;
  }

  /** Per-frame hum update: running spools the pitch and opens the filter. */
  update(runningNow: boolean, airborne: boolean): void {
    if (!this.ctx || !this.engine || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(runningNow ? (airborne ? 96 : 74) : 58, t, 0.18);
    this.engineFilter.frequency.setTargetAtTime(runningNow ? 820 : 480, t, 0.2);
    this.engineGain.gain.setTargetAtTime(runningNow ? 0.055 : 0.02, t, 0.25);
  }

  /** Impact thud: noise burst + low sine drop, strength 0..1. */
  thud(strength: number): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = Math.min(1, Math.max(0, strength));

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 900 + s * 1400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.16 + s * 0.22, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + s * 0.1);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(this.master);
    noise.start(t, Math.random());
    noise.stop(t + 0.3);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140 + s * 60, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22 + s * 0.3, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(og);
    og.connect(this.master);
    o.start(t);
    o.stop(t + 0.26);
  }

  /** A small tick: soaked or sub-threshold contact. */
  tick(freq = 1100, vol = 0.045): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.07);
  }

  /** Run-complete chime — higher if the cargo survived intact, low if shattered. */
  chime(intact: boolean): void {
    if (!this.ctx || !this.master) return;
    const base = intact ? 660 : 330;
    for (let i = 0; i < 2; i++) {
      const t = this.ctx.currentTime + i * 0.14;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * (i === 0 ? 1 : 1.5);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.34);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  stop(): void {
    if (this.ctx) void this.ctx.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.noiseBuf = null;
  }
}

/** One synth per lab mount. */
export const synth = new CargoSynth();

/**
 * Procedural WebAudio: engine hum (pitch follows speed), wind, boost rush,
 * UI blips and a slow ambient pad. No samples, no assets. Created lazily on
 * first user gesture to satisfy autoplay policies.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private padGain: GainNode | null = null;
  private stormGain: GainNode | null = null;
  private stormOsc: OscillatorNode | null = null;
  private volume = 0.8;
  private muted = false;

  get ready(): boolean {
    return !!this.ctx;
  }

  init(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.applyVolume();

    // Engine: detuned saw + sub sine through a lowpass
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 480;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 55;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 27;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.6;
    saw.connect(engineFilter);
    sub.connect(subGain);
    subGain.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(this.master);
    saw.start();
    sub.start();
    this.engineOsc = saw;
    this.engineSub = sub;
    this.engineGain = engineGain;

    // Wind: looped noise through bandpass
    const noiseLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.master);
    noise.start();
    this.windGain = windGain;
    this.windFilter = windFilter;

    // Ambient pad: slow detuned triangles, very quiet
    const padGain = ctx.createGain();
    padGain.gain.value = 0.045;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 320;
    const freqs = [110, 164.8, 220.5];
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain();
      g.gain.value = 0.33;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.14;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      o.connect(g);
      g.connect(padFilter);
      o.start();
      lfo.start();
    }
    padFilter.connect(padGain);
    padGain.connect(this.master);
    this.padGain = padGain;

    // Storm: low detuned rumble + howl, gain driven by proximity
    const stormGain = ctx.createGain();
    stormGain.gain.value = 0;
    const stormOsc = ctx.createOscillator();
    stormOsc.type = 'sine';
    stormOsc.frequency.value = 38;
    const stormOsc2 = ctx.createOscillator();
    stormOsc2.type = 'sawtooth';
    stormOsc2.frequency.value = 61;
    const stormFilter = ctx.createBiquadFilter();
    stormFilter.type = 'lowpass';
    stormFilter.frequency.value = 160;
    stormOsc.connect(stormFilter);
    stormOsc2.connect(stormFilter);
    stormFilter.connect(stormGain);
    stormGain.connect(this.master);
    stormOsc.start();
    stormOsc2.start();
    this.stormGain = stormGain;
    this.stormOsc = stormOsc;
  }

  /** Storm rumble intensity 0..1 (0 = silent). Called per-frame while a storm objective is live. */
  setStorm(intensity: number): void {
    if (!this.ctx || !this.stormGain || !this.stormOsc) return;
    const t = this.ctx.currentTime;
    this.stormGain.gain.setTargetAtTime(Math.min(0.22, intensity * 0.22), t, 0.3);
    this.stormOsc.frequency.setTargetAtTime(34 + intensity * 22, t, 0.4);
    if (this.windGain) {
      const w = Math.min(0.3, intensity * 0.24);
      this.windGain.gain.setTargetAtTime(Math.max(w, this.windGain.gain.value), t, 0.3);
    }
  }

  resume(): void {
    this.init();
    void this.ctx?.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master && this.ctx) {
      const target = this.muted ? 0 : this.volume * 0.9;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  /** Called every frame from the bike loop. speed m/s, throttle 0..1. */
  updateVehicle(speed: number, throttle: number, boosting: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineSub) return;
    const t = this.ctx.currentTime;
    const pitch = 46 + speed * 3.1 + throttle * 14 + (boosting ? 26 : 0);
    this.engineOsc.frequency.setTargetAtTime(pitch, t, 0.06);
    this.engineSub.frequency.setTargetAtTime(pitch * 0.5, t, 0.06);
    const vol = 0.028 + throttle * 0.05 + Math.min(0.05, speed * 0.0012) + (boosting ? 0.03 : 0);
    this.engineGain.gain.setTargetAtTime(vol, t, 0.08);
    if (this.windGain && this.windFilter) {
      const w = Math.min(0.16, speed * 0.0042);
      this.windGain.gain.setTargetAtTime(w, t, 0.15);
      this.windFilter.frequency.setTargetAtTime(400 + speed * 26, t, 0.2);
    }
  }

  /** Short UI blip. */
  blip(freq = 880, dur = 0.07): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  radioBlip(): void {
    this.blip(1240, 0.05);
    setTimeout(() => this.blip(940, 0.06), 70);
  }

  /** Impact thud scaled by intensity 0..1. */
  thud(intensity: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90 + intensity * 40, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.4, intensity * 0.4), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  /** Objective-complete chime. */
  chime(): void {
    this.blip(660, 0.12);
    setTimeout(() => this.blip(880, 0.12), 90);
    setTimeout(() => this.blip(1320, 0.18), 190);
  }
}

export const audio = new AudioEngine();

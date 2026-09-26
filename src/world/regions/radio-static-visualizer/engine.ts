/**
 * engine.ts — procedural WebAudio "Band Seven" longwave set.
 *
 * One lazily-summoned AudioContext. Four stations live in the 76–104 band, each a
 * small synthesized voice (filtered noise, beating hymn chord, telegraph beeps,
 * a nine-second breath). Tuning strength mixes each voice against a static bed;
 * occasionally a ghost-harmonic rises a fifth above whatever you locked onto.
 *
 * No per-frame allocations: automation is rate-limited + housekeeping-cancelled,
 * and the scope reads into caller-owned scratch buffers.
 */

export type StationId = 'storm' | 'choir' | 'guild' | 'mother';

export interface Station {
  id: StationId;
  freq: number; // dial MHz
  name: string;
  key: string; // tiny licence-plate line
  hint: string;
}

export const BAND_LO = 76;
export const BAND_HI = 104;
const SKIRT = 1.8; // MHz — how far off-centre a station stays audible
export const LOCK_T = 0.55; // strength at or above this reads as LOCKED

export const STATIONS: Station[] = [
  {
    id: 'storm',
    freq: 80.3,
    name: 'STORM BAND',
    key: 'RECLAIMERS // WX-WATCH',
    hint: 'Pressure fronts, thunderheads, angry weather.',
  },
  {
    id: 'choir',
    freq: 88.1,
    name: 'CHOIR STATIC',
    key: 'THE CHOIR // OPEN AIR',
    hint: 'Hymn carriers fed through broken repeaters.',
  },
  {
    id: 'guild',
    freq: 94.7,
    name: 'GUILD DISPATCH',
    key: 'SALT GUILD // CLEARING HOUSE',
    hint: 'Manifest beeps. The desert, doing sums.',
  },
  {
    id: 'mother',
    freq: 101.9,
    name: 'BAND ZERO',
    key: 'UNCLAIMED CARRIER',
    hint: 'Something breathing, far below the salt.',
  },
];

export const WHISPERS: Record<StationId, string[]> = {
  storm: [
    '…pressure falling — route the long way round…',
    '…third ridge is singing again, keep low…',
  ],
  choir: [
    '…the seed vaults remember rain…',
    '…sing it back, little reverb, sing it back…',
  ],
  guild: [
    '…ninety tonnes of salt, sighed the ledger…',
    '…payment on delivery, no questions, no choir…',
  ],
  mother: [
    '…kept the tide tables for a sea that never came…',
    '…band zero holds its breath…',
  ],
};

export const clampFreq = (f: number) => Math.min(BAND_HI, Math.max(BAND_LO, f));

/** Smooth falloff from a station centre; 0 outside the skirt. */
export function lockStrength(freq: number, stationFreq: number): number {
  const d = Math.abs(freq - stationFreq);
  if (d >= SKIRT) return 0;
  const t = 1 - d / SKIRT;
  return t * t * (3 - 2 * t);
}

export function bestLock(freq: number): { station: Station; t: number } | null {
  let best: { station: Station; t: number } | null = null;
  for (const s of STATIONS) {
    const t = lockStrength(freq, s.freq);
    if (t > 0 && (!best || t > best.t)) best = { station: s, t };
  }
  return best;
}

/* ------------------------------------------------------------------ */

interface Smoothed {
  p: AudioParam;
  v: number;
  t: number; // last schedule time
}

function whiteBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function brownBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5; // restore level
  }
  return buf;
}

function loopSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start();
  return src;
}

export class RadioEngine {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // smoothed params
  private smoothed: Smoothed[] = [];
  private sMaster: Smoothed | null = null;
  private sStatic: Smoothed | null = null;
  private sStaticFreq: Smoothed | null = null;
  private sStorm: Smoothed | null = null;
  private sStormFreq: Smoothed | null = null;
  private sChoir: Smoothed | null = null;
  private sGuild: Smoothed | null = null;
  private sMother: Smoothed | null = null;
  private sBreath: Smoothed | null = null;
  private sBreathFreq: Smoothed | null = null;
  private sGhost: Smoothed | null = null;
  private sGhostFreq: Smoothed | null = null;

  // voice buses
  private stormVoice: GainNode | null = null;
  private crackleHP: BiquadFilterNode | null = null;
  private guildVoice: GainNode | null = null;
  private motherVoice: GainNode | null = null;
  private crackleBuf: AudioBuffer | null = null;

  // schedulers / phasors
  private t = 0;
  private nextBurstAt = 0;
  private nextCrackleAt = 0;
  private breathPhase = 0;
  private lastHousekeep = 0;
  private ghost = { active: false, startAt: 0, endAt: 0, nextAt: 6, carrier: 440, peak: 0.8 };

  /** dial position, MHz */
  freq = 92.3;
  listening = false;
  /** 0..1, smoothed — scope + UI read this */
  ghostLevel = 0;
  /** which station the current ghost is leaning on */
  ghostStation: StationId | null = null;
  dominant: Station | null = null;
  dominantStrength = 0;

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Create/resume the context. Call from a user gesture. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;

    const out = ctx.createGain();
    out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    out.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);
    this.out = out;
    this.analyser = analyser;

    this.sMaster = this.track(out.gain, 0);
    const now = ctx.currentTime;
    this.nextBurstAt = now + 0.6;
    this.nextCrackleAt = now + 0.3;
    this.ghost.nextAt = now + 5 + Math.random() * 6;
    this.lastHousekeep = now;

    const white = whiteBuffer(ctx, 2);
    this.crackleBuf = white;

    // --- tuner static bed: white -> bandpass(follows dial) -> gain
    const staticBP = ctx.createBiquadFilter();
    staticBP.type = 'bandpass';
    staticBP.frequency.value = 1600;
    staticBP.Q.value = 0.7;
    const staticGain = ctx.createGain();
    staticGain.gain.value = 0;
    loopSource(ctx, white).connect(staticBP);
    staticBP.connect(staticGain);
    staticGain.connect(out);
    this.sStatic = this.track(staticGain.gain, 0);
    this.sStaticFreq = this.track(staticBP.frequency, 1600);

    // --- STORM: brown rumble -> wandering lowpass; crackles via scheduler
    const stormLP = ctx.createBiquadFilter();
    stormLP.type = 'lowpass';
    stormLP.frequency.value = 160;
    stormLP.Q.value = 0.8;
    const stormGain = ctx.createGain();
    stormGain.gain.value = 0;
    loopSource(ctx, brownBuffer(ctx, 4)).connect(stormLP);
    stormLP.connect(stormGain);
    stormGain.connect(out);
    const crackleHP = ctx.createBiquadFilter();
    crackleHP.type = 'highpass';
    crackleHP.frequency.value = 2200;
    crackleHP.connect(stormGain);
    this.stormVoice = stormGain;
    this.crackleHP = crackleHP;
    this.sStorm = this.track(stormGain.gain, 0);
    this.sStormFreq = this.track(stormLP.frequency, 160);

    // --- CHOIR: airy band + beating hymn chord through tremolo + slap echo
    const choirGain = ctx.createGain();
    choirGain.gain.value = 0;
    choirGain.connect(out);
    const airBP = ctx.createBiquadFilter();
    airBP.type = 'bandpass';
    airBP.frequency.value = 2600;
    airBP.Q.value = 0.5;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.42;
    loopSource(ctx, whiteBuffer(ctx, 2)).connect(airBP);
    airBP.connect(airGain);
    airGain.connect(choirGain);

    const humBus = ctx.createGain();
    humBus.gain.value = 0.34;
    const tremGain = ctx.createGain();
    tremGain.gain.value = 0.5;
    for (const f of [220, 221.6, 329.6]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.start();
      o.connect(humBus);
    }
    const tremLFO = ctx.createOscillator();
    tremLFO.frequency.value = 0.37;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.24;
    tremLFO.connect(tremDepth);
    tremDepth.connect(tremGain.gain);
    tremLFO.start();
    const swellLFO = ctx.createOscillator();
    swellLFO.frequency.value = 0.09;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.14;
    swellLFO.connect(swellDepth);
    swellDepth.connect(humBus.gain);
    swellLFO.start();
    const echo = ctx.createDelay(0.5);
    echo.delayTime.value = 0.021;
    const echoFB = ctx.createGain();
    echoFB.gain.value = 0.32;
    const echoWet = ctx.createGain();
    echoWet.gain.value = 0.4;
    humBus.connect(echo);
    echo.connect(echoFB);
    echoFB.connect(echo);
    echo.connect(echoWet);
    humBus.connect(tremGain);
    echoWet.connect(tremGain);
    tremGain.connect(choirGain);
    this.sChoir = this.track(choirGain.gain, 0);

    // --- GUILD: telegraph beeps, scheduled
    const guildGain = ctx.createGain();
    guildGain.gain.value = 0;
    guildGain.connect(out);
    this.guildVoice = guildGain;
    this.sGuild = this.track(guildGain.gain, 0);

    // --- MOTHER: sub carrier + breath noise + heartbeat
    const motherGain = ctx.createGain();
    motherGain.gain.value = 0;
    motherGain.connect(out);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 42;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    sub.connect(subGain);
    subGain.connect(motherGain);
    sub.start();
    const harm = ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.value = 168;
    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.022;
    harm.connect(harmGain);
    harmGain.connect(motherGain);
    harm.start();
    const breathBP = ctx.createBiquadFilter();
    breathBP.type = 'bandpass';
    breathBP.frequency.value = 320;
    breathBP.Q.value = 1.1;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0;
    loopSource(ctx, whiteBuffer(ctx, 2)).connect(breathBP);
    breathBP.connect(breathGain);
    breathGain.connect(motherGain);
    this.motherVoice = motherGain;
    this.sMother = this.track(motherGain.gain, 0);
    this.sBreath = this.track(breathGain.gain, 0);
    this.sBreathFreq = this.track(breathBP.frequency, 320);

    // --- ghost harmonic: lone sine a fifth-ish up, wobbling
    const ghostOsc = ctx.createOscillator();
    ghostOsc.type = 'sine';
    ghostOsc.frequency.value = 495;
    const ghostGain = ctx.createGain();
    ghostGain.gain.value = 0;
    ghostOsc.connect(ghostGain);
    ghostGain.connect(out);
    ghostOsc.start();
    this.sGhost = this.track(ghostGain.gain, 0);
    this.sGhostFreq = this.track(ghostOsc.frequency, 495);

    this.setListening(this.listening);
    this.setFreq(this.freq);
  }

  private track(p: AudioParam, v0: number): Smoothed {
    const s: Smoothed = { p, v: v0, t: 0 };
    this.smoothed.push(s);
    return s;
  }

  private approach(s: Smoothed | null, target: number, tc = 0.08, eps = 0.004): void {
    if (!s || !this.ctx) return;
    if (Math.abs(target - s.v) <= eps) return;
    s.v = target;
    const now = this.ctx.currentTime;
    if (now - s.t < 0.08) return; // rate-limit automation events
    s.t = now;
    s.p.setTargetAtTime(target, now, tc);
  }

  setFreq(mhz: number): void {
    this.freq = clampFreq(mhz);
  }

  setListening(on: boolean): void {
    this.listening = on;
    this.approach(this.sMaster, on ? 0.9 : 0, on ? 0.09 : 0.14, 1e-9);
  }

  private heartbeat(now: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.motherVoice) return;
    for (const off of [0, 0.17]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(52, now + off);
      o.frequency.exponentialRampToValueAtTime(34, now + off + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + off);
      g.gain.linearRampToValueAtTime(0.55, now + off + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + off + 0.22);
      o.connect(g);
      g.connect(this.motherVoice);
      o.start(now + off);
      o.stop(now + off + 0.3);
    }
  }

  private beepBurst(now: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.guildVoice) return;
    let t = now + 0.03;
    const n = 3 + Math.floor(Math.random() * 8);
    for (let k = 0; k < n; k++) {
      const dash = Math.random() < 0.22;
      const dur = dash ? 0.16 : 0.04 + Math.random() * 0.06;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = Math.random() < 0.5 ? 740 : 988;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.55, t + 0.006);
      g.gain.setValueAtTime(0.55, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.012);
      o.connect(g);
      g.connect(this.guildVoice);
      o.start(t);
      o.stop(t + dur + 0.05);
      t += dur + 0.045 + Math.random() * 0.06;
    }
    // occasional "K-" signature: long-long-short
    this.nextBurstAt = now + 0.8 + Math.random() * 2.6;
  }

  private crackle(now: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.crackleBuf || !this.crackleHP || !this.stormVoice) return;
    const s = this.dominant?.id === 'storm' ? this.dominantStrength : 0;
    if (s <= 0.05) {
      this.nextCrackleAt = now + 0.2;
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.crackleBuf;
    src.playbackRate.value = 4 + Math.random() * 8;
    const g = ctx.createGain();
    const a = 0.04 + Math.random() * 0.2;
    g.gain.setValueAtTime(a, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.02 + Math.random() * 0.04);
    src.connect(g);
    g.connect(this.crackleHP);
    src.start(now, Math.random() * 1.5, 0.08);
    this.nextCrackleAt = now + 0.05 + Math.random() * (0.5 - 0.35 * s);
  }

  /** advance phasors/schedulers; call once per animation frame */
  update(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.t += dt;
    const now = ctx.currentTime;

    // dominant signal
    const lock = bestLock(this.freq);
    this.dominant = lock ? lock.station : null;
    this.dominantStrength = lock ? lock.t : 0;
    const s = lock ? lock.t : 0;
    const id: StationId | null = lock ? lock.station.id : null;
    const pow = (x: number, p: number) => Math.pow(Math.max(0, x), p);

    // tuner static follows the dial and owns whatever the stations don't
    const staticLevel = 0.045 + 0.5 * pow(1 - s, 1.25);
    this.approach(this.sStatic, staticLevel, 0.07);
    const staticFreq = 500 + ((this.freq - BAND_LO) / (BAND_HI - BAND_LO)) * 4200;
    this.approach(this.sStaticFreq, staticFreq, 0.1, 8);

    // storm: wandering lowpass + slow amplitude weather
    const stormS = id === 'storm' ? s : 0;
    const stormLPF =
      90 +
      220 * (0.5 + 0.5 * Math.sin(this.t * 0.13)) +
      70 * Math.sin(this.t * 0.31 + 1.7);
    this.approach(this.sStorm, 0.55 * pow(stormS, 1.2) * (0.7 + 0.3 * Math.sin(this.t * 0.21)), 0.09);
    this.approach(this.sStormFreq, stormLPF, 0.15, 4);
    if (this.listening && now >= this.nextCrackleAt) this.crackle(now);

    // choir
    const choirS = id === 'choir' ? s : 0;
    this.approach(this.sChoir, 0.36 * pow(choirS, 1.35), 0.09);

    // guild
    const guildS = id === 'guild' ? s : 0;
    this.approach(this.sGuild, 0.5 * pow(guildS, 1.2), 0.06);
    if (this.listening && now >= this.nextBurstAt) this.beepBurst(now);

    // mother: nine-second breath
    const motherS = id === 'mother' ? s : 0;
    this.breathPhase += dt / 9;
    if (this.breathPhase >= 1) {
      this.breathPhase -= 1;
      if (this.listening) this.heartbeat(now);
    }
    const p = this.breathPhase;
    const rise = Math.min(1, p / 0.55);
    const riseSm = rise * rise * (3 - 2 * rise);
    const fallPhase = Math.min(1, Math.max(0, (p - 0.62) / 0.38));
    const env = riseSm * (1 - fallPhase * fallPhase * (3 - 2 * fallPhase));
    this.approach(this.sMother, 0.6 * pow(motherS, 1.3), 0.09);
    this.approach(this.sBreath, 0.6 * env, 0.12, 0.006);
    this.approach(this.sBreathFreq, 240 + 660 * env, 0.15, 8);

    // ghost harmonics: only when listening to a clean lock
    const g = this.ghost;
    if (!g.active && this.listening && s > LOCK_T && now >= g.nextAt && lock) {
      g.active = true;
      g.startAt = now;
      g.endAt = now + 2.2 + Math.random() * 2.8;
      g.peak = 0.5 + Math.random() * 0.5;
      g.carrier =
        lock.station.id === 'choir'
          ? 495 + Math.random() * 12
          : lock.station.id === 'guild'
            ? 1480
            : lock.station.id === 'storm'
              ? 131 + Math.random() * 8
              : 378 + Math.random() * 20;
      this.ghostStation = lock.station.id;
    }
    let ghostTarget = 0;
    if (g.active) {
      if (now >= g.endAt || s < 0.25) {
        g.active = false;
        g.nextAt = now + 8 + Math.random() * 14;
      } else {
        const inRamp = Math.min(1, (now - g.startAt) / 0.45);
        const outRamp = Math.min(1, (g.endAt - now) / 0.8);
        ghostTarget = Math.max(0, Math.min(inRamp, outRamp)) * g.peak;
      }
    }
    this.ghostLevel += (ghostTarget - this.ghostLevel) * Math.min(1, dt * 7);
    this.approach(this.sGhost, 0.055 * s * this.ghostLevel, 0.06);
    this.approach(this.sGhostFreq, g.carrier + Math.sin(this.t * 6.3) * 6, 0.1, 0.5);

    // housekeeping: squash the automation-event backlog a few times a minute
    if (now - this.lastHousekeep > 5) {
      this.lastHousekeep = now;
      for (const sm of this.smoothed) {
        sm.p.cancelScheduledValues(now);
        sm.p.setValueAtTime(sm.v, now);
        sm.t = now;
      }
    }
  }

  /** latest waveform into caller-owned scratch (zeros until the set exists) */
  read(dst: Float32Array<ArrayBuffer>): void {
    if (this.analyser) this.analyser.getFloatTimeDomainData(dst);
    else dst.fill(0);
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}

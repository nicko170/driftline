/**
 * Storm Front Sandbox — procedural storm audio, all synthesized.
 *
 * One lazily-created AudioContext (must be kicked by a user gesture — the
 * panel's rumble toggle). Brown-noise rumble through a lowpass tracks wall
 * intensity; a bandpassed hiss layer tracks bike speed; a sparse crackle
 * scheduler adds grit when the wall is close. Parameter writes are throttled
 * to ~8 Hz so the automation event list stays short.
 */

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let rumGain: GainNode | null = null;
let rumFilter: BiquadFilterNode | null = null;
let hissGain: GainNode | null = null;
let hissFilter: BiquadFilterNode | null = null;
let crackleTimer = 0;
let lastDrive = 0;
let enabled = false;

function makeBrownNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < len; i++) {
    v = (v + (Math.random() * 2 - 1) * 0.02) * 0.998;
    ch[i] = v * 3.2;
  }
  return buf;
}

function makeWhiteNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function ensure() {
  if (ac) return;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ac = new Ctor();
  master = ac.createGain();
  master.gain.value = 0.85;
  master.connect(ac.destination);

  // rumble bed
  const rumSrc = ac.createBufferSource();
  rumSrc.buffer = makeBrownNoiseBuffer(ac, 4);
  rumSrc.loop = true;
  rumFilter = ac.createBiquadFilter();
  rumFilter.type = 'lowpass';
  rumFilter.frequency.value = 220;
  rumGain = ac.createGain();
  rumGain.gain.value = 0;
  rumSrc.connect(rumFilter).connect(rumGain).connect(master);
  rumSrc.start();

  // wind hiss
  const hissSrc = ac.createBufferSource();
  hissSrc.buffer = makeWhiteNoiseBuffer(ac, 2);
  hissSrc.loop = true;
  hissFilter = ac.createBiquadFilter();
  hissFilter.type = 'bandpass';
  hissFilter.frequency.value = 900;
  hissFilter.Q.value = 0.7;
  hissGain = ac.createGain();
  hissGain.gain.value = 0;
  hissSrc.connect(hissFilter).connect(hissGain).connect(master);
  hissSrc.start();

  // crackle scheduler
  crackleTimer = window.setInterval(() => {
    if (!ac || !master || !enabled) return;
    const p = driveIntensity;
    if (Math.random() < p * 0.55) {
      const src = ac.createBufferSource();
      src.buffer = crackleBuf ?? (crackleBuf = makeWhiteNoiseBuffer(ac, 0.05));
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 2800;
      bp.Q.value = 9;
      const g = ac.createGain();
      const t = ac.currentTime;
      g.gain.setValueAtTime(0.02 + Math.random() * 0.08 * p, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + Math.random() * 0.05);
      src.connect(bp).connect(g).connect(master);
      src.start();
    }
  }, 130);
}

let crackleBuf: AudioBuffer | null = null;
let driveIntensity = 0;

export function setRumbleEnabled(on: boolean) {
  enabled = on;
  if (on) {
    ensure();
    void ac?.resume();
  } else if (ac && master) {
    master.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    driveIntensity = 0;
    if (rumGain) rumGain.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    if (hissGain) hissGain.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    window.setTimeout(() => { if (ac && !enabled && master) { master.gain.value = 0.85; void ac.suspend(); } }, 900);
  }
}

/** Called every frame from the director; throttled internally. */
export function driveStormAudio(intensity: number, bikeN: number, density: number) {
  driveIntensity = intensity;
  if (!ac || !enabled || !rumGain || !rumFilter || !hissGain || !hissFilter) return;
  const now = performance.now();
  if (now - lastDrive < 125) return;
  lastDrive = now;
  const t = ac.currentTime;
  rumGain.gain.setTargetAtTime(Math.min(0.75, intensity * intensity * 0.9 * density), t, 0.18);
  rumFilter.frequency.setTargetAtTime(180 + intensity * 560, t, 0.25);
  hissGain.gain.setTargetAtTime(0.02 + bikeN * 0.12 + intensity * 0.16, t, 0.2);
  hissFilter.frequency.setTargetAtTime(700 + bikeN * 900 + intensity * 500, t, 0.3);
}

/** Two-note shelter chime when you make the arch. */
export function chime() {
  if (!ac || !enabled || !master) return;
  const t0 = ac.currentTime;
  [523.25, 784].forEach((f, i) => {
    const o = ac!.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ac!.createGain();
    g.gain.setValueAtTime(0, t0 + i * 0.13);
    g.gain.linearRampToValueAtTime(0.16, t0 + i * 0.13 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.13 + 0.7);
    o.connect(g).connect(master!);
    o.start(t0 + i * 0.13);
    o.stop(t0 + i * 0.13 + 0.75);
  });
}

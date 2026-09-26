/**
 * Dust & Particle Lab — R3F scene.
 *
 * A flat test pan with three colour-coded surface zones (salt west, sand centre,
 * a sunken teal glass lane on the south stretch). A ghost hover-bike auto-laps a
 * parametric circuit at a tunable speed, dragging a dust plume emitted by the
 * same ring-buffer algorithm as src/game/DustTrail.tsx — every constant exposed
 * live, plus the upgrade path (per-particle size, age fade, turbulence, drag)
 * as a custom shader material. Zero per-frame allocations: module scratch only.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { fbm2, ridge2, smooth01, lerp, clamp01, mulberry32 } from '../../../lib/noise';
import { lab, stats, type SurfaceKind } from './state';

/* ================= surface + height field (visuals & physics agree) ================= */

const glassMask = (x: number, z: number) =>
  smooth01((z - 44) / 14) * smooth01((x + 14) / 16) * smooth01((170 - x) / 16);
const saltMask = (x: number) => smooth01((-55 - x) / 20);

export function resolveSurface(x: number, z: number): SurfaceKind {
  if (glassMask(x, z) > 0.55) return 'glass';
  if (saltMask(x) > 0.55) return 'salt';
  return 'sand';
}

export function panHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = fbm2(x * 0.02, z * 0.02, 2) * 0.45;
  // dunes rising beyond the test apron
  h += smooth01((r - 235) / 90) * Math.max(0, ridge2(x * 0.009 + 3.1, z * 0.009 - 5.2, 3) * 7.5);
  // glass lane sits sunken, with a raised fused rim
  const g = glassMask(x, z);
  const rim = smooth01(1 - Math.abs(z - 44) / 10) * smooth01((x + 14) / 16) * smooth01((170 - x) / 16);
  h -= g * 0.8;
  h += rim * 0.5;
  // salt pan flattens to a hard pan
  h = lerp(h, fbm2(x * 0.05, z * 0.05, 2) * 0.18, saltMask(x));
  return h;
}

/* ================= the circuit (arc-length parametrised oval) ================= */

const TRACK_N = 720;
const TRACK_T = new Float32Array(TRACK_N);
const TRACK_X = new Float32Array(TRACK_N);
const TRACK_Z = new Float32Array(TRACK_N);
const TRACK_S = new Float32Array(TRACK_N); // cumulative arc length
let TRACK_LEN = 0;

function trackPos(t: number, out: { x: number; z: number }) {
  out.x = 150 * Math.cos(t) + 18 * Math.sin(2 * t);
  out.z = 92 * Math.sin(t);
}

(function buildTrack() {
  const p = { x: 0, z: 0 };
  let px = 0, pz = 0;
  for (let i = 0; i < TRACK_N; i++) {
    const t = (i / TRACK_N) * Math.PI * 2;
    trackPos(t, p);
    TRACK_T[i] = t;
    TRACK_X[i] = p.x;
    TRACK_Z[i] = p.z;
    if (i > 0) TRACK_S[i] = TRACK_S[i - 1] + Math.hypot(p.x - px, p.z - pz);
    px = p.x; pz = p.z;
  }
  trackPos(Math.PI * 2, p);
  TRACK_LEN = TRACK_S[TRACK_N - 1] + Math.hypot(p.x - px, p.z - pz);
})();

/** Point + unit tangent at arc length s along the lap. No allocation. */
function trackAt(s: number, out: { x: number; z: number; tx: number; tz: number }) {
  s = ((s % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
  // linear scan is fine at 720 samples, but walk from a coarse guess
  let i = Math.floor((s / TRACK_LEN) * TRACK_N);
  while (i < TRACK_N - 1 && TRACK_S[i + 1] < s) i++;
  while (i > 0 && TRACK_S[i] > s) i--;
  const j = (i + 1) % TRACK_N;
  const segLen = (j === 0 ? TRACK_LEN : TRACK_S[j]) - TRACK_S[i];
  const f = segLen > 0 ? (s - TRACK_S[i]) / segLen : 0;
  const ax = TRACK_X[i], az = TRACK_Z[i];
  const bx = TRACK_X[j], bz = TRACK_Z[j];
  out.x = lerp(ax, bx, f);
  out.z = lerp(az, bz, f);
  const il = segLen > 0 ? 1 / segLen : 0;
  out.tx = (bx - ax) * il;
  out.tz = (bz - az) * il;
}

/* ================= test pan geometry ================= */

function buildPan() {
  const SIZE = 640;
  const SEG = 116;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const saltC = new THREE.Color('#F3EEE2');
  const saltD = new THREE.Color('#DED2B8');
  const sandC = new THREE.Color('#D9A45B');
  const sandD = new THREE.Color('#B07C3A');
  const glassC = new THREE.Color('#2E8C8C');
  const glassB = new THREE.Color('#57C4B8');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = panHeight(x, z);
    pos.setY(i, h);
    const n = fbm2(x * 0.045, z * 0.045, 2) * 0.5 + 0.5;
    const gm = glassMask(x, z);
    const sm = saltMask(x);
    if (gm > 0.02 && gm >= sm) {
      const vein = clamp01(ridge2(x * 0.06, z * 0.06, 2) * 0.5 + 0.5);
      c.copy(glassC).lerp(glassB, vein * 0.85).lerp(sandC, 1 - gm);
    } else if (sm > 0.02) {
      c.copy(sandC).lerp(saltD, sm * 0.6).lerp(saltC, sm * (0.25 + n * 0.55));
    } else {
      const crest = smooth01((h - 2.5) / 6);
      c.copy(sandD).lerp(sandC, 0.35 + n * 0.6).lerp(saltD, crest * 0.22);
    }
    const v = 0.94 + n * 0.12;
    colors[i * 3] = c.r * v;
    colors[i * 3 + 1] = c.g * v;
    colors[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}

/* ================= instanced scatter: rocks + salt cones ================= */

function Scatter() {
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const cones = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const rand = mulberry32(1968);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const place = (mesh: THREE.InstancedMesh, count: number, inSalt: boolean) => {
      for (let i = 0; i < count; i++) {
        let x = 0, z = 0, tries = 0;
        // scatter on the apron ring, keep clear of the circuit
        do {
          const a = rand() * Math.PI * 2;
          const r = 150 + rand() * 150;
          x = Math.cos(a) * r * 1.25;
          z = Math.sin(a) * r;
          tries++;
        } while (tries < 20 && Math.abs(x) < 185 && Math.abs(z) < 118);
        if (inSalt) x = -120 - rand() * 130;
        const s = inSalt ? 0.7 + rand() * 1.6 : 0.5 + rand() * 1.9;
        e.set(0, rand() * Math.PI * 2, 0);
        q.setFromEuler(e);
        v.set(x, panHeight(x, z) + s * 0.28, z);
        sc.set(s, s * (inSalt ? 1.5 : 0.8), s);
        m.compose(v, q, sc);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(rocks.current, 90, false);
    place(cones.current, 46, true);
  }, []);

  return (
    <group>
      <instancedMesh ref={rocks} args={[undefined, undefined, 90]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#A98A66" flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={cones} args={[undefined, undefined, 46]} castShadow>
        <coneGeometry args={[0.8, 2.2, 5]} />
        <meshStandardMaterial color="#EDE4D2" emissive="#57C4B8" emissiveIntensity={0.05} flatShading />
      </instancedMesh>
    </group>
  );
}

/* ================= gantry + colour-coded zone pylons ================= */

const ZONE_COLOR: Record<SurfaceKind, string> = { salt: '#EDE4D2', sand: '#D9A45B', glass: '#57C4B8' };

function GateAndPylons() {
  const pylons = useMemo(() => {
    // walk the lap, drop a beacon wherever the surface zone changes
    const out: { x: number; z: number; kind: SurfaceKind }[] = [];
    let prev = resolveSurface(TRACK_X[0], TRACK_Z[0]);
    for (let i = 1; i <= TRACK_N; i++) {
      const k = i % TRACK_N;
      const cur = resolveSurface(TRACK_X[k], TRACK_Z[k]);
      if (cur !== prev) {
        out.push({ x: TRACK_X[k], z: TRACK_Z[k], kind: cur });
        prev = cur;
      }
    }
    return out;
  }, []);

  const gantry = useMemo(() => {
    const p = { x: 0, z: 0, tx: 0, tz: 0 };
    trackAt(0, p);
    return p;
  }, []);

  return (
    <group>
      {/* start/finish gantry — rust posts, amber span, emissive timing strip */}
      <group position={[gantry.x, panHeight(gantry.x, gantry.z), gantry.z]} rotation={[0, Math.atan2(gantry.tx, gantry.tz), 0]}>
        {[-9, 9].map((o) => (
          <mesh key={o} position={[o, 4, 0]} castShadow>
            <boxGeometry args={[1, 8, 1]} />
            <meshStandardMaterial color="#B3502E" flatShading />
          </mesh>
        ))}
        <mesh position={[0, 8.2, 0]} castShadow>
          <boxGeometry args={[20, 1, 1.4]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
        <mesh position={[0, 7.5, 0]}>
          <boxGeometry args={[19, 0.28, 0.3]} />
          <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.6} />
        </mesh>
      </group>
      {/* zone boundary beacons — the particle plume changes colour between them */}
      {pylons.map((p, i) => (
        <group key={i} position={[p.x, panHeight(p.x, p.z), p.z]}>
          <mesh position={[0, 3, 0]} castShadow>
            <coneGeometry args={[0.7, 6, 5]} />
            <meshStandardMaterial color={ZONE_COLOR[p.kind]} flatShading />
          </mesh>
          <mesh position={[0, 6.4, 0]}>
            <octahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial color={ZONE_COLOR[p.kind]} emissive={ZONE_COLOR[p.kind]} emissiveIntensity={1.4} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ================= ghost bike ================= */

const _bike = { x: 0, z: 0, tx: 0, tz: -1 };

function GhostBike() {
  const root = useRef<THREE.Group>(null!);
  const hull = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Mesh>(null!);
  const shadowDisc = useRef<THREE.Mesh>(null!);
  const state = useRef({ s: 0, heading: 0, lean: 0 });
  const glowMat = useRef<THREE.MeshStandardMaterial>(null!);

  useFrame(({ clock }, dt) => {
    const st = state.current;
    const now = performance.now();
    const boosting = now < lab.boostUntil;
    const t = clock.elapsedTime;

    if (!lab.paused) {
      // speed breathes along the lap — emission rate visibly follows speed
      const breathe = 0.72 + 0.34 * Math.cos((st.s / TRACK_LEN) * Math.PI * 4);
      const v = lab.bikeSpeed * breathe * (boosting ? 1.8 : 1);
      st.s += v * dt;
      stats.bikeSpeed = v;
    } else {
      stats.bikeSpeed = 0;
    }

    trackAt(st.s, _bike);
    const heading = Math.atan2(_bike.tx, _bike.tz);
    // lean into the turn from heading change rate
    let dh = heading - st.heading;
    if (dh > Math.PI) dh -= Math.PI * 2;
    if (dh < -Math.PI) dh += Math.PI * 2;
    st.heading = heading;
    const leanTarget = lab.paused ? 0 : clamp01(Math.abs(dh / Math.max(dt, 1e-4)) * 0.35) * Math.sign(dh) * 0.24;
    st.lean = lerp(st.lean, leanTarget, 1 - Math.exp(-dt * 6));

    const speedN = stats.bikeSpeed / Math.max(lab.bikeSpeed, 1);
    const bounce = Math.sin(t * Math.PI * 4) * 0.05 + Math.sin(t * 13.7) * 0.015 * speedN;
    const y = panHeight(_bike.x, _bike.z) + 1.15 + bounce + (boosting ? 0.22 : 0);

    root.current.position.set(_bike.x, y, _bike.z);
    root.current.rotation.set(speedN * 0.05, heading, st.lean);
    if (glowMat.current) glowMat.current.emissiveIntensity = 0.9 + speedN * 0.8 + (boosting ? 1.6 : 0);
    if (shadowDisc.current) {
      shadowDisc.current.position.set(_bike.x, panHeight(_bike.x, _bike.z) + 0.03, _bike.z);
      (shadowDisc.current.material as THREE.MeshBasicMaterial).opacity = 0.24 - bounce * 0.7;
    }

    // share with the emitter (module scratch, no allocation)
    EMIT.x = _bike.x; EMIT.y = y; EMIT.z = _bike.z;
    EMIT.tx = _bike.tx; EMIT.tz = _bike.tz;
    EMIT.boosting = boosting;
  });

  return (
    <>
      <group ref={root}>
        <mesh ref={hull} castShadow>
          <boxGeometry args={[1.1, 0.55, 2.9]} />
          <meshStandardMaterial color="#B3502E" flatShading roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.16, 1.65]} rotation={[Math.PI / 4, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.34, 0.9]} />
          <meshStandardMaterial color="#D9A45B" flatShading roughness={0.9} />
        </mesh>
        {/* side skirts — teal lift-glow */}
        {[-0.62, 0.62].map((o) => (
          <mesh key={o} position={[o, -0.18, 0]}>
            <boxGeometry args={[0.14, 0.16, 2.5]} />
            <meshStandardMaterial ref={o < 0 ? glowMat : undefined} color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1} flatShading />
          </mesh>
        ))}
        {/* rider */}
        <mesh position={[0, 0.52, -0.15]} castShadow>
          <sphereGeometry args={[0.34, 8, 6]} />
          <meshStandardMaterial color="#7E3320" flatShading />
        </mesh>
        <mesh position={[0, 0.78, 0.05]}>
          <sphereGeometry args={[0.2, 8, 6]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
      </group>
      <mesh ref={shadowDisc} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 16]} />
        <meshBasicMaterial color="#3A2A20" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ================= the dust plume — ring buffer + custom point shader ================= */

const MAX = 2048;
const EMIT = { x: 0, y: 0, z: 0, tx: 0, tz: -1, boosting: false };

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAge;
  attribute vec3 aColor;
  uniform float uScale;
  uniform float uOpacity;
  uniform float uSoft;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    float fade = 1.0 - aAge;
    vAlpha = mix(1.0, fade * fade, uSoft) * uOpacity * step(aAge, 0.999);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float grow = mix(1.0, 0.55 + aAge * 1.7, uSoft);
    gl_PointSize = aSize * grow * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float m = smoothstep(0.5, 0.16, length(d));
    if (vAlpha * m < 0.004) discard;
    gl_FragColor = vec4(vColor, vAlpha * m);
  }
`;

const _cSalt = new THREE.Color();
const _cSand = new THREE.Color();
const _cGlass = new THREE.Color();
const _cSeed = new THREE.Color();

function DustPlume() {
  const data = useMemo(() => {
    const positions = new Float32Array(MAX * 3);
    const colors = new Float32Array(MAX * 3);
    const sizes = new Float32Array(MAX);
    const agesF = new Float32Array(MAX); // 0..1 attribute sent to the GPU
    const ages = new Float32Array(MAX).fill(1e9);
    const vels = new Float32Array(MAX * 3);
    const seeds = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) {
      positions[i * 3 + 1] = -9999;
      sizes[i] = 1;
      seeds[i] = i * 0.61;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aAge', new THREE.BufferAttribute(agesF, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uScale: { value: 800 },
        uOpacity: { value: lab.opacity },
        uSoft: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
    });
    return { positions, colors, sizes, agesF, ages, vels, seeds, g, material, next: 0, ema: 0, emaFps: 60 };
  }, []);

  const emitAcc = useRef(0);

  useFrame(({ size: view, gl }, dt) => {
    const d = data;
    const count = Math.min(MAX, lab.count);

    // surface palette (re-parse strings — cheap, or no-op if unchanged)
    _cSalt.set(lab.salt);
    _cSand.set(lab.sand);
    _cGlass.set(lab.glass);

    // ---- emit (same algorithm as the game: rate ∝ bike speed) ----
    const speed = stats.bikeSpeed;
    let emitted = 0;
    if (!lab.paused && speed > 4) {
      emitAcc.current += dt * Math.min(lab.emitCap, speed * lab.emitPerSpeed);
      while (emitAcc.current > 1) {
        emitAcc.current -= 1;
        emitted++;
        const i = d.next;
        d.next = (d.next + 1) % count;
        const jx = (Math.random() - 0.5) * 2 * lab.spread;
        const jz = (Math.random() - 0.5) * 2 * lab.spread;
        const x = EMIT.x - EMIT.tx * lab.behind + jx;
        const z = EMIT.z - EMIT.tz * lab.behind + jz;
        d.positions[i * 3] = x;
        d.positions[i * 3 + 1] = panHeight(x, z) + 0.32;
        d.positions[i * 3 + 2] = z;
        d.vels[i * 3] = (Math.random() - 0.5) * 1.6 - EMIT.tx * speed * lab.slip;
        d.vels[i * 3 + 1] = lab.rise * (0.4 + Math.random() * 0.6) * (EMIT.boosting ? 1.5 : 1);
        d.vels[i * 3 + 2] = (Math.random() - 0.5) * 1.6 - EMIT.tz * speed * lab.slip;
        d.ages[i] = 0;
        d.sizes[i] = lab.size * (0.7 + Math.random() * 0.6);
        const kind = resolveSurface(x, z);
        _cSeed.copy(kind === 'salt' ? _cSalt : kind === 'glass' ? _cGlass : _cSand);
        const shade = 0.92 + Math.random() * 0.16;
        d.colors[i * 3] = _cSeed.r * shade;
        d.colors[i * 3 + 1] = _cSeed.g * shade;
        d.colors[i * 3 + 2] = _cSeed.b * shade;
      }
    }
    d.ema = lerp(d.ema, dt > 0 ? emitted / dt : 0, 0.06);

    // ---- age + advect ----
    const tt = performance.now() * 0.001;
    const turb = lab.turbulence;
    const dragK = 1 / (1 + lab.drag * dt);
    let active = 0;
    for (let i = 0; i < count; i++) {
      if (d.ages[i] > lab.lifetime) continue;
      d.ages[i] += dt;
      if (d.ages[i] > lab.lifetime) {
        d.positions[i * 3 + 1] = -9999;
        d.agesF[i] = 1;
        continue;
      }
      active++;
      if (turb > 0) {
        const s = d.seeds[i];
        d.vels[i * 3] += Math.sin(d.positions[i * 3 + 1] * 0.5 + tt * 1.9 + s) * turb * 3.2 * dt;
        d.vels[i * 3 + 2] += Math.cos(d.positions[i * 3] * 0.42 - tt * 1.5 + s * 1.7) * turb * 3.2 * dt;
      }
      if (lab.drag > 0) {
        d.vels[i * 3] *= dragK;
        d.vels[i * 3 + 1] *= dragK;
        d.vels[i * 3 + 2] *= dragK;
      }
      d.positions[i * 3] += d.vels[i * 3] * dt;
      d.positions[i * 3 + 1] += d.vels[i * 3 + 1] * dt;
      d.positions[i * 3 + 2] += d.vels[i * 3 + 2] * dt;
      d.agesF[i] = d.ages[i] / lab.lifetime;
    }
    // if the buffer shrank, park the overflow by letting existing particles age out
    if (d.next >= count) d.next = 0;

    (d.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (d.g.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (d.g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (d.g.attributes.aAge as THREE.BufferAttribute).needsUpdate = true;

    d.material.uniforms.uScale.value = view.height * gl.getPixelRatio() * 0.5;
    d.material.uniforms.uOpacity.value = lab.opacity;
    d.material.uniforms.uSoft.value = lab.softFade ? 1 : 0;

    d.emaFps = lerp(d.emaFps, 1 / Math.max(dt, 1e-4), 0.05);
    stats.active = active;
    stats.emitPerSec = d.ema;
    stats.fps = d.emaFps;
    stats.surface = resolveSurface(EMIT.x, EMIT.z);
  });

  return <points geometry={data.g} material={data.material} frustumCulled={false} />;
}

/* ================= ambient rig: sky dome, sun, fog, motes ================= */

const DOME_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const DOME_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 sky = mix(uHorizon, uTop, pow(smoothstep(-0.04, 0.6, h), 0.75));
    gl_FragColor = vec4(sky, 1.0);
  }
`;

function SkyRig() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#A9CDD6') },
      uHorizon: { value: new THREE.Color('#F0DFB8') },
    }),
    [],
  );
  const motes = useMemo(() => {
    const rand = mulberry32(77);
    const N = 220;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const r = 30 + rand() * 170;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = 1 + rand() * 22;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const motesRef = useRef<THREE.Points>(null);

  useFrame((_, dt) => {
    if (motesRef.current) motesRef.current.rotation.y += dt * 0.014;
  });

  return (
    <group>
      <mesh renderOrder={-100} frustumCulled={false}>
        <sphereGeometry args={[1400, 32, 16]} />
        <shaderMaterial vertexShader={DOME_VERT} fragmentShader={DOME_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <hemisphereLight intensity={0.55} color="#F5E7C8" groundColor="#B07C3A" />
      <directionalLight
        castShadow
        position={[190, 260, 90]}
        intensity={2.1}
        color="#FFE9C4"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-240}
        shadow-camera-right={240}
        shadow-camera-top={240}
        shadow-camera-bottom={-240}
        shadow-camera-near={40}
        shadow-camera-far={700}
        shadow-bias={-0.0006}
      />
      <points geometry={motes} ref={motesRef}>
        <pointsMaterial size={0.8} sizeAttenuation color="#E4D7BE" transparent opacity={0.22} depthWrite={false} />
      </points>
    </group>
  );
}

/* ================= root ================= */

export function LabScene() {
  const pan = useMemo(buildPan, []);
  return (
    <>
      <SkyRig />
      <fogExp2 attach="fog" args={['#E7CFA9', 0.0012]} />
      <mesh geometry={pan} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
      </mesh>
      <Scatter />
      <GateAndPylons />
      <GhostBike />
      <DustPlume />
      <OrbitControls
        target={[0, 6, 0]}
        enableDamping
        dampingFactor={0.08}
        autoRotate
        autoRotateSpeed={0.25}
        minDistance={20}
        maxDistance={420}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  );
}

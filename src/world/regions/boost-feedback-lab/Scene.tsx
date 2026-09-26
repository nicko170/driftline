/**
 * Boost strip scene: a treadmill speed-trial flat. The bike stays near the
 * origin facing −z; the ground texture, marker posts, light gates, mesas and
 * speed streaks scroll past at the synthetic bike's speed — so camera math is
 * trivial and the tape run is pixel-repeatable.
 *
 * The camera rig mirrors src/game/CameraRig.tsx (dist/height/lookahead lerps)
 * but its FOV curve and boost shake come from the *selected candidates*.
 *
 * Perf: a handful of instanced draws, recycled via modulo; module-level
 * scratch objects only — nothing allocates per frame.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  lab, stats, simFeel, simScroll, step, tapeWantsBoost, TAPE_S,
  activeIds, findFov, findShake, findPitch, BASE_FOV,
} from './sim';
import { synth } from './synth';

const RANGE = 1500;          // treadmill recycle length, m
const rel = (base: number, scroll: number) =>
  ((((base + scroll) % RANGE) + RANGE) % RANGE) - RANGE + 90; // [-1410, +90]

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _lookVel = new THREE.Vector3();

/* ---------------------------------------------------------------- ground */

const GROUND_LEN = 1600;
const GROUND_W = 100;

function Ground() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uScroll: { value: 0 },
          uSalt: { value: new THREE.Color('#EFE8D2') },
          uSand: { value: new THREE.Color('#D9B477') },
          uGlass: { value: new THREE.Color('#7FB6AD') },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uScroll;
          uniform vec3 uSalt; uniform vec3 uSand; uniform vec3 uGlass;
          float hash(float n) { return fract(sin(n) * 43758.5453); }
          void main() {
            float u = (vUv.x - 0.5) * ${GROUND_W.toFixed(1)};      // across, metres
            float v = vUv.y * ${GROUND_LEN.toFixed(1)} + uScroll;  // along, metres
            // band tint — the strip drifts through salt / sand / glass pans
            float bh = hash(floor(v / 300.0));
            vec3 tint = bh < 0.34 ? uSalt : (bh < 0.67 ? uSand : uGlass);
            vec3 col = mix(uSalt, tint, 0.5);
            // salt mottle
            col *= 0.94 + 0.06 * hash(floor(v / 7.0) * 31.0 + floor(u / 7.0) * 17.0);
            // lane edges (trail width 18 m)
            float edge = step(abs(abs(u) - 9.0), 0.16);
            col = mix(col, vec3(0.93, 0.72, 0.34), edge * 0.8);
            // centre dashes: 7 m dash every 20 m
            float dash = step(fract(v / 20.0), 0.35) * step(abs(u), 0.20);
            col = mix(col, vec3(0.62, 0.42, 0.22), dash * 0.6);
            // cross ticks every 100 m
            float tick = step(fract(v / 100.0), 0.018) * step(abs(u), 10.5);
            col = mix(col, vec3(0.5, 0.36, 0.24), tick * 0.55);
            // outside the lane, fall darker
            col *= 1.0 - 0.10 * smoothstep(9.0, 34.0, abs(u));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );
  useFrame(() => {
    // two tint-band periods — keeps the shader float precise over long runs;
    // 600 000 is a multiple of 20, 100 and 300 so dashes/ticks/bands align at wrap
    mat.uniforms.uScroll.value = simScroll.d % 600000;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -700]} receiveShadow>
      <planeGeometry args={[GROUND_W, GROUND_LEN, 1, 1]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/* ------------------------------------------------------- marker posts */

function Posts() {
  const N = 60; // per side
  const posts = useRef<THREE.InstancedMesh>(null!);
  const caps = useRef<THREE.InstancedMesh>(null!);
  useFrame(() => {
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? -22 : 22;
      for (let i = 0; i < N; i++) {
        const z = rel((i * RANGE) / N + side * (RANGE / N) * 0.5, simScroll.d);
        const idx = side * N + i;
        _m.makeTranslation(x, 0.85, z);
        posts.current.setMatrixAt(idx, _m);
        _m.makeTranslation(x, 1.78, z);
        caps.current.setMatrixAt(idx, _m);
      }
    }
    posts.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <boxGeometry args={[0.24, 1.7, 0.24]} />
        <meshStandardMaterial color="#D9C9A8" flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <boxGeometry args={[0.3, 0.16, 0.3]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.6} flatShading />
      </instancedMesh>
    </>
  );
}

/* --------------------------------------------------------- light gates */

function Gates() {
  const G = 12;
  const SPACING = 125;
  const pylL = useRef<THREE.InstancedMesh>(null!);
  const pylR = useRef<THREE.InstancedMesh>(null!);
  const bars = useRef<THREE.InstancedMesh>(null!);
  const strips = useRef<THREE.InstancedMesh>(null!);
  useFrame(() => {
    for (let i = 0; i < G; i++) {
      const z = rel(i * SPACING, simScroll.d);
      _m.makeTranslation(-11, 3.5, z);
      pylL.current.setMatrixAt(i, _m);
      _m.makeTranslation(11, 3.5, z);
      pylR.current.setMatrixAt(i, _m);
      _m.makeTranslation(0, 7, z);
      bars.current.setMatrixAt(i, _m);
      _m.makeTranslation(0, 6.62, z);
      strips.current.setMatrixAt(i, _m);
    }
    pylL.current.instanceMatrix.needsUpdate = true;
    pylR.current.instanceMatrix.needsUpdate = true;
    bars.current.instanceMatrix.needsUpdate = true;
    strips.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {[pylL, pylR].map((r, k) => (
        <instancedMesh key={k} ref={r} args={[undefined, undefined, G]} frustumCulled={false}>
          <boxGeometry args={[0.8, 7, 0.8]} />
          <meshStandardMaterial color="#7E3320" flatShading />
        </instancedMesh>
      ))}
      <instancedMesh ref={bars} args={[undefined, undefined, G]} frustumCulled={false}>
        <boxGeometry args={[23, 0.6, 0.6]} />
        <meshStandardMaterial color="#D9C9A8" flatShading />
      </instancedMesh>
      <instancedMesh ref={strips} args={[undefined, undefined, G]} frustumCulled={false}>
        <boxGeometry args={[21, 0.24, 0.3]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.8} flatShading />
      </instancedMesh>
    </>
  );
}

/* -------------------------------------------------------------- mesas */

const MESA_COLORS = ['#D9A45B', '#B07C3A', '#B3502E', '#C98F4E', '#8FB5B0', '#E4D7BE'];

function Mesas() {
  const N = 28;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        z: (i / N) * RANGE + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 90,
        x: (i % 2 === 0 ? -1 : 1) * (70 + ((i * 37) % 110)),
        r: 14 + ((i * 53) % 26),
        h: 10 + ((i * 29) % 24),
        yaw: i * 0.77,
      })),
    [],
  );
  useFrame(() => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const z = rel(s.z, simScroll.d);
      _e.set(0, s.yaw, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(s.x, s.h / 2 - 0.5, z), _q, _s.set(s.r, s.h, s.r * 0.8));
      mesh.current.setMatrixAt(i, _m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    let ic: THREE.InstancedBufferAttribute | null = mesh.current.instanceColor;
    if (!ic) {
      const c = new THREE.Color();
      for (let i = 0; i < N; i++) {
        c.set(MESA_COLORS[i % MESA_COLORS.length]);
        mesh.current.setColorAt(i, c);
      }
      ic = mesh.current.instanceColor;
    }
    if (ic) ic.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1.25, 1, 5]} />
      <meshStandardMaterial color="#FFFFFF" flatShading />
    </instancedMesh>
  );
}

/* -------------------------------------------------------- speed streaks */

function Streaks() {
  const N = 90;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        z: (i / N) * 90,
        x: (Math.sin(i * 91.7) * 0.5 + 0.5) * 12 - 6,
        y: 0.35 + (Math.sin(i * 47.3) * 0.5 + 0.5) * 2.8,
      })),
    [],
  );
  useFrame(() => {
    const v = stats.v;
    const vis = Math.min(1, Math.max(0, (v - 18) / 22)) * 0.4;
    mat.current.opacity = vis;
    if (vis <= 0.005) return;
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const rr = (((s.z + simScroll.d * 1.35) % 80) + 80) % 80; // 0..80 band
      _m.makeTranslation(s.x, s.y, 12 - rr); // ahead (−68 m) → past camera (+12 m)
      mesh.current.setMatrixAt(i, _m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <boxGeometry args={[0.05, 0.05, 2.4]} />
      <meshBasicMaterial ref={mat} color="#FFE0A8" transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}

/* ----------------------------------------------------------------- bike */

function Bike() {
  const group = useRef<THREE.Group>(null!);
  const glowL = useRef<THREE.MeshStandardMaterial>(null!);
  const glowR = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const { t, boosting, v } = simFeel;
    const vNorm = Math.min(1, v / 50);
    group.current.position.y = 1.06 + Math.sin(t * Math.PI * 4) * 0.045 + (boosting ? 0.1 : 0);
    group.current.rotation.z = Math.sin(t * 0.9) * 0.02 + (boosting ? Math.sin(t * 4.4) * 0.012 : 0);
    group.current.rotation.x = -0.02 - vNorm * 0.03;
    const glow = 0.9 + vNorm * 1.6 + (boosting ? 1.6 : 0);
    glowL.current.emissiveIntensity = glow;
    glowR.current.emissiveIntensity = glow;
  });
  return (
    <group ref={group} position={[0, 1.06, 0]}>
      {/* hull */}
      <mesh castShadow position={[0, 0, 0.1]}>
        <boxGeometry args={[0.92, 0.42, 2.5]} />
        <meshStandardMaterial color="#B3502E" flatShading />
      </mesh>
      {/* nose */}
      <mesh castShadow position={[0, 0.02, -1.55]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <coneGeometry args={[0.4, 0.9, 4]} />
        <meshStandardMaterial color="#8F4126" flatShading />
      </mesh>
      {/* saddle + keel */}
      <mesh position={[0, 0.32, 0.5]}>
        <boxGeometry args={[0.5, 0.22, 0.9]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      <mesh position={[0, -0.3, 0.2]}>
        <boxGeometry args={[0.3, 0.24, 1.6]} />
        <meshStandardMaterial color="#2E8C8C" flatShading />
      </mesh>
      {/* engine pods */}
      <mesh position={[-0.62, -0.05, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.95, 7]} />
        <meshStandardMaterial ref={glowL} color="#FFB454" emissive="#FFB454" emissiveIntensity={1} flatShading />
      </mesh>
      <mesh position={[0.62, -0.05, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.95, 7]} />
        <meshStandardMaterial ref={glowR} color="#FFC969" emissive="#FFC969" emissiveIntensity={1} flatShading />
      </mesh>
      {/* handle bars */}
      <mesh position={[0, 0.4, -0.7]}>
        <boxGeometry args={[0.86, 0.07, 0.12]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------- driver + camera rig */

function Driver() {
  const fpsAcc = useRef({ frames: 0, t: 0 });
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    // tape clock
    if (lab.tape) {
      const nt = lab.tapeT + dt;
      if (nt >= TAPE_S) {
        lab.tapeT = 0;
        Object.assign(simFeel, { v: 18, meter: 1, boosting: false, boostTimer: 0 });
      } else {
        lab.tapeT = nt;
      }
    }
    const want = lab.tape ? tapeWantsBoost(lab.tapeT) : lab.wantBoost;
    step(simFeel, want, dt);
    simScroll.d += simFeel.v * dt;

    // synth follows the active pitch candidate
    const ids = activeIds(lab);
    const pitch = findPitch(ids.pitch).f(simFeel);
    synth.update(pitch, Math.min(1, simFeel.v / 50), simFeel.boosting);

    // stats for HUD/panel
    stats.v = simFeel.v;
    stats.meter = simFeel.meter;
    stats.boosting = simFeel.boosting;
    stats.boostTimer = simFeel.boostTimer;
    stats.pitch = pitch;
    const a = fpsAcc.current;
    a.frames += 1;
    a.t += dt;
    if (a.t >= 0.5) {
      stats.fps = Math.round(a.frames / a.t);
      a.frames = 0;
      a.t = 0;
    }
  });
  return null;
}

function Rig() {
  const { camera } = useThree();
  const init = useRef(false);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const cam = camera as THREE.PerspectiveCamera;
    const v = stats.v;
    const t = simFeel.t;

    // chase follow — same recipe as src/game/CameraRig.tsx
    const dist = 7.2 + Math.min(4.5, v * 0.075);
    const height = 2.6 + Math.min(1.2, v * 0.02);
    _target.set(0, height, dist);
    if (!init.current) {
      cam.position.copy(_target);
      init.current = true;
    } else {
      cam.position.lerp(_target, 1 - Math.exp(-4.2 * dt));
    }

    // candidate shake (respects the accessibility toggle)
    const ids = activeIds(lab);
    let amp = findShake(ids.shake).f(simFeel) * lab.shakeAmp;
    if (lab.reducedShake) amp = 0;
    stats.amp = amp;
    if (amp > 0.001) {
      const n1 = Math.sin(t * 37.1) + Math.sin(t * 53.7) * 0.6 + Math.sin(t * 23.3) * 0.8;
      const n2 = Math.sin(t * 41.4 + 1.7) + Math.sin(t * 29.7 + 0.4) * 0.7;
      cam.position.x += n1 * 0.028 * amp;
      cam.position.y += n2 * 0.022 * amp;
    }

    _look.set(0, 1.4 + v * 0.012, -7);
    _lookVel.lerp(_look, 1 - Math.exp(-6 * dt));
    cam.lookAt(_lookVel);

    const targetFov = findFov(ids.fov).f(simFeel, lab.punchSize);
    stats.fov = targetFov;
    if (Math.abs(cam.fov - targetFov) > 0.03) {
      cam.fov += (targetFov - cam.fov) * Math.min(1, 5 * dt);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/* ----------------------------------------------------------------- scene */

export function LabScene() {
  return (
    <>
      <color attach="background" args={['#EADCBB']} />
      <fog attach="fog" args={['#E4D3AE', 200, 1350]} />

      <hemisphereLight args={['#FFF2DC', '#C99E66', 0.85]} />
      <directionalLight
        position={[120, 150, 60]}
        intensity={1.65}
        color="#FFE3B3"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={40}
        shadow-camera-far={380}
        shadow-bias={-0.0004}
      />
      {/* low sun disc, fog-exempt */}
      <mesh position={[130, 70, -1250]}>
        <circleGeometry args={[64, 24]} />
        <meshBasicMaterial color="#FFD9A0" fog={false} />
      </mesh>

      <Ground />
      <Posts />
      <Gates />
      <Mesas />
      <Streaks />
      <Bike />
      <Driver />
      <Rig />
    </>
  );
}

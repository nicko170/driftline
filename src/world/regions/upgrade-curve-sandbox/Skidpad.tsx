/**
 * The mini skidpad: two lanes of salt pan, a scripted 9 s launch tape replayed
 * on a loop. Left lane (rust) rides the *current pip set*, right lane (ghosted
 * bone) rides stock — same integrator as the graphs. The 100 km/h gate of each
 * lane is pulled to wherever that fit actually crosses a hundred, so spending
 * visibly moves a physical thing in the world.
 *
 * Perf: static instanced scenery; two grouped bike meshes; scratch objects
 * module-level — no per-frame allocations.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  bench, STOCK, runLaunch, KMH, TAPE_S, BOOST_ON_T, HUNDRED_MS,
  accelOf, vmaxOf, drainRate, regenRate, PHYS,
  type Pips, type Run,
} from './physics';

export const LANE_CUR = -3.4;
export const LANE_GHOST = 3.4;
const START_Z = 40;
const STRIP_LEN = 780; // z from +60 down to -720
const TAPE_HOLD_S = 1.5; // freeze at tape end before rewind

/* ----------------------------------------------- mutable pad state ---- */

interface PadBike {
  v: number;
  d: number;
  meter: number;
  boosting: boolean;
  prevV: number;
}
export const pad = {
  t: 0,
  hold: 0,
  lap: 1,
  flash: 0,
  pipsKey: '',
  cur: { v: 0, d: 0, meter: 1, boosting: false, prevV: 0 } as PadBike,
  ghost: { v: 0, d: 0, meter: 1, boosting: false, prevV: 0 } as PadBike,
};

function resetPad(key: string) {
  pad.t = 0;
  pad.hold = 0;
  pad.flash = 1;
  pad.pipsKey = key;
  pad.cur = { v: 0, d: 0, meter: 1, boosting: false, prevV: 0 };
  pad.ghost = { v: 0, d: 0, meter: 1, boosting: false, prevV: 0 };
}

/** One physics step, identical to runLaunch() in physics.ts. */
function stepBike(b: PadBike, p: Pips, t: number, dt: number) {
  const boosting = t >= BOOST_ON_T && b.meter > PHYS.boostMin;
  if (boosting) b.meter = Math.max(0, b.meter - dt * drainRate(p.boost));
  else b.meter = Math.min(1, b.meter + dt * regenRate(p.boost));
  const push = accelOf(p.engine, boosting) * (1 - Math.max(0, b.v) / vmaxOf(p.engine, boosting));
  b.prevV = b.v;
  b.v += push * dt;
  b.v *= Math.exp(-PHYS.drag * dt);
  b.d += b.v * dt;
  b.boosting = boosting;
}

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _look = new THREE.Vector3();

/* ---------------------------------------------------------------- ground */

const GROUND_W = 96;

function Ground() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSalt: { value: new THREE.Color('#EFE8D2') },
          uSand: { value: new THREE.Color('#DCC08A') },
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
          uniform vec3 uSalt; uniform vec3 uSand;
          float hash(float n) { return fract(sin(n) * 43758.5453); }
          void main() {
            float u = (vUv.x - 0.5) * ${GROUND_W.toFixed(1)};       // across, m
            float v = (1.0 - vUv.y) * ${STRIP_LEN.toFixed(1)};      // along from start, m
            vec3 col = mix(uSalt, uSand, 0.35);
            col *= 0.94 + 0.06 * hash(floor(v / 7.0) * 31.0 + floor(u / 7.0) * 17.0);
            // lane centre dashes: x = ±3.4 lanes, dash 6 m / 18 m
            float laneDash = (step(abs(abs(u) - ${LANE_GHOST.toFixed(1)}), 0.16)) * step(fract(v / 18.0), 0.34);
            col = mix(col, vec3(0.62, 0.42, 0.22), laneDash * 0.6);
            // centre divider between the two lanes
            float div = step(abs(u), 0.09);
            col = mix(col, vec3(0.5, 0.36, 0.24), div * 0.55);
            // cross ticks every 25 m, heavier at 100 m
            float tick25 = step(fract(v / 25.0), 0.014) * step(abs(u), 8.2);
            float tick100 = step(fract(v / 100.0), 0.03) * step(abs(u), 9.2);
            col = mix(col, vec3(0.55, 0.4, 0.26), tick25 * 0.28);
            col = mix(col, vec3(0.93, 0.72, 0.34), tick100 * 0.75);
            // start line, solid ochre
            float start = step(abs(v - 8.0), 0.5) * step(abs(u), 9.0);
            col = mix(col, vec3(0.69, 0.49, 0.23), start);
            // lane edges
            float edge = step(abs(abs(u) - 9.6), 0.18);
            col = mix(col, vec3(0.7, 0.45, 0.25), edge * 0.8);
            col *= 1.0 - 0.12 * smoothstep(9.6, 30.0, abs(u));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, START_Z + 20 - STRIP_LEN / 2]}>
      <planeGeometry args={[GROUND_W, STRIP_LEN, 1, 1]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/* ------------------------------------------------------------ scenery */

function Posts() {
  const N = 2 * Math.floor(STRIP_LEN / 25); // both edges, every 25 m
  const posts = useRef<THREE.InstancedMesh>(null!);
  const caps = useRef<THREE.InstancedMesh>(null!);
  const placed = useRef(false);
  useFrame(() => {
    if (placed.current) return;
    placed.current = true;
    let i = 0;
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? -10.4 : 10.4;
      for (let k = 0; k < Math.floor(STRIP_LEN / 25); k++) {
        const z = START_Z - 25 - k * 25;
        if (i >= N) break;
        _m.makeTranslation(x, 0.7, z);
        posts.current.setMatrixAt(i, _m);
        _m.makeTranslation(x, 1.46, z);
        caps.current.setMatrixAt(i, _m);
        i++;
      }
    }
    posts.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, undefined, N]} frustumCulled={false}>
        <boxGeometry args={[0.2, 1.4, 0.2]} />
        <meshStandardMaterial color="#D9C9A8" flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, N]} frustumCulled={false}>
        <boxGeometry args={[0.26, 0.14, 0.26]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.4} flatShading />
      </instancedMesh>
    </>
  );
}

const MESA_COLORS = ['#D9A45B', '#B07C3A', '#B3502E', '#C98F4E', '#8FB5B0', '#E4D7BE'];

function Mesas() {
  const N = 22;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        z: START_Z + 40 - (i / N) * (STRIP_LEN + 120) - (Math.sin(i * 12.9) * 0.5 + 0.5) * 60,
        x: (i % 2 === 0 ? -1 : 1) * (64 + ((i * 37) % 120)),
        r: 16 + ((i * 53) % 30),
        h: 12 + ((i * 29) % 26),
        yaw: i * 0.77,
      })),
    [],
  );
  const placed = useRef(false);
  const _q = useMemo(() => new THREE.Quaternion(), []);
  const _e = useMemo(() => new THREE.Euler(), []);
  const _s = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (placed.current) return;
    placed.current = true;
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      _e.set(0, s.yaw, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(s.x, s.h / 2 - 0.5, s.z), _q, _s.set(s.r, s.h, s.r * 0.8));
      mesh.current.setMatrixAt(i, _m);
      c.set(MESA_COLORS[i % MESA_COLORS.length]);
      mesh.current.setColorAt(i, c);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1.25, 1, 5]} />
      <meshStandardMaterial color="#FFFFFF" flatShading />
    </instancedMesh>
  );
}

/* ----------------------------------------------------------- 100 gates */

function Gate({ lane, run, ghost }: { lane: number; run: Run; ghost?: boolean }) {
  const d = run.d100;
  const z = START_Z - (d ?? TAPE_S * 40); // out of reach: park it past the tape end, dimmed
  const dim = d === null;
  return (
    <group position={[lane, 0, z]}>
      {[-1.7, 1.7].map((dx) => (
        <mesh key={dx} position={[dx, 2.1, 0]}>
          <boxGeometry args={[0.34, 4.2, 0.34]} />
          <meshStandardMaterial
            color={ghost ? '#D9C9A8' : '#7E3320'}
            emissive={ghost ? '#000000' : '#FFB454'}
            emissiveIntensity={dim ? 0.05 : 0.5}
            transparent={!!ghost}
            opacity={ghost ? 0.4 : 1}
            flatShading
          />
        </mesh>
      ))}
      <mesh position={[0, 4.1, 0]}>
        <boxGeometry args={[4.1, 0.34, 0.34]} />
        <meshStandardMaterial
          color={ghost ? '#D9C9A8' : '#E4D7BE'}
          transparent={!!ghost}
          opacity={ghost ? 0.4 : 1}
          flatShading
        />
      </mesh>
      <mesh position={[0, 3.72, 0]}>
        <boxGeometry args={[3.7, 0.18, 0.24]} />
        <meshStandardMaterial
          color={ghost ? '#E4D7BE' : '#FFC969'}
          emissive={ghost ? '#E4D7BE' : '#FFC969'}
          emissiveIntensity={dim ? 0.12 : 2}
          transparent={!!ghost || dim}
          opacity={dim ? 0.3 : ghost ? 0.5 : 1}
        />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- bikes */

function BikeBody({ ghost }: { ghost?: boolean }) {
  const hull = ghost ? '#E4D7BE' : '#B3502E';
  const trim = ghost ? '#D9C9A8' : '#E4D7BE';
  const keel = ghost ? '#CBBFA6' : '#2E8C8C';
  const o = ghost ? { transparent: true, opacity: 0.38 } : {};
  return (
    <group>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[0.92, 0.42, 2.5]} />
        <meshStandardMaterial color={hull} flatShading {...o} />
      </mesh>
      <mesh position={[0, 0.02, -1.55]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <coneGeometry args={[0.4, 0.9, 4]} />
        <meshStandardMaterial color={trim} flatShading {...o} />
      </mesh>
      <mesh position={[0, 0.32, 0.5]}>
        <boxGeometry args={[0.5, 0.22, 0.9]} />
        <meshStandardMaterial color={trim} flatShading {...o} />
      </mesh>
      <mesh position={[0, -0.3, 0.2]}>
        <boxGeometry args={[0.3, 0.24, 1.6]} />
        <meshStandardMaterial color={keel} flatShading {...o} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, -0.05, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.28, 0.95, 7]} />
          <meshStandardMaterial
            color={ghost ? '#E4D7BE' : '#FFB454'}
            emissive={ghost ? '#888078' : '#FFB454'}
            emissiveIntensity={ghost ? 0.3 : 1.1}
            flatShading
            {...o}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.4, -0.7]}>
        <boxGeometry args={[0.86, 0.07, 0.12]} />
        <meshStandardMaterial color={trim} flatShading {...o} />
      </mesh>
    </group>
  );
}

function PadBikes() {
  const cur = useRef<THREE.Group>(null!);
  const ghost = useRef<THREE.Group>(null!);
  useFrame(() => {
    const bob = Math.sin(pad.t * Math.PI * 4) * 0.045;
    const c = cur.current;
    if (c) {
      const b = pad.cur;
      c.position.set(LANE_CUR, 1.06 + bob + (b.boosting ? 0.1 : 0), START_Z - b.d);
      c.rotation.x = THREE.MathUtils.clamp(-(b.v - b.prevV) * 60 * 0.012, -0.2, 0.06);
      c.rotation.z = Math.sin(pad.t * 0.9) * 0.02;
    }
    const g = ghost.current;
    if (g) {
      const b = pad.ghost;
      g.position.set(LANE_GHOST, 1.06 + bob + (b.boosting ? 0.1 : 0), START_Z - b.d);
      g.rotation.x = THREE.MathUtils.clamp(-(b.v - b.prevV) * 60 * 0.012, -0.2, 0.06);
      g.rotation.z = Math.sin(pad.t * 0.9 + 1.3) * 0.02;
    }
  });
  return (
    <>
      <group ref={cur}><BikeBody /></group>
      <group ref={ghost}><BikeBody ghost /></group>
    </>
  );
}

/* ------------------------------------------------------ driver + rig */

function PadDriver() {
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const key = `${bench.pips.engine}${bench.pips.handling}${bench.pips.boost}`;
    if (key !== pad.pipsKey) {
      pad.lap += 1;
      resetPad(key);
    }
    if (pad.hold > 0) {
      pad.hold -= dt;
      pad.flash = Math.max(0, pad.flash - dt * 2.2);
      if (pad.hold <= 0) {
        pad.lap += 1;
        resetPad(`${bench.pips.engine}${bench.pips.handling}${bench.pips.boost}`);
      }
      return;
    }
    if (pad.flash > 0) pad.flash = Math.max(0, pad.flash - dt * 2.2);
    pad.t += dt;
    stepBike(pad.cur, bench.pips, pad.t, dt);
    stepBike(pad.ghost, STOCK, pad.t, dt);
    if (pad.t >= TAPE_S) pad.hold = TAPE_HOLD_S;
  });
  return null;
}

function Rig() {
  const { camera } = useThree();
  const init = useRef(false);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const cam = camera as THREE.PerspectiveCamera;
    const midZ = START_Z - pad.cur.d;
    _v.set(10.5, 3.9, midZ + 13);
    if (!init.current) {
      cam.position.copy(_v);
      init.current = true;
    } else {
      cam.position.lerp(_v, 1 - Math.exp(-4.5 * dt));
    }
    _look.set(0, 1.3, midZ - 9);
    cam.lookAt(_look);
    const fov = 55 + Math.min(15, pad.cur.v * KMH * 0.09);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, 3.2 * dt);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/* ---------------------------------------------------------------- scene */

export function SkidpadScene({ pips }: { pips: Pips }) {
  const curRun = useMemo(() => runLaunch(pips, true), [pips]);
  const stockRun = useMemo(() => runLaunch(STOCK, true), []);
  return (
    <>
      <color attach="background" args={['#EADCBB']} />
      <fog attach="fog" args={['#E4D3AE', 240, 1050]} />
      <hemisphereLight args={['#FFF2DC', '#C99E66', 0.9]} />
      <directionalLight position={[120, 150, 60]} intensity={1.6} color="#FFE3B3" />
      <mesh position={[140, 64, -900]}>
        <circleGeometry args={[56, 24]} />
        <meshBasicMaterial color="#FFD9A0" fog={false} />
      </mesh>
      <Ground />
      <Posts />
      <Mesas />
      <Gate lane={LANE_CUR} run={curRun} />
      <Gate lane={LANE_GHOST} run={stockRun} ghost />
      <PadBikes />
      <PadDriver />
      <Rig />
    </>
  );
}

/** Derived HUD values the DOM polls (no react state churn). */
export const padHud = {
  get lap() { return pad.lap; },
  get t() { return pad.t; },
  get hold() { return pad.hold; },
  get flash() { return pad.flash; },
  get curKmh() { return pad.cur.v * KMH; },
  get ghostKmh() { return pad.ghost.v * KMH; },
  get curMeter() { return pad.cur.meter; },
  get boosting() { return pad.cur.boosting; },
};

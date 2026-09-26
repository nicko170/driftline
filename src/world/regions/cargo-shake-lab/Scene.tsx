/**
 * CARGO SHAKE LAB — the test pan scene.
 *
 * A treadmill like the boost strip: the ghost bike hovers at the origin facing
 * −z while the whole 352 m course (rocks, gantry, launch berm, landing scuffs,
 * storm curtains, finish arch) scrolls past at the canned 22 m/s. Scripted
 * impacts fire when their distance marker crosses the bike, and the canned
 * hop/land pairs play out as real little ballistics so the hard landing
 * *reads* like one.
 *
 * Fixed instrumentation: two gauge pylons beside the start line (main =
 * current params, hollow bone plate = the stashed ghost A params) fill with
 * live integrity. Amber ring flash = cargo took damage; teal ring = the shield
 * soaked it. All state lives in ./sim.ts module objects — nothing allocates
 * per frame.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  lab, run, stats, feed, runPts, findSeq, resolveHit, payoutOf, ghostIntegrityNow,
  resetRun, startRun, EVENTS, RUN_V, RUN_M, HOVER_Y, GRAV,
} from './sim';
import { synth } from './synth';

const BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

const MAIN_X = 0;
const GHOST_X = 2.6;
const CULL_FAR = -430;
const CULL_NEAR = 62;

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _lookVel = new THREE.Vector3();
const _c = new THREE.Color();
const _teal = new THREE.Color('#57C4B8');
const _amber = new THREE.Color('#FFB454');
const _danger = new THREE.Color('#E4572E');

/** integrity → display colour: teal (intact) → amber → danger red. */
function integrityColor(i: number, out: THREE.Color): THREE.Color {
  if (i > 0.6) return out.copy(_amber).lerp(_teal, (i - 0.6) / 0.4);
  return out.copy(_danger).lerp(_amber, Math.max(0, i / 0.6));
}

/* ---------------------------------------------------------------- ground */

const GROUND_LEN = 1600;
const GROUND_W = 64;

function Ground() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uScroll: { value: 0 },
          uSalt: { value: new THREE.Color('#EFE8D2') },
          uSand: { value: new THREE.Color('#D9B477') },
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
          uniform vec3 uSalt; uniform vec3 uSand;
          float hash(float n) { return fract(sin(n) * 43758.5453); }
          void main() {
            float u = (vUv.x - 0.5) * ${GROUND_W.toFixed(1)};      // across, metres
            float v = vUv.y * ${GROUND_LEN.toFixed(1)} + uScroll;  // along, metres
            vec3 col = mix(uSalt, uSand, 0.28 + 0.12 * hash(floor(v / 260.0)));
            // salt mottle
            col *= 0.94 + 0.06 * hash(floor(v / 7.0) * 31.0 + floor(u / 7.0) * 17.0);
            // lane edges (test lane spans x -5 .. +6)
            float edge = step(abs(abs(u - 0.5) - 5.5), 0.15);
            col = mix(col, vec3(0.93, 0.72, 0.34), edge * 0.85);
            // lane divider dashes between main run + ghost lane (x = 1.3)
            float dash = step(fract(v / 9.0), 0.4) * step(abs(u - 1.3), 0.09);
            col = mix(col, vec3(0.62, 0.5, 0.34), dash * 0.5);
            // cross ticks every 25 m (subtle) and 100 m (strong)
            float tick25 = step(fract(v / 25.0), 0.014) * step(abs(u - 0.5), 6.2);
            float tick100 = step(fract(v / 100.0), 0.02) * step(abs(u - 0.5), 7.5);
            col = mix(col, vec3(0.55, 0.4, 0.26), tick25 * 0.3);
            col = mix(col, vec3(0.5, 0.34, 0.2), tick100 * 0.55);
            // storm-zone tint beyond 285 m
            col = mix(col, col * vec3(1.06, 0.9, 0.78), smoothstep(285.0, 320.0, v) * smoothstep(372.0, 350.0, v));
            // outside the lane, fall darker
            col *= 1.0 - 0.12 * smoothstep(8.0, 26.0, abs(u - 0.5));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );
  useFrame(() => {
    mat.uniforms.uScroll.value = run.dist % 130000; // 130 000 is a multiple of 25, 100 and the 260 band… close enough for tint bands
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -700]} receiveShadow>
      <planeGeometry args={[GROUND_W, GROUND_LEN, 1, 1]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/* -------------------------------------------------------------- posts */

const POST_RANGE = 500;

function Posts() {
  const N = 20; // per side, spacing 25 m
  const posts = useRef<THREE.InstancedMesh>(null!);
  const caps = useRef<THREE.InstancedMesh>(null!);
  const beacons = useRef<THREE.InstancedMesh>(null!);
  useFrame(() => {
    const d = run.dist;
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? -5.7 : 6.7;
      for (let i = 0; i < N; i++) {
        const z = ((((i * 25 + side * 12.5 + d) % POST_RANGE) + POST_RANGE) % POST_RANGE) - POST_RANGE + 50;
        const idx = side * N + i;
        _m.makeTranslation(x, 0.7, z);
        posts.current.setMatrixAt(idx, _m);
        _m.makeTranslation(x, 1.45, z);
        caps.current.setMatrixAt(idx, _m);
      }
      for (let i = 0; i < 6; i++) {
        const z = ((((i * 100 + d) % POST_RANGE) + POST_RANGE) % POST_RANGE) - POST_RANGE + 50;
        _m.makeTranslation(x, 1.15, z);
        beacons.current.setMatrixAt(side * 6 + i, _m);
      }
    }
    posts.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
    beacons.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <boxGeometry args={[0.2, 1.4, 0.2]} />
        <meshStandardMaterial color="#CDBB96" flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <boxGeometry args={[0.26, 0.1, 0.26]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </instancedMesh>
      <instancedMesh ref={beacons} args={[undefined, undefined, 12]} frustumCulled={false}>
        <boxGeometry args={[0.16, 0.7, 0.16]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.5} flatShading />
      </instancedMesh>
    </>
  );
}

/* -------------------------------------------------------------- mesas */

const MESA_COLORS = ['#D9A45B', '#B07C3A', '#B3502E', '#C98F4E', '#8FB5B0', '#E4D7BE'];

function Mesas() {
  const N = 24;
  const RANGE = 1600;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        z: (i / N) * RANGE + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 110,
        x: (i % 2 === 0 ? -1 : 1) * (56 + ((i * 37) % 120)),
        r: 13 + ((i * 53) % 24),
        h: 9 + ((i * 29) % 22),
        yaw: i * 0.77,
      })),
    [],
  );
  useFrame(() => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const z = ((((s.z + run.dist) % RANGE) + RANGE) % RANGE) - RANGE + 90;
      _e.set(0, s.yaw, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(s.x, s.h / 2 - 0.5, z), _q, _s.set(s.r, s.h, s.r * 0.8));
      mesh.current.setMatrixAt(i, _m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    let ic = mesh.current.instanceColor;
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

/* -------------------------------------------------- decorative rocks */

function DecoRocks() {
  const N = 34;
  const RANGE = 500;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        z: (i / N) * RANGE,
        x: (i % 2 === 0 ? -1 : 1) * (10 + ((i * 23) % 17)),
        s: 0.5 + ((i * 41) % 16) / 10,
        yaw: i * 1.31,
      })),
    [],
  );
  useFrame(() => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const z = ((((s.z + run.dist) % RANGE) + RANGE) % RANGE) - RANGE + 50;
      _e.set(0, s.yaw, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(s.x, s.s * 0.3, z), _q, _s.set(s.s, s.s * 0.72, s.s));
      mesh.current.setMatrixAt(i, _m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#C9A06A" flatShading />
    </instancedMesh>
  );
}

/* ---------------------------------------------- course obstacle props */

/**
 * Every scripted hit has a physical prop on the pan. Positions key off the
 * event distances in sim.ts: world z = run.dist − eventDist. The ghost bike
 * passes straight through them (it's a ghost — that's the joke and the
 * read), so props never need colliders here.
 */
function Obstacles() {
  const root = useRef<THREE.Group>(null!);
  useFrame(() => {
    const g = root.current;
    const d = run.dist;
    for (let i = 0; i < g.children.length; i++) {
      const c = g.children[i];
      const u = c.userData as { dist: number; drift?: number; baseX?: number };
      const z = d - u.dist;
      c.position.z = z;
      c.visible = z > CULL_FAR && z < CULL_NEAR;
      if (u.drift !== undefined && c.visible) {
        c.position.x = (u.baseX ?? 0) + Math.sin(run.t * 0.55 + u.drift) * 2.6;
      }
    }
  });
  return (
    <group ref={root}>
      {/* small rock — rock-a @ 60 */}
      <mesh castShadow userData={{ dist: 60 }} position={[0.1, 0.26, 0]}>
        <dodecahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial color="#B07C3A" flatShading />
      </mesh>
      {/* rubble graze — rock-b @ 78, half-buried */}
      <mesh castShadow userData={{ dist: 78 }} position={[0.95, 0.12, 0]}>
        <dodecahedronGeometry args={[0.36, 0]} />
        <meshStandardMaterial color="#C9A06A" flatShading />
      </mesh>
      {/* gantry — gantry-clip @ 130: gate legs + beam, plus the intruding stub that clips */}
      <mesh castShadow userData={{ dist: 130 }} position={[-3.6, 3, 0]}>
        <boxGeometry args={[0.9, 6, 0.9]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      <mesh castShadow userData={{ dist: 130 }} position={[4.2, 3, 0]}>
        <boxGeometry args={[0.9, 6, 0.9]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      <mesh castShadow userData={{ dist: 130 }} position={[0.3, 6.1, 0]}>
        <boxGeometry args={[8.8, 0.7, 0.7]} />
        <meshStandardMaterial color="#D9C9A8" flatShading />
      </mesh>
      <mesh userData={{ dist: 130 }} position={[0.3, 5.72, 0]}>
        <boxGeometry args={[7.6, 0.2, 0.3]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.7} flatShading />
      </mesh>
      <mesh castShadow userData={{ dist: 130 }} position={[0.55, 0.85, 0.4]} rotation={[0.12, 0, 0.45]}>
        <boxGeometry args={[0.5, 2.1, 0.5]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      {/* leaning post — gantry-graze @ 139 */}
      <mesh castShadow userData={{ dist: 139 }} position={[-0.9, 1.0, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.42, 2.4, 0.42]} />
        <meshStandardMaterial color="#8F4126" flatShading />
      </mesh>
      {/* launch berm — hop-main @ 190 (rises toward −z, i.e. travel) */}
      <mesh castShadow userData={{ dist: 186 }} position={[0.4, 0.6, 0]} rotation={[0.17, 0, 0]}>
        <boxGeometry args={[5.6, 1.5, 9.5]} />
        <meshStandardMaterial color="#C98F4E" flatShading />
      </mesh>
      <mesh userData={{ dist: 190.5 }} position={[0.4, 1.5, 0]}>
        <boxGeometry args={[5.6, 0.16, 0.5]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.2} flatShading />
      </mesh>
      {/* landing scuffs — land-main @ 212, land-second @ 264 */}
      <mesh userData={{ dist: 212 }} position={[0.4, 0.035, 0]} receiveShadow>
        <boxGeometry args={[3.6, 0.07, 3.0]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      <mesh userData={{ dist: 264 }} position={[0.2, 0.035, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.07, 2.4]} />
        <meshStandardMaterial color="#8F4126" flatShading />
      </mesh>
      {/* salt ledge — hop-second @ 250 */}
      <mesh castShadow userData={{ dist: 247 }} position={[0.2, 0.25, 0]}>
        <boxGeometry args={[4.2, 0.55, 3.2]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      <mesh userData={{ dist: 248.6 }} position={[0.2, 0.56, 0]}>
        <boxGeometry args={[4.2, 0.12, 0.24]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.4} flatShading />
      </mesh>
      {/* storm section — gusts @ 298…343: drifting sand curtains + pennants */}
      {[296, 308, 320, 332, 344].map((dist, i) => (
        <mesh key={`curtain-${dist}`} userData={{ dist, drift: i * 1.7, baseX: [-8, 3, -2, 8, 0][i] }} position={[0, 4.6, 0]}>
          <planeGeometry args={[24, 9]} />
          <meshBasicMaterial color="#C98F4E" transparent opacity={0.14} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[290, 308, 326, 344].map((dist, i) => (
        <group key={`pennant-${dist}`} userData={{ dist }}>
          <mesh castShadow position={[-6.6, 1.5, 0]}>
            <boxGeometry args={[0.14, 3, 0.14]} />
            <meshStandardMaterial color="#7E3320" flatShading />
          </mesh>
          <mesh position={[-6.25, 2.7, 0]} rotation={[0, 0, i % 2 === 0 ? 0.2 : -0.1]}>
            <coneGeometry args={[0.3, 1.0, 3]} />
            <meshStandardMaterial color="#E4572E" emissive="#E4572E" emissiveIntensity={0.5} flatShading />
          </mesh>
        </group>
      ))}
      {/* finish arch @ 352 */}
      <mesh castShadow userData={{ dist: 352 }} position={[-5.2, 3.2, 0]}>
        <boxGeometry args={[0.7, 6.4, 0.7]} />
        <meshStandardMaterial color="#2E8C8C" flatShading />
      </mesh>
      <mesh castShadow userData={{ dist: 352 }} position={[7.8, 3.2, 0]}>
        <boxGeometry args={[0.7, 6.4, 0.7]} />
        <meshStandardMaterial color="#2E8C8C" flatShading />
      </mesh>
      <mesh castShadow userData={{ dist: 352 }} position={[1.3, 6.5, 0]}>
        <boxGeometry args={[13.8, 0.6, 0.6]} />
        <meshStandardMaterial color="#D9C9A8" flatShading />
      </mesh>
      <mesh userData={{ dist: 352 }} position={[1.3, 6.14, 0]}>
        <boxGeometry args={[12.6, 0.18, 0.3]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.8} flatShading />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------- event pennants */

/** A pennant flag per scripted event at the left lane edge — colour and shape
 * read the impact kind; unfired flags fly bright, fired flags dip dim. */
function EventMarkers() {
  const N = EVENTS.length;
  const posts = useRef<THREE.InstancedMesh>(null!);
  const flags = useRef<THREE.InstancedMesh>(null!);
  const kindColor = useMemo(() => {
    const map = new Map<string, THREE.Color>();
    map.set('rock', new THREE.Color('#B07C3A'));
    map.set('graze', new THREE.Color('#D9A45B'));
    map.set('clip', new THREE.Color('#B3502E'));
    map.set('land', new THREE.Color('#FFB454'));
    map.set('gust', new THREE.Color('#E4572E'));
    map.set('hop', new THREE.Color('#57C4B8'));
    return map;
  }, []);
  useFrame(() => {
    const seq = findSeq(lab.seq);
    for (let i = 0; i < N; i++) {
      const ev = EVENTS[i];
      const z = run.dist - ev.dist;
      const vis = z > CULL_FAR && z < CULL_NEAR;
      const y = 0.9 + (i % 3) * 0.28;
      _m.makeTranslation(-6.4, vis ? y + 0.5 : -100, z);
      posts.current.setMatrixAt(i, _m);
      _e.set(0, 0, vis && seq.events.includes(ev.id) ? (run.fired.has(ev.id) ? -0.5 : 0.06) : 0.14);
      _q.setFromEuler(_e);
      const s = vis && seq.events.includes(ev.id) ? 1 : 0.62;
      _m.compose(_v.set(-6.15, vis ? y + 1.06 : -100, z), _q, _s.set(s, s, s));
      flags.current.setMatrixAt(i, _m);
    }
    posts.current.instanceMatrix.needsUpdate = true;
    flags.current.instanceMatrix.needsUpdate = true;
    // colors once + on sequence/fire changes are cheap enough to redo per frame
    for (let i = 0; i < N; i++) {
      const ev = EVENTS[i];
      const inSeq = seq.events.includes(ev.id);
      const fired = run.fired.has(ev.id);
      _c.copy(kindColor.get(ev.kind) ?? _amber);
      if (!inSeq) _c.multiplyScalar(0.35);
      else if (fired) _c.multiplyScalar(0.55);
      flags.current.setColorAt(i, _c);
    }
    if (flags.current.instanceColor) flags.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, undefined, N]} frustumCulled={false}>
        <boxGeometry args={[0.09, 1.0, 0.09]} />
        <meshStandardMaterial color="#5F4A33" flatShading />
      </instancedMesh>
      <instancedMesh ref={flags} args={[undefined, undefined, N]} frustumCulled={false}>
        <coneGeometry args={[0.34, 0.72, 3]} />
        <meshStandardMaterial color="#FFFFFF" flatShading />
      </instancedMesh>
    </>
  );
}

/* ------------------------------------------------------- ghost bikes */

interface BikeMats {
  hull: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  teal: THREE.MeshStandardMaterial;
  glowL: THREE.MeshStandardMaterial;
  glowR: THREE.MeshStandardMaterial;
  crate: THREE.MeshStandardMaterial;
}

function useBikeMats(hullColor: string, glowColor: string): BikeMats {
  return useMemo(() => {
    const std = (color: string, extra?: Partial<THREE.MeshStandardMaterialParameters>) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, transparent: true, ...extra });
    return {
      hull: std(hullColor),
      dark: std('#8F4126'),
      bone: std('#E4D7BE'),
      teal: std('#2E8C8C'),
      glowL: std(glowColor, { emissive: new THREE.Color(glowColor), emissiveIntensity: 1.2 }),
      glowR: std(glowColor, { emissive: new THREE.Color(glowColor), emissiveIntensity: 1.2 }),
      crate: std('#57C4B8', { emissive: new THREE.Color('#57C4B8'), emissiveIntensity: 0.7 }),
    };
  }, [hullColor, glowColor]);
}

const ALL_MATS = (m: BikeMats) => [m.hull, m.dark, m.bone, m.teal, m.glowL, m.glowR, m.crate];

function GhostBike({ x, ghost }: { x: number; ghost?: boolean }) {
  const mats = useBikeMats(ghost ? '#8A7F94' : '#B3502E', ghost ? '#C7BcD6' : '#FFB454');
  const group = useRef<THREE.Group>(null!);
  const crate = useRef<THREE.Mesh>(null!);
  const base = ghost ? 0.32 : 0.8;

  useFrame(() => {
    const op = base * run.fade * (ghost ? (lab.ghostOn && lab.stash ? 1 : 0) : 1);
    group.current.visible = op > 0.012;
    if (!group.current.visible) return;
    for (const m of ALL_MATS(mats)) m.opacity = op;

    const rm = lab.reducedMotion;
    const bob = Math.sin(run.t * Math.PI * 4) * 0.045;
    const bounceEnv = Math.exp(-run.bounceT * 5.2) * (rm ? 0.45 : 1);
    const bounce = run.bounceA * Math.sin(run.bounceT * 22) * bounceEnv;
    group.current.position.set(
      x + Math.sin(run.t * 12.7) * 0.1 * run.wobble * (rm ? 0.4 : 1),
      run.y + (run.airborne ? 0 : bob) + bounce,
      0,
    );
    group.current.rotation.z =
      run.lean * (rm ? 0.5 : 1) + Math.sin(run.t * 0.9) * 0.02 + Math.sin(run.t * 4.4) * 0.012 * run.wobble;
    group.current.rotation.x = -0.02 + (run.airborne ? Math.max(-0.3, Math.min(0.22, -run.vy * 0.022)) : 0);

    // cargo crate colour + jitter carries the integrity read
    const integ = ghost ? ghostIntegrityNow() : run.integrity;
    integrityColor(integ, _c);
    mats.crate.color.copy(_c);
    mats.crate.emissive.copy(_c);
    mats.crate.emissiveIntensity = 0.45 + (1 - integ) * 0.9;
    crate.current.position.x = Math.sin(run.t * 31) * 0.03 * (1 - integ) * (rm ? 0.4 : 1);
    crate.current.position.y = 0.44 + Math.abs(Math.sin(run.t * 26)) * 0.02 * (1 - integ);
  });

  return (
    <group ref={group} position={[x, HOVER_Y, 0]}>
      <mesh material={mats.hull} position={[0, 0, 0.1]}>
        <boxGeometry args={[0.92, 0.42, 2.5]} />
      </mesh>
      <mesh material={mats.dark} position={[0, 0.02, -1.55]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <coneGeometry args={[0.4, 0.9, 4]} />
      </mesh>
      <mesh material={mats.bone} position={[0, 0.32, 0.35]}>
        <boxGeometry args={[0.5, 0.22, 0.7]} />
      </mesh>
      <mesh material={mats.teal} position={[0, -0.3, 0.2]}>
        <boxGeometry args={[0.3, 0.24, 1.6]} />
      </mesh>
      <mesh material={mats.glowL} position={[-0.62, -0.05, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.95, 7]} />
      </mesh>
      <mesh material={mats.glowR} position={[0.62, -0.05, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.95, 7]} />
      </mesh>
      <mesh material={mats.dark} position={[0, 0.4, -0.7]}>
        <boxGeometry args={[0.86, 0.07, 0.12]} />
      </mesh>
      {/* the fragile crate, strapped behind the saddle */}
      <mesh ref={crate} material={mats.crate} position={[0, 0.44, 0.95]}>
        <boxGeometry args={[0.62, 0.5, 0.62]} />
      </mesh>
      {/* dashed under-ring — the bench ghost read */}
      <DashedRing radius={1.15} color={ghost ? '#C7BCD6' : '#FFB454'} mats={mats} />
    </group>
  );
}

function DashedRing({ radius, color, mats }: { radius: number; color: string; mats: BikeMats }) {
  const segs = 10;
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }),
    [color],
  );
  useFrame(() => {
    mat.opacity = mats.hull.opacity * 0.55;
  });
  return (
    <group position={[0, -HOVER_Y + 0.1, 0]}>
      {Array.from({ length: segs }, (_, i) => {
        const a = (i / segs) * Math.PI * 2;
        return (
          <mesh
            key={i}
            material={mat}
            position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}
            rotation={[0, -a + Math.PI / 2, 0]}
          >
            <boxGeometry args={[(radius * Math.PI * 2) / segs * 0.55, 0.03, 0.09]} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------- impact rings */

function ImpactRings() {
  const hitRef = useRef<THREE.Mesh>(null!);
  const soakRef = useRef<THREE.Mesh>(null!);
  const hitMat = useRef<THREE.MeshBasicMaterial>(null!);
  const soakMat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const hf = run.hitFlash;
    hitRef.current.visible = hf > 0.01;
    if (hitRef.current.visible) {
      const s = 0.7 + (1 - hf) * 2.6;
      hitRef.current.scale.set(s, s, s);
      hitMat.current.opacity = hf * 0.75 * run.fade;
    }
    const sf = run.soakFlash;
    soakRef.current.visible = sf > 0.01;
    if (soakRef.current.visible) {
      const s = 0.55 + (1 - sf) * 1.6;
      soakRef.current.scale.set(s, s, s);
      soakMat.current.opacity = sf * 0.7 * run.fade;
    }
  });
  return (
    <>
      <mesh ref={hitRef} position={[MAIN_X, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 1, 28]} />
        <meshBasicMaterial ref={hitMat} color="#FFB454" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={soakRef} position={[MAIN_X, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.82, 28]} />
        <meshBasicMaterial ref={soakMat} color="#57C4B8" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

/* -------------------------------------------------------- gauge pylons */

const GAUGE_H = 2.9;
const GAUGE_Y = 0.4;

function GaugePylon({ x, z, ghost }: { x: number; z: number; ghost?: boolean }) {
  const fill = useRef<THREE.Mesh>(null!);
  const fillMat = useRef<THREE.MeshStandardMaterial>(null!);
  const capMat = useRef<THREE.MeshStandardMaterial>(null!);
  const root = useRef<THREE.Group>(null!);
  useFrame(() => {
    const on = ghost ? lab.ghostOn && !!lab.stash : true;
    root.current.visible = !!on;
    if (!on) return;
    const integ = ghost ? ghostIntegrityNow() : run.integrity;
    const h = Math.max(0.02, integ);
    fill.current.scale.y = h;
    fill.current.position.y = GAUGE_Y + (h * GAUGE_H) / 2;
    integrityColor(integ, _c);
    fillMat.current.color.copy(_c);
    fillMat.current.emissive.copy(_c);
    // plate flash on hits / soaks (main pylon only)
    const flash = ghost ? 0 : Math.max(run.hitFlash, run.soakFlash * 0.7);
    capMat.current.emissiveIntensity = 0.9 + flash * 2.2;
  });
  return (
    <group ref={root} position={[x, 0, z]}>
      {/* frame */}
      <mesh castShadow position={[-0.34, GAUGE_Y + GAUGE_H / 2, 0]}>
        <boxGeometry args={[0.12, GAUGE_H + 0.3, 0.12]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      <mesh castShadow position={[0.34, GAUGE_Y + GAUGE_H / 2, 0]}>
        <boxGeometry args={[0.12, GAUGE_H + 0.3, 0.12]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      <mesh castShadow position={[0, GAUGE_Y + GAUGE_H + 0.36, 0]}>
        <boxGeometry args={[0.94, 0.16, 0.2]} />
        <meshStandardMaterial color="#D9C9A8" flatShading />
      </mesh>
      {/* glass fill */}
      <mesh ref={fill} position={[0, GAUGE_Y + GAUGE_H / 2, 0]}>
        <boxGeometry args={[0.52, GAUGE_H, 0.1]} />
        <meshStandardMaterial ref={fillMat} color="#57C4B8" emissive="#57C4B8" emissiveIntensity={0.75} flatShading />
      </mesh>
      {/* tick marks at 25/50/75% */}
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} position={[0.36, GAUGE_Y + GAUGE_H * f, 0]}>
          <boxGeometry args={[0.12, 0.03, 0.14]} />
          <meshStandardMaterial color="#F3EEE2" flatShading />
        </mesh>
      ))}
      {/* plate: amber diamond = current params, bone square = stashed ghost */}
      <mesh
        castShadow
        position={[0, GAUGE_Y + GAUGE_H + 0.78, 0]}
        rotation={ghost ? [0, 0, 0] : [0, 0, Math.PI / 4]}
      >
        <boxGeometry args={[0.34, 0.34, 0.1]} />
        <meshStandardMaterial
          ref={capMat}
          color={ghost ? '#E4D7BE' : '#FFB454'}
          emissive={ghost ? '#E4D7BE' : '#FFB454'}
          emissiveIntensity={0.9}
          flatShading
        />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- dust */

function Dust() {
  const N = 110;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        z: (i / N) * 100,
        x: Math.sin(i * 91.7) * 14,
        y: 0.3 + (Math.sin(i * 47.3) * 0.5 + 0.5) * 4.6,
        ph: i * 0.71,
      })),
    [],
  );
  useFrame(() => {
    // thicker as the run enters the storm section (285–355 m)
    const prox = lab.running
      ? Math.max(0, Math.min(1, (run.dist - 272) / 50)) * Math.max(0, Math.min(1, (368 - run.dist) / 40))
      : 0;
    mat.current.opacity = 0.16 + prox * 0.22;
    const speed = lab.running ? RUN_V * 1.15 : 2.2;
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const rr = ((((s.z + run.dist * 1.15 + (lab.running ? 0 : run.t * speed * 0.2)) % 100) + 100) % 100) - 100 + 14;
      const x = s.x + Math.sin(run.t * 0.9 + s.ph) * (1.2 + prox * 1.6);
      const y = s.y + Math.sin(run.t * 0.6 + s.ph * 2.1) * 0.5;
      _m.makeTranslation(x, y, rr);
      mesh.current.setMatrixAt(i, _m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <tetrahedronGeometry args={[0.085]} />
      <meshBasicMaterial ref={mat} color="#E8C88F" transparent opacity={0.16} depthWrite={false} />
    </instancedMesh>
  );
}

/* -------------------------------------------------------- sim driver */

function fireEvent(evid: string): void {
  const ev = BY_ID.get(evid);
  if (!ev) return;
  run.fired.add(evid);
  if (ev.hop) {
    run.vy = ev.hop;
    run.airborne = true;
    synth.tick(520, 0.03);
    return;
  }
  const { raw, loss } = resolveHit(ev.impulse, lab.params);
  if (loss > 0) {
    run.cumLoss += loss;
    run.integrity = Math.max(0, run.integrity - loss);
    run.hitFlash = 1;
    run.shake = Math.min(1, raw / 22);
    run.bounceA = Math.min(0.5, 0.08 + raw * 0.018);
    run.bounceT = 0;
    if (ev.kind === 'clip' || ev.kind === 'graze') run.lean = ev.kind === 'clip' ? 0.4 : 0.22;
    synth.thud(Math.min(1, raw / 26));
  } else if (ev.impulse > lab.params.threshold && raw <= 0) {
    run.soakFlash = 1; // the shield drank the whole hit
    synth.tick(430, 0.05);
  } else if (ev.impulse > lab.params.threshold) {
    run.soakFlash = 0.8; // raw contact, under the graze floor — a scuff
    synth.tick(700, 0.028);
  } else {
    synth.tick(1050, 0.016); // sub-threshold kiss
  }
  runPts.push({ impulse: ev.impulse, loss, id: evid });
  feed.push({ t: run.t, label: ev.label, impulse: ev.impulse, loss, raw });
  if (run.integrity <= 0 && lab.running) finishRun(true);
}

function finishRun(shattered: boolean): void {
  const integrity = Math.max(0, run.integrity);
  run.lastFinal = { seq: lab.seq, integrity, payout: payoutOf(integrity), shattered };
  synth.chime(!shattered);
  lab.running = false;
}

function Driver() {
  const fpsAcc = useRef({ frames: 0, t: 0 });
  const idleT = useRef(99); // big: don't auto-loop on first mount
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);

    if (lab.running) {
      idleT.current = 0;
      run.t += dt;
      run.dist += RUN_V * dt;

      // ballistics for the scripted hops
      if (run.airborne) {
        run.vy -= GRAV * dt;
        run.y += run.vy * dt;
        if (run.y <= HOVER_Y && run.vy < 0) {
          run.y = HOVER_Y;
          run.vy = 0;
          run.airborne = false;
        }
      } else {
        run.y = HOVER_Y;
      }

      const seq = findSeq(lab.seq);
      for (let i = 0; i < seq.events.length; i++) {
        if (!lab.running) break; // a shatter mid-frame ends the run here
        const evid = seq.events[i];
        if (run.fired.has(evid)) continue;
        const ev = BY_ID.get(evid);
        if (ev && ev.dist <= run.dist) fireEvent(evid);
      }

      // storm wobble while the sequence's gust section is under the bike
      const hasGust = seq.events.some((id) => BY_ID.get(id)?.kind === 'gust');
      const wobbleTarget = hasGust && lab.running && run.dist > 288 && run.dist < 352 ? 1 : 0;
      run.wobble += (wobbleTarget - run.wobble) * Math.min(1, dt * 3);

      if (run.dist >= RUN_M && lab.running) finishRun(false);
    } else {
      // auto-loop after a beat so the bench is always alive
      idleT.current += dt;
      if (lab.loop && !lab.reducedMotion && run.lastFinal && idleT.current > 1.9) {
        startRun();
        synth.tick(760, 0.04);
      }
    }

    // envelopes decay
    run.fade += ((lab.running || (run.lastFinal && idleT.current < 0.6) ? 1 : 0.0) - run.fade) * Math.min(1, dt * 1.8);
    run.hitFlash = Math.max(0, run.hitFlash - dt * 2.4);
    run.soakFlash = Math.max(0, run.soakFlash - dt * 2.8);
    run.shake *= Math.exp(-3.2 * dt);
    run.lean *= Math.exp(-2.6 * dt);
    run.wobble *= lab.running ? 1 : Math.exp(-2 * dt);
    run.bounceT += dt;

    synth.update(lab.running, run.airborne);

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
    _target.set(2.2, 3.1, 9.2);
    if (!init.current) {
      cam.position.copy(_target);
      init.current = true;
    } else {
      cam.position.lerp(_target, 1 - Math.exp(-4.2 * dt));
    }
    const amp = lab.reducedMotion ? 0 : run.shake;
    if (amp > 0.001) {
      const t = run.t;
      cam.position.x += (Math.sin(t * 37.1) + Math.sin(t * 53.7) * 0.6) * 0.05 * amp;
      cam.position.y += (Math.sin(t * 41.4 + 1.7) + Math.sin(t * 29.7) * 0.7) * 0.04 * amp;
    }
    _look.set(1.2, 1.35, -9);
    _lookVel.lerp(_look, 1 - Math.exp(-6 * dt));
    cam.lookAt(_lookVel);
    const fov = 60 + run.shake * 3 + (lab.running ? 1.5 : 0);
    if (Math.abs(cam.fov - fov) > 0.03) {
      cam.fov += (fov - cam.fov) * Math.min(1, 5 * dt);
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
      <fog attach="fog" args={['#E4D3AE', 190, 1200]} />

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
      <mesh position={[130, 70, -1250]}>
        <circleGeometry args={[64, 24]} />
        <meshBasicMaterial color="#FFD9A0" fog={false} />
      </mesh>

      <Ground />
      <Posts />
      <Mesas />
      <DecoRocks />
      <Obstacles />
      <EventMarkers />
      <GhostBike x={MAIN_X} />
      <GhostBike x={GHOST_X} ghost />
      <ImpactRings />
      <GaugePylon x={-7.2} z={-3.2} />
      <GaugePylon x={-7.2} z={-8.6} ghost />
      <Dust />
      <Driver />
      <Rig />
    </>
  );
}

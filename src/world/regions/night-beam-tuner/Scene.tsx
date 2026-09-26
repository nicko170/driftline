/**
 * Night Beam Tuner — the 3D rig. A salt-pan corridor walled by glass canyon,
 * the player-spec bike parked mid-frame with its headlight aimed down the
 * road, range gates every 5 m and a teal-framed 20–30 m "read band". Sky,
 * fog, sun and stars follow the game's own palette keyframes; the Headlight
 * geometry mirrors src/game/Bike.tsx 1:1 (positions, cone length, ramp) but
 * every constant rides the tunable `beam` state. No per-frame allocations.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { fbm2, ridge2, mulberry32, smooth01 } from '../../../lib/noise';
import { beam, beamOn, nightFactor, HOVER_Y, type ViewPreset } from './beam';

/* ---------- palette keyframes — mirrors src/game/Sky.tsx ---------- */
const KEYS: [number, string, string, string, string, number, number][] = [
  [0.0, '#14101F', '#2A2140', '#241C33', '#8899DD', 0.25, 0.5],
  [0.22, '#1B1730', '#4A2E55', '#332847', '#C9A2FF', 0.3, 0.55],
  [0.28, '#7E5A8C', '#E8915A', '#D9A08A', '#FFB454', 1.1, 0.7],
  [0.36, '#87B8C4', '#E8D5AE', '#DCC7A0', '#FFF2D8', 1.6, 0.85],
  [0.5, '#7FB4BE', '#E4D7BE', '#D9C6A2', '#FFEDC4', 1.7, 0.9],
  [0.66, '#8FAEC0', '#E0C090', '#CFB490', '#FFE8C0', 1.4, 0.8],
  [0.78, '#6E4E78', '#E07B4A', '#C98A6E', '#FF9E5A', 1.1, 0.7],
  [0.86, '#2A2140', '#6E3E5C', '#4A3552', '#D07B5A', 0.5, 0.55],
];

const _skyTop = new THREE.Color();
const _horizon = new THREE.Color();
const _fog = new THREE.Color();
const _sun = new THREE.Color();
const _c = new THREE.Color();
const _white = new THREE.Color('#FFFFFF');
const _ground = new THREE.Color();
let sunI = 0.5;
let ambI = 0.7;

function sampleSky(t: number): void {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1] ?? KEYS[0];
  let span = b[0] - a[0];
  if (span <= 0) span += 1;
  let local = t - a[0];
  if (local < 0) local += 1;
  const f = Math.min(1, local / span);
  _skyTop.set(a[1]).lerp(_c.set(b[1]), f);
  _horizon.set(a[2]).lerp(_c.set(b[2]), f);
  _fog.set(a[3]).lerp(_c.set(b[3]), f);
  _sun.set(a[4]).lerp(_c.set(b[4]), f);
  sunI = a[5] + (b[5] - a[5]) * f;
  ambI = a[6] + (b[6] - a[6]) * f;
}

/* ---------- terrain physics-free height fn (shared by scatter placement) ---------- */
function panHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  const wall = smooth01((ax - 42) / 62);
  const wallH = Math.pow(wall, 1.35) * (10 + Math.max(0, ridge2(x * 0.012, z * 0.009, 3)) * 15 + fbm2(x * 0.05, z * 0.05, 2) * 3);
  // far end opens into soft dunes; behind the bike a gentle rise
  const farOpen = smooth01((z - 360) / 170);
  const backRise = smooth01((-z - 40) / 120) * 3;
  const ripple = fbm2(x * 0.045, z * 0.045, 2) * 0.28 * (1 - wall * 0.9);
  const dunes = farOpen * (4 + Math.max(0, ridge2(x * 0.004, z * 0.004, 3)) * 8) * (1 - wall * 0.4);
  return wallH * (1 - farOpen * 0.55) + dunes + backRise + ripple;
}

function buildTerrain(): THREE.BufferGeometry {
  const SX = 560;
  const SZ = 760;
  const geo = new THREE.PlaneGeometry(SX, SZ, 130, 160);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 160);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const salt = new THREE.Color('#F3EEE2');
  const stone = new THREE.Color('#7A6248');
  const glass = new THREE.Color('#2E8C8C');
  const glassTop = new THREE.Color('#57C4B8');
  const sand = new THREE.Color('#D9A45B');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = panHeight(x, z);
    pos.setY(i, h);
    const ax = Math.abs(x);
    const wall = smooth01((ax - 42) / 62);
    const crest = smooth01((h - 14) / 12);
    const farOpen = smooth01((z - 360) / 170);
    c.copy(salt).lerp(stone, wall * 0.85);
    c.lerp(glass, smooth01((h - 4) / 10) * wall);
    c.lerp(glassTop, crest * wall * 0.55);
    c.lerp(sand, farOpen * (1 - wall * 0.6) * 0.8);
    const n = fbm2(x * 0.06, z * 0.06, 2) * 0.05;
    colors[i * 3] = c.r + n;
    colors[i * 3 + 1] = c.g + n;
    colors[i * 3 + 2] = c.b + n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}

/* ---------- dome shader ---------- */
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
  uniform vec3 uGround;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 sky = mix(uHorizon, uTop, pow(smoothstep(-0.04, 0.55, h), 0.72));
    vec3 below = mix(uHorizon, uGround, smoothstep(0.0, -0.32, h));
    gl_FragColor = vec4(h >= 0.0 ? sky : below, 1.0);
  }
`;

/* ---------- sky / light rig ---------- */
function SkyRig() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const starsMat = useRef<THREE.PointsMaterial>(null);
  const dustMat = useRef<THREE.PointsMaterial>(null);
  const dustGroup = useRef<THREE.Points>(null);
  const { scene } = useThree();

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#14101F') },
      uHorizon: { value: new THREE.Color('#2A2140') },
      uGround: { value: new THREE.Color('#241C33') },
    }),
    [],
  );

  const starsGeo = useMemo(() => {
    const rand = mulberry32(7171);
    const COUNT = 1500;
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const az = rand() * Math.PI * 2;
      const y = Math.pow(rand(), 0.6);
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      arr[i * 3] = Math.cos(az) * rr * 1500;
      arr[i * 3 + 1] = y * 1200 + 6;
      arr[i * 3 + 2] = Math.sin(az) * rr * 1500;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  const dustGeo = useMemo(() => {
    const rand = mulberry32(313);
    const COUNT = 260;
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (rand() - 0.5) * 160;
      arr[i * 3 + 1] = 0.4 + rand() * 14;
      arr[i * 3 + 2] = -20 + rand() * 260;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useEffect(() => {
    if (!scene.fog) scene.fog = new THREE.FogExp2('#241C33', 0.002);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((_, dt) => {
    if (beam.playing) beam.t = (beam.t + (dt * beam.cyclesPerMin) / 60) % 1;
    sampleSky(beam.t);
    const night = nightFactor(beam.t);

    uniforms.uTop.value.copy(_skyTop);
    uniforms.uHorizon.value.copy(_horizon);
    uniforms.uGround.value.copy(_fog).multiplyScalar(0.55);

    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(_fog);
      fog.density = (0.0013 + night * 0.0009) * beam.fogGain; // the game's formula
    }

    const elev = Math.sin((beam.t - 0.25) * Math.PI * 2) * 0.9 + 0.25;
    const azim = (beam.t - 0.25) * Math.PI * 2;
    if (sun.current) {
      sun.current.position.set(
        Math.cos(azim) * 300,
        60 + Math.max(0.05, elev) * 240,
        120 + Math.sin(azim) * 160,
      );
      sun.current.intensity = sunI * Math.max(0.12, Math.min(1, elev + 0.4));
      sun.current.color.copy(_sun);
    }
    if (hemi.current) {
      hemi.current.intensity = 0.22 + ambI * 0.34;
      hemi.current.color.copy(_skyTop).lerp(_white, 0.4);
      hemi.current.groundColor.copy(_ground.set('#B07C3A').lerp(_fog, 0.4));
    }
    if (starsMat.current) starsMat.current.opacity = Math.min(1, Math.max(0, (night - 0.12) / 0.7)) * 0.9;
    if (dustMat.current) dustMat.current.opacity = 0.14 + (1 - night) * 0.1;
    if (dustGroup.current) dustGroup.current.rotation.y += dt * 0.008;
  });

  return (
    <group>
      <mesh renderOrder={-100} frustumCulled={false}>
        <sphereGeometry args={[1700, 32, 18]} />
        <shaderMaterial vertexShader={DOME_VERT} fragmentShader={DOME_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <points geometry={starsGeo} renderOrder={-50} frustumCulled={false}>
        <pointsMaterial ref={starsMat} size={2.2} sizeAttenuation={false} color="#EDE6FF" transparent opacity={0} depthWrite={false} fog={false} />
      </points>
      <points ref={dustGroup} geometry={dustGeo}>
        <pointsMaterial ref={dustMat} size={0.85} sizeAttenuation color="#E4D7BE" transparent opacity={0.18} depthWrite={false} />
      </points>
      <hemisphereLight ref={hemi} intensity={0.5} />
      <directionalLight
        ref={sun}
        castShadow
        position={[0, 280, 200]}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={10}
        shadow-camera-far={760}
        shadow-bias={-0.0006}
      />
    </group>
  );
}

/* ---------- bike + parameterized headlight (geometry mirrors Bike.tsx) ---------- */
const RUST = '#B3502E';
const BONE = '#E4D7BE';
const TEAL = '#57C4B8';
const AMBER = '#FFB454';
const CONE_LEN = 7.1;
const CONE_R0 = 1.8; // game cone radius at angle 0.45

function BikeRig() {
  const spot = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const coneMat = useRef<THREE.MeshBasicMaterial>(null);
  const coneMesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);

  // deterministic target wiring: sibling object in the same group, so its
  // world transform = group (bike at hover) × local [0, aimDrop, aimAhead]
  useEffect(() => {
    if (spot.current && target.current) spot.current.target = target.current;
  }, []);

  useFrame(({ clock }) => {
    const on = beamOn(beam.t);
    if (spot.current) {
      spot.current.intensity = on * beam.intensity;
      spot.current.angle = beam.angle;
      spot.current.penumbra = beam.penumbra;
      spot.current.distance = beam.distance;
      spot.current.decay = beam.decay;
    }
    if (target.current) {
      target.current.position.set(0, beam.aimDrop, beam.aimAhead);
      target.current.updateMatrixWorld();
    }
    if (lamp.current) lamp.current.emissiveIntensity = 0.6 + on * beam.lampEmissive;
    if (coneMat.current) coneMat.current.opacity = on * beam.coneOpacity;
    if (coneMesh.current) {
      const s = Math.min(3.2, Math.max(0.35, Math.tan(beam.angle) / Math.tan(0.45)));
      coneMesh.current.scale.set(s, 1, s);
    }
    if (glow.current) glow.current.emissiveIntensity = 1.1 + Math.sin(clock.elapsedTime * 9) * 0.25;
  });

  return (
    <group position={[0, HOVER_Y, 0]}>
      {/* headlight — identical mount points to src/game/Bike.tsx */}
      <spotLight
        ref={spot}
        position={[0, 0.65, 1.7]}
        color="#FFE0AE"
        intensity={0}
      />
      <object3D ref={target} position={[0, -1.1, 15]} />
      <mesh position={[0, 0.26, 2.02]}>
        <planeGeometry args={[0.36, 0.13]} />
        <meshStandardMaterial ref={lamp} color="#FFE9C4" emissive="#FFE9C4" emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* beam cone — apex at the lens, additive dust sheen, radius follows angle */}
      <mesh ref={coneMesh} position={[0, 0.2, 1.9 + CONE_LEN / 2]} rotation={[-Math.PI / 2 + 0.05, 0, 0]}>
        <coneGeometry args={[CONE_R0, CONE_LEN, 12, 1, true]} />
        <meshBasicMaterial
          ref={coneMat}
          color="#FFD9A0"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* hull */}
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.85, 0.42, 2.6]} />
        <meshStandardMaterial color={RUST} flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.02, 1.55]} rotation={[0.24, 0, 0]}>
        <boxGeometry args={[0.6, 0.3, 0.9]} />
        <meshStandardMaterial color={BONE} flatShading />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`f${s}`} castShadow position={[s * 0.62, 0.0, 1.0]} rotation={[0, s * 0.34, 0]}>
          <boxGeometry args={[0.7, 0.1, 1.1]} />
          <meshStandardMaterial color={BONE} flatShading />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} castShadow position={[s * 0.58, -0.02, -0.9]}>
          <boxGeometry args={[0.34, 0.3, 1.1]} />
          <meshStandardMaterial color="#5C4632" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.02, -1.55]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.24]} />
        <meshStandardMaterial ref={glow} color={AMBER} emissive={AMBER} emissiveIntensity={1.2} side={THREE.DoubleSide} />
      </mesh>
      {/* under-glow — pools on the salt like the real bike */}
      <mesh position={[0, -0.34, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 2.2]} />
        <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={0.5} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* parked kickstand shadow block (static rig, no hover bob) */}
      <mesh position={[0, -HOVER_Y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.35, 20]} />
        <meshBasicMaterial color="#14101F" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------- range gates + read-band frames ---------- */
const GATE_Z: number[] = [];
for (let z = 5; z <= 45; z += 5) GATE_Z.push(z);

function RangeGates() {
  const gatePy = (z: number) => panHeight(2.8, z);
  return (
    <group>
      {GATE_Z.map((z) => {
        const isBand = z >= 20 && z <= 30;
        return [-1, 1].map((s) => {
          const y = panHeight(s * 2.8, z);
          return (
            <group key={`g${z}${s}`} position={[s * 2.8, y, z]}>
              <mesh position={[0, 0.6, 0]}>
                <cylinderGeometry args={[0.07, 0.12, 1.2, 5]} />
                <meshStandardMaterial color="#8D7A5C" flatShading />
              </mesh>
              <mesh position={[0, 1.24, 0]}>
                <boxGeometry args={[0.3, 0.09, 0.3]} />
                <meshStandardMaterial
                  color={BONE}
                  emissive={isBand ? TEAL : AMBER}
                  emissiveIntensity={isBand ? 1.3 : 0.8}
                  flatShading
                />
              </mesh>
            </group>
          );
        }).map((m, i) => <group key={i}>{m}</group>);
      })}
      {/* teal ground frames bracketing the 20–30 m read band */}
      {[20, 30].map((z) => (
        <mesh key={`bf${z}`} position={[0, gatePy(z) + 0.05, z]}>
          <boxGeometry args={[15, 0.05, 0.2]} />
          <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- glass veins + rock scatter (instanced) ---------- */
function Scatter() {
  const rocks = useMemo(() => {
    const rand = mulberry32(5150);
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const count = 170;
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#8D7A5C', flatShading: true }), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      let x = (rand() - 0.5) * 500;
      const z = -40 + rand() * 540;
      if (Math.abs(x) < 18 && z < 70 && z > -14) x = Math.sign(x || 1) * (18 + rand() * 40);
      const s = 0.4 + rand() * rand() * 2.4;
      p.set(x, panHeight(x, z) + s * 0.25, z);
      e.set(rand() * 0.5, rand() * Math.PI * 2, rand() * 0.5);
      q.setFromEuler(e);
      sc.setScalar(s);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, []);

  const veins = useMemo(() => {
    const rand = mulberry32(9191);
    const geo = new THREE.BoxGeometry(0.3, 0.3, 1);
    const count = 52;
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.9, flatShading: true }),
      count,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (52 + rand() * 120);
      const z = -50 + rand() * 520;
      const len = 4 + rand() * 12;
      p.set(x, panHeight(x, z) + 0.4, z);
      e.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
      q.setFromEuler(e);
      sc.set(1, 1, len);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, []);

  useEffect(() => () => {
    rocks.geometry.dispose();
    (rocks.material as THREE.Material).dispose();
    veins.geometry.dispose();
    (veins.material as THREE.Material).dispose();
  }, [rocks, veins]);

  return (
    <group>
      <primitive object={rocks} />
      <primitive object={veins} />
    </group>
  );
}

/* ---------- camera presets ---------- */
const VIEWS: Record<ViewPreset, { pos: [number, number, number]; look: [number, number, number] }> = {
  chase: { pos: [4.6, 3.0, -7.2], look: [0, 1.0, 18] },
  profile: { pos: [25, 3.4, 9], look: [0, 0.7, 17] },
  footprint: { pos: [0.5, 40, 11], look: [0, 0, 14] },
};

const _look = new THREE.Vector3();
const _target = new THREE.Vector3();

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    const v = VIEWS[beam.view];
    camera.position.set(...v.pos);
    _look.set(...v.look);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const v = VIEWS[beam.view];
    const k = 1 - Math.exp(-3.2 * dt);
    _target.set(...v.pos);
    camera.position.lerp(_target, k);
    _target.set(...v.look);
    _look.lerp(_target, k);
    camera.lookAt(_look);
  });
  return null;
}

/* ---------- root scene ---------- */
export function BeamScene() {
  const terrain = useMemo(buildTerrain, []);
  useEffect(() => () => terrain.dispose(), [terrain]);
  return (
    <>
      <SkyRig />
      <CameraRig />
      <mesh geometry={terrain} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
      </mesh>
      <BikeRig />
      <RangeGates />
      <Scatter />
    </>
  );
}

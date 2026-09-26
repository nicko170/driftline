/**
 * Storm Front Sandbox — the world: a dusk-violet sky over an ochre test pan,
 * the shelter arch (the goal), a storm-gauge mast at spawn, rim dunes.
 * FogExp2 is modulated by wall proximity (the "shader-lite" path), palette
 * lurching violet → ochre as the wall closes on you.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { fbm2, ridge2, smooth01, lerp, clamp01, mulberry32 } from '../../../lib/noise';
import { bike, lab, panHeight, PAN_R, shelter, storm } from './state';

/* ================= fog + sky atmos ================= */

const FOG_CLEAR = new THREE.Color('#3A2A55');
const FOG_NEAR = new THREE.Color('#C98F4E');

function FogDriver() {
  const fog = useMemo(() => new THREE.FogExp2('#3A2A55', 0.0016), []);
  useFrame(() => {
    const i = storm.intensity;
    const flicker = lab.turbulence * storm.intensity * Math.sin(performance.now() * 0.021) * 0.0006;
    fog.density = (lab.fogBase + i * i * 0.0095 * lab.density) * (1 + flicker);
    fog.color.copy(FOG_CLEAR).lerp(FOG_NEAR, clamp01(i * 1.15));
  });
  return <primitive object={fog} attach="fog" />;
}

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
  uniform vec3 uStormGlow;
  uniform vec3 uStormDir;
  uniform float uGlow;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    vec3 sky = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.55, d.y), 0.8));
    // ochre smudge where the wall stands on the horizon
    float toward = smoothstep(0.2, 0.95, dot(normalize(vec2(d.x, d.z)), normalize(vec2(uStormDir.x, uStormDir.z))));
    float low = smoothstep(0.3, -0.05, d.y);
    sky = mix(sky, uStormGlow, toward * low * uGlow);
    gl_FragColor = vec4(sky, 1.0);
  }
`;

function SkyDome() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#14101F') },
      uHorizon: { value: new THREE.Color('#8A5A55') },
      uStormGlow: { value: new THREE.Color('#C98F4E') },
      uStormDir: { value: new THREE.Vector3(0, 0, -1) },
      uGlow: { value: 0 },
    }),
    [],
  );
  useFrame(() => {
    const dx = storm.x - bike.x;
    const dz = storm.z - bike.z;
    const len = Math.hypot(dx, dz) || 1;
    uniforms.uStormDir.value.set(dx / len, 0, dz / len);
    uniforms.uGlow.value = storm.active ? 0.18 + storm.intensity * 0.5 : storm.intensity * 0.3;
  });
  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[1500, 32, 16]} />
      <shaderMaterial vertexShader={DOME_VERT} fragmentShader={DOME_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

function Stars() {
  const geo = useMemo(() => {
    const rand = mulberry32(99);
    const N = 160;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const y = 0.25 + rand() * 0.7;
      const r = Math.sqrt(1 - y * y);
      arr[i * 3] = Math.cos(a) * r * 1400;
      arr[i * 3 + 1] = y * 1400;
      arr[i * 3 + 2] = Math.sin(a) * r * 1400;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial size={1.7} sizeAttenuation={false} color="#E4D7BE" transparent opacity={0.45} depthWrite={false} fog={false} />
    </points>
  );
}

/* ================= pan ================= */

function buildPan() {
  const SIZE = 1700;
  const SEG = 110;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const panC = new THREE.Color('#C98F4E');
  const panD = new THREE.Color('#A9713D');
  const duneC = new THREE.Color('#B07C3A');
  const duneD = new THREE.Color('#7E3320');
  const padC = new THREE.Color('#D9C49A');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = panHeight(x, z);
    pos.setY(i, h);
    const r = Math.hypot(x, z);
    const n = fbm2(x * 0.035, z * 0.035, 2) * 0.5 + 0.5;
    // pale salt drifts streaked across the pan
    const streak = smooth01(ridge2(x * 0.012 + 9.1, z * 0.012 - 3.3, 2)) * smooth01((620 - r) / 120);
    c.copy(panD).lerp(panC, 0.35 + n * 0.6);
    c.lerp(padC, streak * 0.5);
    // rim dunes darken to rust
    const rim = smooth01((r - PAN_R) / 150);
    c.lerp(duneC, rim * 0.7).lerp(duneD, rim * smooth01((h - 3) / 8) * 0.6);
    // shelter pad stays pale and readable
    const dsh = Math.hypot(x - shelter.x, z - shelter.z);
    c.lerp(padC, smooth01((70 - dsh) / 40) * 0.55);
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

/* ================= scatter: rim rocks + deadbrush ================= */

function Scatter() {
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const brush = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const rand = mulberry32(4242);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const place = (mesh: THREE.InstancedMesh, count: number, rimOnly: boolean) => {
      for (let i = 0; i < count; i++) {
        let x = 0, z = 0, tries = 0;
        do {
          const a = rand() * Math.PI * 2;
          const rr = rimOnly ? PAN_R + 30 + rand() * 160 : 120 + rand() * 460;
          x = Math.cos(a) * rr * (1 + rand() * 0.3);
          z = Math.sin(a) * rr;
          tries++;
          // keep the riding lane shelter↔spawn clear
        } while (tries < 16 && Math.abs(x) < 46 && z > -140);
        const s = rimOnly ? 1.4 + rand() * 3.2 : 0.5 + rand() * 1.3;
        e.set(rand() * 0.2, rand() * Math.PI * 2, rand() * 0.2);
        q.setFromEuler(e);
        v.set(x, panHeight(x, z) + s * (rimOnly ? 0.3 : 0.1), z);
        sc.set(s, s * (rimOnly ? 0.75 : 0.4), s);
        m.compose(v, q, sc);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(rocks.current, 110, true);
    place(brush.current, 60, false);
  }, []);

  return (
    <group>
      <instancedMesh ref={rocks} args={[undefined, undefined, 110]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8A5335" flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={brush} args={[undefined, undefined, 60]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#5C3A28" flatShading roughness={1} />
      </instancedMesh>
    </group>
  );
}

/* ================= shelter arch (the goal) ================= */

function ShelterArch() {
  const ring = useRef<THREE.Mesh>(null);
  const lampA = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.z += dt * 0.25;
      (ring.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(t * 2.4) * 0.35;
    }
    if (lampA.current) lampA.current.emissiveIntensity = 1.5 + Math.sin(t * 3.1) * 0.5;
  });
  const y = panHeight(shelter.x, shelter.z);
  return (
    <group position={[shelter.x, y, shelter.z]}>
      {/* half-buried dome you dive into */}
      <mesh position={[0, 0.5, 8]} castShadow scale={[1.15, 0.62, 1]}>
        <sphereGeometry args={[14, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#E4D7BE" flatShading roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.5, -6.5]} castShadow>
        <boxGeometry args={[16, 5, 1.2]} />
        <meshStandardMaterial color="#B3502E" flatShading roughness={0.9} />
      </mesh>
      {/* teal guide ring on the ground — the capture radius */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[shelter.r - 1.6, shelter.r, 48]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.2} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* lanterns */}
      {[[-12, -4], [12, -4]].map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh position={[0, 2.4, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.26, 4.8, 6]} />
            <meshStandardMaterial color="#7E3320" flatShading />
          </mesh>
          <mesh position={[0, 5.2, 0]}>
            <octahedronGeometry args={[0.7, 0]} />
            <meshStandardMaterial ref={x < 0 ? lampA : undefined} color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.5} flatShading />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, 6, 0]} color="#57C4B8" intensity={26} distance={70} decay={1.8} />
    </group>
  );
}

/* ================= storm-gauge mast at spawn ================= */

function GaugeMast() {
  const cups = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (cups.current) cups.current.rotation.y += dt * (1.2 + storm.intensity * 9);
  });
  const y = panHeight(14, -64);
  return (
    <group position={[14, y, -64]}>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.3, 8, 6]} />
        <meshStandardMaterial color="#B3502E" flatShading roughness={0.85} />
      </mesh>
      <group ref={cups} position={[0, 8.3, 0]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55]}>
              <sphereGeometry args={[0.22, 6, 4, 0, Math.PI]} />
              <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={0.5} flatShading />
            </mesh>
          );
        })}
      </group>
      <mesh position={[0.9, 7.2, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.3, 1.6, 5]} />
        <meshStandardMaterial color="#D9A45B" emissive="#D9A45B" emissiveIntensity={0.25} flatShading />
      </mesh>
    </group>
  );
}

/* ================= camera rig: chase or wide ================= */

const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _look = new THREE.Vector3();

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const fov = useRef(60);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (lab.camMode === 'chase') {
      if (controls.current) controls.current.enabled = false;
      const speedN = clamp01(Math.abs(bike.speed) / Math.max(lab.bikeTop, 1));
      const back = 13 + speedN * 5;
      _camPos.set(
        bike.x - Math.sin(bike.heading) * back,
        bike.y + 4.6 + speedN * 1.4,
        bike.z - Math.cos(bike.heading) * back,
      );
      camera.position.lerp(_camPos, 1 - Math.exp(-dt * 5.5));
      _look.set(bike.x + Math.sin(bike.heading) * 9, bike.y + 1.6, bike.z + Math.cos(bike.heading) * 9);
      camera.lookAt(_look);
      const target = 58 + speedN * 12 + (bike.boostHeld && bike.speed > 10 ? 4 : 0);
      fov.current = lerp(fov.current, target, 1 - Math.exp(-dt * 4));
      if (Math.abs(camera.fov - fov.current) > 0.05) {
        camera.fov = fov.current;
        camera.updateProjectionMatrix();
      }
    } else if (controls.current) {
      controls.current.enabled = true;
      // follow the bike gently in wide mode too
      _camTarget.set(bike.x * 0.35, 30, bike.z * 0.35 + 120);
      controls.current.target.lerp(_camTarget, 1 - Math.exp(-dt * 1.5));
      controls.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={lab.camMode === 'wide'}
      enableDamping
      dampingFactor={0.08}
      autoRotate={false}
      minDistance={60}
      maxDistance={900}
      maxPolarAngle={Math.PI * 0.49}
    />
  );
}

/* ================= root ================= */

export function SandboxScene() {
  const pan = useMemo(buildPan, []);
  return (
    <>
      <SkyDome />
      <Stars />
      <FogDriver />
      <hemisphereLight intensity={0.6} color="#4A3C6E" groundColor="#8A5335" />
      {/* low dusk sun — long violet shadows */}
      <directionalLight
        castShadow
        position={[-320, 150, -180]}
        intensity={1.8}
        color="#FFB454"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
        shadow-camera-near={40}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
      />
      <mesh geometry={pan} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
      </mesh>
      <Scatter />
      <ShelterArch />
      <GaugeMast />
      <CameraRig />
    </>
  );
}

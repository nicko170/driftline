/**
 * The tuner's R3F scene: a gradient sky dome, sun disc + light rig, faceted dune
 * vista with a flat salt pan, sparse landmark silhouettes, stars and dust motes.
 * Everything animates from the module-level `tuner` state — no per-frame allocations.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { fbm2, ridge2, mulberry32, smooth01 } from '../../../lib/noise';
import { tuner, sampleInto, sunAngles, type Sample } from './palette';

/* ---------- module scratch (no hot-path allocations) ---------- */
const S: Sample = {
  skyTop: [0, 0, 0], horizon: [0, 0, 0], fog: [0, 0, 0], sun: [0, 0, 0],
  sunI: 0, ambI: 0, night: 0, phase: '', f: 0,
};

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

/* ---------- dune vista ---------- */
function buildDunes() {
  const N = 120; // grid segments
  const SIZE = 920;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color('#D9A45B');
  const salt = new THREE.Color('#F3EEE2');
  const ochre = new THREE.Color('#B07C3A');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    // flat salt pan at centre, dunes rising outward
    const mask = smooth01((r - 34) / 90);
    let h = ridge2(x * 0.0042, z * 0.0042, 3) * 15 + fbm2(x * 0.012, z * 0.012, 3) * 5;
    h = Math.max(h, 0) * mask + fbm2(x * 0.03, z * 0.03, 2) * 0.4;
    pos.setY(i, h);
    // vertex colour: salt flats → sand → ochre crests
    const saltiness = smooth01((0.9 - h) * 0.5) * smooth01(mask * 2.2);
    const crest = smooth01((h - 9) / 14);
    c.copy(sand).lerp(salt, saltiness * 0.9).lerp(ochre, crest * 0.45);
    const n = fbm2(x * 0.05, z * 0.05, 2) * 0.06;
    colors[i * 3] = c.r + n;
    colors[i * 3 + 1] = c.g + n;
    colors[i * 3 + 2] = c.b + n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals(); // face normals → faceted low-poly look
  return flat;
}

function Landmarks() {
  const stone = '#CBB896';
  const stoneDark = '#8D7A5C';
  const saltTeal = '#57C4B8';
  const rust = '#B3502E';
  return (
    <group>
      {/* mesa silhouettes */}
      <mesh position={[-230, 12, -260]} castShadow>
        <cylinderGeometry args={[30, 52, 42, 7, 1]} />
        <meshStandardMaterial color={stoneDark} flatShading />
      </mesh>
      <mesh position={[-230, 35, -260]} castShadow>
        <cylinderGeometry args={[26, 30, 6, 7, 1]} />
        <meshStandardMaterial color={stone} flatShading />
      </mesh>
      <mesh position={[300, 16, -320]} rotation={[0, 0.6, 0]}>
        <cylinderGeometry args={[42, 74, 58, 6, 1]} />
        <meshStandardMaterial color={stoneDark} flatShading />
      </mesh>
      {/* salt spires on the pan */}
      {[[24, -18, 9], [-16, 22, 12], [42, 30, 7], [-44, -30, 15], [8, 52, 6], [-58, 12, 10]].map(([x, z, h], i) => (
        <mesh key={i} position={[x, h / 2 - 1, z]} rotation={[0, i * 1.3, 0]} castShadow>
          <coneGeometry args={[h * 0.24, h, 5]} />
          <meshStandardMaterial color="#EDE4D2" emissive={saltTeal} emissiveIntensity={0.06} flatShading />
        </mesh>
      ))}
      {/* dead wind turbine — scale cue */}
      <group position={[-90, 0, 70]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 13, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.9, 26, 5]} />
          <meshStandardMaterial color={rust} flatShading />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0, 24.4, 1.1]} rotation={[0, 0, (k * Math.PI * 2) / 3 + 0.4]}>
            <boxGeometry args={[0.6, 7.4, 0.24]} />
            <meshStandardMaterial color="#E4D7BE" flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------- stars (hand-rolled so opacity is fully controllable) ---------- */
function StarsField({ matRef }: { matRef: React.RefObject<THREE.PointsMaterial | null> }) {
  const geo = useMemo(() => {
    const rand = mulberry32(4242);
    const COUNT = 1300;
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const az = rand() * Math.PI * 2;
      const y = Math.pow(rand(), 0.6);
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      arr[i * 3] = Math.cos(az) * rr * 1400;
      arr[i * 3 + 1] = y * 1400 + 4;
      arr[i * 3 + 2] = Math.sin(az) * rr * 1400;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  return (
    <points geometry={geo} renderOrder={-50} frustumCulled={false}>
      <pointsMaterial ref={matRef} size={2.4} sizeAttenuation={false} color="#EDE6FF" transparent opacity={0} depthWrite={false} fog={false} />
    </points>
  );
}

/* ---------- dust motes drifting over the pan ---------- */
function DustMotes({ matRef, pointsRef }: { matRef: React.RefObject<THREE.PointsMaterial | null>; pointsRef: React.RefObject<THREE.Points | null> }) {
  const geo = useMemo(() => {
    const rand = mulberry32(909);
    const COUNT = 240;
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const az = rand() * Math.PI * 2;
      const r = 20 + rand() * 140;
      arr[i * 3] = Math.cos(az) * r;
      arr[i * 3 + 1] = 1 + rand() * 24;
      arr[i * 3 + 2] = Math.sin(az) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial ref={matRef} size={0.9} sizeAttenuation color="#E4D7BE" transparent opacity={0.2} depthWrite={false} />
    </points>
  );
}

/* ---------- the live rig ---------- */
function SkyRig() {
  const domeMat = useRef<THREE.ShaderMaterial>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null);
  const sunHalo = useRef<THREE.Mesh>(null);
  const starsMat = useRef<THREE.PointsMaterial>(null);
  const dustMat = useRef<THREE.PointsMaterial>(null);
  const dustGroup = useRef<THREE.Points>(null);
  const { scene, camera } = useThree();

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#14101F') },
      uHorizon: { value: new THREE.Color('#2A2140') },
      uGround: { value: new THREE.Color('#241C33') },
    }),
    [],
  );

  useEffect(() => {
    if (!scene.fog) scene.fog = new THREE.FogExp2('#D9C6A2', 0.0016);
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, dt) => {
    if (tuner.playing) tuner.t = (tuner.t + (dt * tuner.speed) / 60) % 1;
    const s = sampleInto(tuner.t, S);
    const { elev, azim } = sunAngles(tuner.t);

    // dome
    uniforms.uTop.value.setRGB(s.skyTop[0], s.skyTop[1], s.skyTop[2]);
    uniforms.uHorizon.value.setRGB(s.horizon[0], s.horizon[1], s.horizon[2]);
    uniforms.uGround.value.setRGB(s.fog[0] * 0.55, s.fog[1] * 0.55, s.fog[2] * 0.55);

    // fog
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.setRGB(s.fog[0], s.fog[1], s.fog[2]);
      fog.density = (tuner.fogDensity / 1e4) * (0.7 + s.night * 0.55);
    }

    // sun light + disc
    const dist = 300;
    const sx = Math.cos(azim) * dist;
    const sy = 70 + Math.max(0.02, elev) * 260;
    const sz = Math.sin(azim) * dist * 0.6;
    const dayLight = Math.max(0.12, Math.min(1, elev + 0.42));
    if (sun.current) {
      sun.current.position.set(sx, sy, sz);
      sun.current.intensity = s.sunI * dayLight * tuner.sunGain;
      sun.current.color.setRGB(s.sun[0], s.sun[1], s.sun[2]);
    }
    const discVis = Math.max(0, Math.min(1, elev * 2.4 + 0.5));
    for (const m of [sunDisc.current, sunHalo.current]) {
      if (!m) continue;
      m.visible = discVis > 0.02;
      (m.material as THREE.MeshBasicMaterial).opacity =
        (m === sunDisc.current ? 0.95 : 0.22) * discVis;
      m.position.set((sx / dist) * 1250, (sy - 70) / 260 * 1250 * 0.6 + 240, (sz / dist) * 1250);
      m.lookAt(camera.position);
    }
    (sunDisc.current?.material as THREE.MeshBasicMaterial | undefined)?.color.setRGB(
      Math.min(1, s.sun[0] * 1.4), Math.min(1, s.sun[1] * 1.4), Math.min(1, s.sun[2] * 1.4),
    );

    // hemisphere fill
    if (hemi.current) {
      hemi.current.intensity = (0.2 + s.ambI * 0.36) * (0.35 + tuner.sunGain * 0.65);
      hemi.current.color.setRGB(s.skyTop[0], s.skyTop[1], s.skyTop[2]).lerp(_WHITE, 0.4);
      hemi.current.groundColor.set('#B07C3A').lerp(_FOG.setRGB(s.fog[0], s.fog[1], s.fog[2]), 0.4);
    }

    // stars + dust
    if (starsMat.current) starsMat.current.opacity = Math.min(1, Math.max(0, (s.night - 0.12) / 0.7)) * tuner.starGain;
    if (dustMat.current) dustMat.current.opacity = 0.16 + (1 - s.night) * 0.12;
    if (dustGroup.current) dustGroup.current.rotation.y += dt * 0.012;
  });

  return (
    <group>
      {/* gradient dome */}
      <mesh renderOrder={-100} frustumCulled={false}>
        <sphereGeometry args={[1600, 32, 18]} />
        <shaderMaterial ref={domeMat} vertexShader={DOME_VERT} fragmentShader={DOME_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      {/* sun disc + halo */}
      <mesh ref={sunDisc} renderOrder={-60}>
        <circleGeometry args={[46, 24]} />
        <meshBasicMaterial color="#FFEDC4" transparent opacity={0.9} depthWrite={false} fog={false} />
      </mesh>
      <mesh ref={sunHalo} renderOrder={-61}>
        <circleGeometry args={[170, 24]} />
        <meshBasicMaterial color="#FFB454" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <StarsField matRef={starsMat} />
      <hemisphereLight ref={hemi} intensity={0.5} />
      <directionalLight
        ref={sun}
        castShadow
        position={[0, 300, 120]}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-190}
        shadow-camera-right={190}
        shadow-camera-top={190}
        shadow-camera-bottom={-190}
        shadow-camera-near={10}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
      />
      <DustMotes matRef={dustMat} pointsRef={dustGroup} />
    </group>
  );
}

const _WHITE = new THREE.Color('#FFFFFF');
const _FOG = new THREE.Color();

/* ---------- root scene ---------- */
export function TunerScene() {
  const dunes = useMemo(buildDunes, []);
  return (
    <>
      <SkyRig />
      <mesh geometry={dunes} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
      </mesh>
      <Landmarks />
      <OrbitControls
        target={[0, 10, 0]}
        enableDamping
        dampingFactor={0.08}
        autoRotate
        autoRotateSpeed={0.3}
        minDistance={40}
        maxDistance={420}
        maxPolarAngle={Math.PI * 0.52}
      />
    </>
  );
}

/**
 * SIGNAL CACHE SCOUT BENCH — R3F readability range.
 *
 * A straight distance-marked lane of the SHIPPING cache assembly
 * (src/game/SignalCaches.tsx: ground ring, weathered tripod, floating
 * violet octahedron, glimmer beam — one useFrame per station for bob/spin)
 * under swappable Sky.tsx backdrops (day salt / dusk burn / night watch)
 * with a storm-dust filter (sand-haze fog blend + drifting motes, mirroring
 * the storm language in DESIGN.md). Bench furniture: 25 m range ticks, a
 * violet hint gate at the 340 m hail cutoff, a 13 m capture footprint on the
 * nearest cache, and the mission-colour reference holos (◆ ■ ▲) standing
 * beside the lane so violet separability is eyeballed in-scene.
 * ChipProbe writes the camera's distance-to-nearest-cache into the DOM HUD
 * chip replica (hidden past 340 m, like the real store logic).
 * All per-frame work mutates module scratch/refs only.
 */
import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { fbm2, ridge2, smooth01, lerp, mulberry32 } from '../../../lib/noise';
import {
  BACKDROPS, STORMS, SHIPPED, CACHE_VIOLET, TRIPOD_TIMBER, MISSION_COLOURS,
  FAMILY_POSITIONS, stationPositions, blendHex,
  type Backdrop, type Storm, type BenchConfig,
} from './spec';

/* ---------------- salt-pan floor ---------------- */

function panHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = fbm2(x * 0.018, z * 0.018, 2) * 0.5;
  h = lerp(h, 0, smooth01((240 - r) / 80)); // firing-lane apron stays flat
  h += smooth01((r - 640) / 180) * Math.max(0, ridge2(x * 0.008 + 3.1, z * 0.008 - 1.2, 3)) * 30;
  return h;
}

function buildFloor() {
  const SIZE = 2400;
  const SEG = 120;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -420); // apron between camera and the horizon rim
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const lo = new THREE.Color('#CFC3A8'); // sun-bleached pan
  const hi = new THREE.Color('#E7DBC0');
  const crest = new THREE.Color('#F6EFE0'); // salt crest
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = panHeight(x, z);
    pos.setY(i, h);
    const n = fbm2(x * 0.04, z * 0.04, 2) * 0.5 + 0.5;
    c.copy(lo).lerp(hi, 0.3 + n * 0.6);
    c.lerp(crest, smooth01((h - 8) / 30) * 0.85);
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

/* ---------------- palette resolution (backdrop × storm) ---------------- */

interface Palette {
  top: string;
  horizon: string;
  glow: string;
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  floorTint: string;
  stars: boolean;
  sunDisc: { pos: [number, number, number]; color: string; size: number } | null;
  sunDiscOpacity: number;
}

function resolvePalette(bd: Backdrop, st: Storm): Palette {
  return {
    top: bd.skyTop,
    horizon: blendHex(bd.horizon, st.sand, st.horizonBlend),
    glow: blendHex(bd.glow, st.sand, st.horizonBlend * 0.5),
    fog: blendHex(bd.fog, st.sand, st.fogBlend),
    fogDensity: bd.fogDensity + st.fogDensityAdd,
    sunColor: bd.sunColor,
    sunIntensity: bd.sunIntensity * st.sunKeep,
    ambient: bd.ambient * (0.55 + st.sunKeep * 0.45),
    hemiSky: blendHex(bd.hemiSky, st.sand, st.fogBlend * 0.5),
    hemiGround: blendHex(bd.hemiGround, st.sand, st.fogBlend * 0.6),
    floorTint: blendHex(bd.floorTint, '#D9B98C', st.fogBlend * 0.7),
    stars: bd.stars && st.id === 'off',
    sunDisc: bd.sunDisc,
    sunDiscOpacity: 1 - st.fogBlend * 0.55,
  };
}

/* ---------------- sky dome (gradient shader, mirrors the beacons bench) ---------------- */

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
  uniform vec3 uGlow;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 sky = mix(uHorizon, uTop, pow(smoothstep(-0.03, 0.55, h), 0.8));
    float glow = exp(-abs(h) * 14.0) * (0.5 + 0.5 * normalize(vDir).x);
    sky += uGlow * glow * 0.35;
    gl_FragColor = vec4(sky, 1.0);
  }
`;

function SkyDome({ palette }: { palette: Palette }) {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#14101F') },
      uHorizon: { value: new THREE.Color('#2A2140') },
      uGlow: { value: new THREE.Color('#FFB454') },
    }),
    [],
  );
  useLayoutEffect(() => {
    (uniforms.uTop.value as THREE.Color).set(palette.top);
    (uniforms.uHorizon.value as THREE.Color).set(palette.horizon);
    (uniforms.uGlow.value as THREE.Color).set(palette.glow);
  }, [uniforms, palette]);
  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[1900, 24, 14]} />
      <shaderMaterial
        vertexShader={DOME_VERT}
        fragmentShader={DOME_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

function Stars() {
  const geo = useMemo(() => {
    const rand = mulberry32(99);
    const N = 650;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const e = Math.acos(rand() * 0.92 + 0.06);
      const r = 1750;
      arr[i * 3] = Math.cos(a) * Math.sin(e) * r;
      arr[i * 3 + 1] = Math.cos(e) * r;
      arr[i * 3 + 2] = Math.sin(a) * Math.sin(e) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004;
  });
  return (
    <points geometry={geo} ref={ref}>
      <pointsMaterial size={2.2} sizeAttenuation={false} color="#E4D7BE" transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}

function SunDisc({ palette }: { palette: Palette }) {
  const d = palette.sunDisc;
  if (!d) return null;
  return (
    <mesh position={d.pos}>
      <sphereGeometry args={[d.size, 18, 12]} />
      <meshBasicMaterial color={d.color} fog={false} transparent opacity={palette.sunDiscOpacity} />
    </mesh>
  );
}

/* ---------------- bench furniture ---------------- */

function RangeTicks({ max }: { max: number }) {
  const count = Math.ceil((max + 50) / 25);
  const mesh = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const z = -(i + 1) * 25;
      m.makeTranslation(0, panHeight(0, z) + 0.5, z);
      mesh.current.setMatrixAt(i, m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} key={count}>
      <cylinderGeometry args={[0.12, 0.18, 1, 5]} />
      {/* muted sand — bench furniture, deliberately NOT a mission colour */}
      <meshStandardMaterial color="#C9B58C" emissive="#C9B58C" emissiveIntensity={0.28} flatShading roughness={0.8} />
    </instancedMesh>
  );
}

/** 13 m capture footprint drawn around the nearest station. */
function CaptureRing({ pos }: { pos: [number, number] }) {
  const y = panHeight(pos[0], pos[1]);
  return (
    <group position={[pos[0], y, pos[1]]}>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SHIPPED.captureRadius - 0.35, SHIPPED.captureRadius + 0.35, 48]} />
        <meshBasicMaterial color={CACHE_VIOLET} transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a) => (
        <mesh key={a} position={[Math.cos(a) * SHIPPED.captureRadius, 0.45, Math.sin(a) * SHIPPED.captureRadius]}>
          <boxGeometry args={[0.3, 0.9, 0.3]} />
          <meshStandardMaterial color={CACHE_VIOLET} emissive={CACHE_VIOLET} emissiveIntensity={0.7} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** The 340 m hail cutoff — HUD chip + minimap feed drop out beyond this gate. */
function HintGate() {
  const z = -SHIPPED.hintRange;
  const y = panHeight(0, z);
  return (
    <group position={[0, y, z]}>
      {[-10, 10].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 2.75, 0]}>
            <cylinderGeometry args={[0.16, 0.26, 5.5, 6]} />
            <meshStandardMaterial color="#3A2F4E" flatShading roughness={0.9} />
          </mesh>
          <mesh position={[0, 4.9, 0]}>
            <boxGeometry args={[0.5, 0.9, 0.5]} />
            <meshStandardMaterial color={CACHE_VIOLET} emissive={CACHE_VIOLET} emissiveIntensity={1.1} flatShading />
          </mesh>
          <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.7, 20]} />
            <meshBasicMaterial color={CACHE_VIOLET} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[20.6, 0.2, 0.28]} />
        <meshBasicMaterial color={CACHE_VIOLET} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, 6.4, 0]}>
        <octahedronGeometry args={[0.5]} />
        <meshStandardMaterial color={CACHE_VIOLET} emissive={CACHE_VIOLET} emissiveIntensity={1.3} flatShading />
      </mesh>
    </group>
  );
}

/** Mission-colour reference holos beside the lane (violet separability check). */
function FamilyHolos({ motion }: { motion: boolean }) {
  return (
    <group>
      {FAMILY_POSITIONS.map(({ pos, id }) => {
        const def = MISSION_COLOURS.find((m) => m.id === id)!;
        const y = panHeight(pos[0], pos[1]);
        return (
          <group key={id} position={[pos[0], y, pos[1]]}>
            <mesh position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.42, 0.62, 1.8, 6]} />
              <meshStandardMaterial color="#4A2E22" flatShading roughness={1} />
            </mesh>
            <Spinning motion={motion} y={3.2}>
              {id === 'objective' && (
                <mesh rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[1.3, 1.3, 1.3]} />
                  <meshBasicMaterial color={def.colour} transparent opacity={0.9} depthTest={false} />
                </mesh>
              )}
              {id === 'convoy' && (
                <mesh>
                  <boxGeometry args={[1.35, 1.35, 0.5]} />
                  <meshBasicMaterial color={def.colour} transparent opacity={0.9} depthTest={false} />
                </mesh>
              )}
              {id === 'chase' && (
                <mesh rotation={[0, 0, Math.PI]}>
                  <tetrahedronGeometry args={[1.25]} />
                  <meshBasicMaterial color={def.colour} transparent opacity={0.9} depthTest={false} />
                </mesh>
              )}
            </Spinning>
          </group>
        );
      })}
    </group>
  );
}

function Spinning({ motion, y, children }: { motion: boolean; y: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = (motion ? clock.elapsedTime : 0) * 0.8;
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      {children}
    </group>
  );
}

/* ---------------- the shipping cache assembly ---------------- */

function CacheStation({ pos, idx, cfg }: { pos: [number, number]; idx: number; cfg: BenchConfig }) {
  const core = useRef<THREE.Group>(null);
  const y = panHeight(pos[0], pos[1]);
  useFrame(({ clock }) => {
    const t = cfg.motion ? clock.elapsedTime : 0;
    const g = core.current;
    if (g) {
      g.rotation.y = t * SHIPPED.core.spinRadPerSec + idx * 1.3;
      g.position.y = SHIPPED.core.bobY + Math.sin(t * SHIPPED.core.bobRadPerSec + idx * 2.1) * SHIPPED.core.bobAmp;
    }
  });
  return (
    <group position={[pos[0], y, pos[1]]}>
      {/* ground ring */}
      <mesh position={[0, SHIPPED.ring.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SHIPPED.ring.inner, SHIPPED.ring.outer, 24]} />
        <meshBasicMaterial color={CACHE_VIOLET} transparent opacity={cfg.ring} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* weathered tripod */}
      {[0, 2.094, 4.189].map((a) => (
        <mesh
          key={a}
          position={[Math.cos(a) * SHIPPED.tripod.baseRadius, SHIPPED.tripod.y, Math.sin(a) * SHIPPED.tripod.baseRadius]}
          rotation={[Math.sin(a) * SHIPPED.tripod.lean, 0, Math.cos(a) * -SHIPPED.tripod.lean]}
        >
          <cylinderGeometry args={[SHIPPED.tripod.legTop, SHIPPED.tripod.legBottom, SHIPPED.tripod.legHeight, 5]} />
          <meshStandardMaterial color={TRIPOD_TIMBER} flatShading />
        </mesh>
      ))}
      {/* floating core — bob + spin driven above, mirroring the game loop */}
      <group ref={core} position={[0, SHIPPED.core.bobY, 0]}>
        <mesh>
          <octahedronGeometry args={[SHIPPED.core.size]} />
          <meshStandardMaterial color={CACHE_VIOLET} emissive={CACHE_VIOLET} emissiveIntensity={cfg.emissive} flatShading />
        </mesh>
        {/* whisper glimmer so caches read at range against the sky */}
        <mesh position={[0, SHIPPED.glimmer.yOff, 0]}>
          <cylinderGeometry args={[SHIPPED.glimmer.rTop, SHIPPED.glimmer.rBottom, SHIPPED.glimmer.height, 6, 1, true]} />
          <meshBasicMaterial color={CACHE_VIOLET} transparent opacity={cfg.glimmer} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- storm dust motes ---------------- */

const DUST_N = 420;

function StormDust({ storm }: { storm: Storm }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const rand = mulberry32(31);
    const arr = new Float32Array(DUST_N * 3);
    for (let i = 0; i < DUST_N; i++) {
      arr[i * 3] = (rand() * 2 - 1) * 460;
      arr[i * 3 + 1] = rand() * 42 + 0.5;
      arr[i * 3 + 2] = 60 - rand() * 880;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    const p = ref.current;
    if (!p || storm.dustSpeed <= 0) return;
    const attr = p.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < DUST_N; i++) {
      let x = arr[i * 3] + storm.dustSpeed * dt * (0.6 + (i % 5) * 0.14);
      if (x > 470) x -= 940;
      arr[i * 3] = x;
    }
    attr.needsUpdate = true;
  });
  if (storm.dustOpacity <= 0) return null;
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial size={1.6} sizeAttenuation color="#D9A45B" transparent opacity={storm.dustOpacity} depthWrite={false} />
    </points>
  );
}

/* ---------------- HUD chip telemetry probe ---------------- */

function ChipProbe({
  stations,
  chipRef,
}: {
  stations: [number, number][];
  chipRef: RefObject<HTMLDivElement | null>;
}) {
  const last = useRef('');
  useFrame(({ camera }) => {
    const el = chipRef.current;
    if (!el) return;
    let best = Infinity;
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (let i = 0; i < stations.length; i++) {
      const dx = stations[i][0] - cx;
      const dz = stations[i][1] - cz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) best = d;
    }
    // mirror the game rule: the hint chip only exists within hail range
    const s = best > SHIPPED.hintRange ? '·out·' : `⟡ faint signal · ${Math.round(best)} m`;
    if (s !== last.current) {
      const wasHidden = last.current === '·out·';
      const hidden = s === '·out·';
      last.current = s;
      if (hidden) el.classList.add('scb-chip-hidden');
      else {
        if (wasHidden) el.classList.remove('scb-chip-hidden');
        el.textContent = s;
      }
    }
  });
  return null;
}

/* ---------------- root ---------------- */

export function BenchScene({
  cfg,
  chipRef,
}: {
  cfg: BenchConfig;
  chipRef: RefObject<HTMLDivElement | null>;
}) {
  const floor = useMemo(buildFloor, []);
  const bd = BACKDROPS[cfg.backdrop];
  const storm = STORMS[cfg.storm];
  const palette = useMemo(() => resolvePalette(bd, storm), [bd, storm]);
  const fog = useMemo(() => new THREE.FogExp2(palette.fog, palette.fogDensity), [palette]);
  const stations = useMemo(() => stationPositions(cfg.ladder), [cfg.ladder]);
  const maxDist = stations.length ? -stations[stations.length - 1][1] : 400;

  return (
    <>
      <primitive object={fog} attach="fog" />
      <SkyDome palette={palette} />
      {palette.stars && <Stars />}
      {palette.sunDisc && <SunDisc palette={palette} />}
      <hemisphereLight intensity={0.34 + palette.ambient * 0.3} color={palette.hemiSky} groundColor={palette.hemiGround} />
      <directionalLight position={[-420, 520, 260]} intensity={palette.sunIntensity} color={palette.sunColor} />
      <ambientLight intensity={palette.ambient * 0.18} />
      <mesh geometry={floor}>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} color={palette.floorTint} />
      </mesh>
      <RangeTicks max={maxDist} />
      {stations.length > 0 && <CaptureRing pos={stations[0]} />}
      <HintGate />
      <FamilyHolos motion={cfg.motion} />
      {stations.map((p, i) => (
        <CacheStation key={`${cfg.ladder}-${i}`} pos={p} idx={i} cfg={cfg} />
      ))}
      <StormDust storm={storm} />
      <ChipProbe stations={stations} chipRef={chipRef} />
      <OrbitControls
        target={[0, 4, -110]}
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={1300}
        maxPolarAngle={Math.PI * 0.495}
      />
    </>
  );
}

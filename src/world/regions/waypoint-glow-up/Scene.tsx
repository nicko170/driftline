/**
 * WAYPOINT & BEACON BENCH — R3F night test range.
 *
 * A straight, distance-marked firing lane of the shipping mission markers,
 * rendered in worst-case conditions (night, violet fog, emissive glow):
 * collect cluster → waypoint beam → scout scan → convoy beam → chase beam →
 * storm disc → race-gate trio. Station distances come from the layout
 * preset; colours come from the colourway; `motion:false` freezes t=0.
 * All per-frame work mutates module scratch/refs only.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { fbm2, ridge2, smooth01, lerp, clamp01, mulberry32 } from '../../../lib/noise';
import { SPEC, COLOURWAYS, LAYOUTS, type BenchConfig, type ColourwayId } from './spec';

/* Station order along the lane. */
type StationKind = 'collect' | 'waypoint' | 'scout' | 'convoy' | 'chase' | 'storm' | 'gates';
const STATIONS: StationKind[] = ['collect', 'waypoint', 'scout', 'convoy', 'chase', 'storm', 'gates'];

/* ---------------- night floor ---------------- */

function panHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = fbm2(x * 0.018, z * 0.018, 2) * 0.5;
  h = lerp(h, 0, smooth01((220 - r) / 60)); // apron stays flat
  h += smooth01((r - 600) / 160) * Math.max(0, ridge2(x * 0.008 + 1.7, z * 0.008 - 2.4, 3)) * 34;
  return h;
}

function buildFloor() {
  const SIZE = 1900;
  const SEG = 130;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -400); // apron between camera and horizon
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const lo = new THREE.Color('#332A26');
  const hi = new THREE.Color('#564638');
  const crest = new THREE.Color('#6E5B49');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = panHeight(x, z);
    pos.setY(i, h);
    const n = fbm2(x * 0.04, z * 0.04, 2) * 0.5 + 0.5;
    c.copy(lo).lerp(hi, 0.3 + n * 0.6);
    c.lerp(crest, smooth01((h - 8) / 30) * 0.8);
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

/* ---------------- range ticks + start gantry ---------------- */

const TICK_COUNT = 27; // every 25 m to 675 m

function RangeTicks() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < TICK_COUNT; i++) {
      const z = -(i + 1) * 25;
      m.makeTranslation(0, panHeight(0, z) + 0.6, z);
      mesh.current.setMatrixAt(i, m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, TICK_COUNT]}>
      <cylinderGeometry args={[0.14, 0.2, 1.2, 5]} />
      <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={0.9} flatShading roughness={0.8} />
    </instancedMesh>
  );
}

function StartGantry() {
  return (
    <group position={[0, panHeight(0, 26), 26]}>
      {[-10, 10].map((o) => (
        <mesh key={o} position={[o, 4.5, 0]}>
          <boxGeometry args={[1.1, 9, 1.1]} />
          <meshStandardMaterial color="#4A2E22" flatShading roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 9.2, 0]}>
        <boxGeometry args={[22, 1, 1.4]} />
        <meshStandardMaterial color="#3A3038" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 8.5, 0]}>
        <boxGeometry args={[21, 0.26, 0.3]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

/* ---------------- holo shapes (shape is the identity) ---------------- */

export type HoloShape = 'diamond' | 'square' | 'triangle' | 'disc';

function Holo({ shape, color, y, motion }: { shape: HoloShape; color: string; y: number; motion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    if (ref.current) {
      ref.current.rotation.y = t * SPEC.beam.spinRadPerSec * 2;
      ref.current.position.y = y + Math.sin(t * SPEC.beam.bobHz * Math.PI * 2) * SPEC.beam.bobAmp;
    }
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      {shape === 'diamond' && (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[SPEC.holo.size, SPEC.holo.size, SPEC.holo.size]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
      {shape === 'square' && (
        <mesh>
          <boxGeometry args={[SPEC.holo.size * 1.05, SPEC.holo.size * 1.05, 0.5]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
      {shape === 'triangle' && (
        <mesh rotation={[0, 0, Math.PI]}>
          <tetrahedronGeometry args={[SPEC.holo.size * 0.95]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
      {shape === 'disc' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[SPEC.holo.size * 0.75, SPEC.holo.size * 0.75, 0.24, 18]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

/* ---------------- marker components ---------------- */

function BeamStation({
  pos, color, shape, thin, motion,
}: {
  pos: [number, number];
  color: string;
  shape: HoloShape;
  thin?: boolean;
  motion: boolean;
}) {
  const spin = useRef<THREE.Group>(null);
  const y = panHeight(pos[0], pos[1]);
  const h = thin ? 46 : SPEC.beam.height;
  const rTop = thin ? 0.32 : SPEC.beam.radiusTop;
  const rBot = thin ? 0.95 : SPEC.beam.radiusBottom;
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = (motion ? clock.elapsedTime : 0) * SPEC.beam.spinRadPerSec;
  });
  return (
    <group position={[pos[0], y, pos[1]]}>
      {/* ground ring — the "you can complete here" footprint */}
      <mesh position={[0, SPEC.beam.ring.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[thin ? 4.4 : SPEC.beam.ring.inner, thin ? 6.1 : SPEC.beam.ring.outer, 28]} />
        <meshBasicMaterial color={color} transparent opacity={SPEC.beam.ring.opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* sky beam */}
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[rTop, rBot, h, 10, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={thin ? 0.16 : SPEC.beam.opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* ground glow pool */}
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.5, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} />
      </mesh>
      {/* rotating hoist + the shape that carries identity */}
      <group ref={spin} position={[0, SPEC.beam.holoY, 0]}>
        <mesh position={[0, -2.4, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 3.6, 5]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      </group>
      <Holo shape={shape} color={color} y={SPEC.beam.holoY + 1.4} motion={motion} />
    </group>
  );
}

function ScoutStation({ pos, color, motion }: { pos: [number, number]; color: string; motion: boolean }) {
  const arc = useRef<THREE.Mesh>(null);
  const y = panHeight(pos[0], pos[1]);
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    if (arc.current) arc.current.rotation.z = -t * 1.1;
  });
  return (
    <group position={[pos[0], y, pos[1]]}>
      {/* scan ring footprint */}
      <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.6, 8.1, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* sweeping arc */}
      <mesh ref={arc} position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.4, 7.3, 32, 1, 0, Math.PI * 0.42]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* squat scan mast */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.5, 0.9, 3.2, 6]} />
        <meshStandardMaterial color="#22343B" flatShading roughness={0.9} />
      </mesh>
      <Holo shape="square" color={color} y={4.6} motion={motion} />
    </group>
  );
}

function StormStation({ pos, color, motion }: { pos: [number, number]; color: string; motion: boolean }) {
  const veils = useRef<THREE.Group>(null);
  const y = panHeight(pos[0], pos[1]);
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    if (veils.current) {
      veils.current.rotation.y = t * 0.22;
      veils.current.position.y = Math.sin(t * 1.3) * 0.8;
    }
  });
  return (
    <group position={[pos[0], y, pos[1]]}>
      {/* danger disc footprint */}
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[11.5, 14, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[11.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.05} depthWrite={false} />
      </mesh>
      {/* churning veil stack */}
      <group ref={veils}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 8 + i * 7, 0]}>
            <cylinderGeometry args={[13 - i * 1.6, 14.5 - i * 1.6, 6.4, 18, 1, true]} />
            <meshBasicMaterial color={i === 0 ? '#8A5335' : '#5C3A2A'} transparent opacity={0.16 - i * 0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <Holo shape="disc" color={color} y={5} motion={motion} />
    </group>
  );
}

const COLLECT_OFFSETS: [number, number][] = (() => {
  const rand = mulberry32(421);
  return Array.from({ length: 5 }, () => {
    const a = rand() * Math.PI * 2;
    const r = 7 + rand() * 19; // game: pickups scatter 6–28 m around the anchor
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
})();

function CollectStation({ pos, color, motion }: { pos: [number, number]; color: string; motion: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const y = panHeight(pos[0], pos[1]);
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    for (let i = 0; i < refs.current.length; i++) {
      const m = refs.current[i];
      if (!m) continue;
      m.rotation.y = t * 1.7;
      m.position.y = SPEC.collect.hover + Math.sin(t * SPEC.collect.bobHz * Math.PI * 2 + i * 1.3) * SPEC.collect.bobAmp;
    }
  });
  return (
    <group position={[pos[0], y, pos[1]]}>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[26, 27.4, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {COLLECT_OFFSETS.map(([ox, oz], i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} position={[ox, SPEC.collect.hover, oz]}>
          <octahedronGeometry args={[SPEC.collect.size]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={SPEC.collect.emissive} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function GateTrio({ pos, way, motion }: { pos: [number, number]; way: ColourwayId; motion: boolean }) {
  const active = useRef<THREE.Mesh>(null);
  const activeMat = useRef<THREE.MeshBasicMaterial>(null);
  const y = panHeight(pos[0], pos[1]);
  const colors = { passed: COLOURWAYS[way].team, active: COLOURWAYS[way].waypoint, pending: COLOURWAYS[way].dim };
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    if (activeMat.current) activeMat.current.opacity = 0.9;
    if (active.current) active.current.rotation.y = t * 0.4;
  });
  return (
    <group position={[pos[0], y, pos[1]]}>
      {(
        [
          { x: -17, c: colors.passed, o: 0.9, key: 'passed' },
          { x: 0, c: colors.active, o: 0.9, key: 'active' },
          { x: 17, c: colors.pending, o: 0.35, key: 'pending' },
        ] as const
      ).map((g) => (
        <mesh
          key={g.key}
          ref={g.key === 'active' ? active : undefined}
          position={[g.x, SPEC.gate.hover + 2, 0]}
        >
          <torusGeometry args={[SPEC.gate.radius, SPEC.gate.tube, 6, 20]} />
          <meshBasicMaterial ref={g.key === 'active' ? activeMat : undefined} color={g.c} transparent opacity={g.o} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- night ambience ---------------- */

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
    // faint amber settlement glow along the eastern horizon
    float glow = exp(-abs(h) * 14.0) * (0.5 + 0.5 * normalize(vDir).x);
    sky += uGlow * glow * 0.5;
    gl_FragColor = vec4(sky, 1.0);
  }
`;

function NightSky() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#100C1B') },
      uHorizon: { value: new THREE.Color('#2A2140') },
      uGlow: { value: new THREE.Color('#FFB454') },
    }),
    [],
  );
  const stars = useMemo(() => {
    const rand = mulberry32(99);
    const N = 700;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const e = Math.acos(rand() * 0.92 + 0.06); // upper dome
      const r = 1500;
      arr[i * 3] = Math.cos(a) * Math.sin(e) * r;
      arr[i * 3 + 1] = Math.cos(e) * r;
      arr[i * 3 + 2] = Math.sin(a) * Math.sin(e) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const starsRef = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    if (starsRef.current) starsRef.current.rotation.y += dt * 0.004;
  });
  return (
    <group>
      <mesh renderOrder={-100} frustumCulled={false}>
        <sphereGeometry args={[1600, 24, 14]} />
        <shaderMaterial vertexShader={DOME_VERT} fragmentShader={DOME_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <points geometry={stars} ref={starsRef}>
        <pointsMaterial size={2.2} sizeAttenuation={false} color="#E4D7BE" transparent opacity={0.75} depthWrite={false} />
      </points>
      {/* low crescent moon east */}
      <mesh position={[820, 300, -420]}>
        <sphereGeometry args={[46, 18, 12]} />
        <meshBasicMaterial color="#E9DFC8" fog={false} />
      </mesh>
      <mesh position={[800, 314, -410]}>
        <sphereGeometry args={[44, 18, 12]} />
        <meshBasicMaterial color="#100C1B" fog={false} />
      </mesh>
      <hemisphereLight intensity={0.32} color="#4A3A6E" groundColor="#332720" />
      <directionalLight position={[420, 300, -180]} intensity={0.55} color="#A9B7D8" />
      {/* amber kicker from the settlement glow so hull edges read */}
      <directionalLight position={[-300, 90, 260]} intensity={0.22} color="#FFB454" />
    </group>
  );
}

/* ---------------- root ---------------- */

export function BenchScene({ cfg }: { cfg: BenchConfig }) {
  const floor = useMemo(buildFloor, []);
  const way = COLOURWAYS[cfg.colourway];
  const distances = LAYOUTS[cfg.layout].distances;

  // deterministic side offsets: stations alternate lanes so beams don't stack
  const stationPos = useMemo(() => {
    const rand = mulberry32(7);
    return STATIONS.map((_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return [side * (7 + rand() * 5), -distances[i]] as [number, number];
    });
  }, [distances]);

  return (
    <>
      <NightSky />
      <fogExp2 attach="fog" args={['#1C1528', 0.0026]} />
      <mesh geometry={floor}>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
      </mesh>
      <RangeTicks />
      <StartGantry />
      {STATIONS.map((kind, i) => {
        const p = stationPos[i];
        if (kind === 'collect') return <CollectStation key={kind} pos={p} color={way.team} motion={cfg.motion} />;
        if (kind === 'waypoint') return <BeamStation key={kind} pos={p} color={way.waypoint} shape="diamond" motion={cfg.motion} />;
        if (kind === 'scout') return <ScoutStation key={kind} pos={p} color={way.team} motion={cfg.motion} />;
        if (kind === 'convoy') return <BeamStation key={kind} pos={p} color={way.team} shape="square" thin motion={cfg.motion} />;
        if (kind === 'chase') return <BeamStation key={kind} pos={p} color={way.danger} shape="triangle" thin motion={cfg.motion} />;
        if (kind === 'storm') return <StormStation key={kind} pos={p} color={way.danger} motion={cfg.motion} />;
        return <GateTrio key={kind} pos={p} way={cfg.colourway} motion={cfg.motion} />;
      })}
      <OrbitControls
        target={[0, 7, -80]}
        enableDamping
        dampingFactor={0.08}
        minDistance={14}
        maxDistance={900}
        maxPolarAngle={Math.PI * 0.495}
      />
    </>
  );
}

/**
 * Radio Weight Sandbox — the soundstage.
 *
 * A night salt flat: one amber-lit relay mast ringed by fade-quiet plinths,
 * one per on-world band (plus Long Static). Plinths are clickable teleports to
 * "stand" your simulated rider on that band; a picked plinth glows amber-hot.
 * Two Choir-static scope consoles flank the stage; their teal traces spike on
 * every dice roll (benchPulse from weights.ts). Static geometry, module-level
 * scratch only — nothing allocates per frame.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { bandList, benchPulse } from './weights';

export interface SceneProps {
  band: string | null;
  hoverName: string | null;
  onPickBand: (slug: string | null) => void;
  onHoverBand: (name: string | null) => void;
}

const RING_R = 13;

const tmpObj = new THREE.Object3D();

/* ---------- distant salt spires (instanced, static) ---------- */

function SpireField() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 22;
  const seeds = useMemo(() => {
    // deterministic scatter — same stage every visit
    let s = 1337;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    return Array.from({ length: COUNT }, () => {
      const a = rand() * Math.PI * 2;
      const r = 26 + rand() * 17;
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        h: 2.2 + rand() * 6.4,
        w: 0.5 + rand() * 1.3,
        rot: rand() * Math.PI,
        lean: (rand() - 0.5) * 0.24,
      };
    });
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    seeds.forEach((sp, i) => {
      tmpObj.position.set(sp.x, sp.h * 0.5 - 0.5, sp.z);
      tmpObj.rotation.set(sp.lean, sp.rot, 0);
      tmpObj.scale.set(sp.w, sp.h, sp.w);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(i, tmpObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [seeds]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <coneGeometry args={[0.5, 1, 5]} />
      <meshStandardMaterial color="#241B3A" flatShading roughness={1} />
    </instancedMesh>
  );
}

/* ---------- the relay mast ---------- */

function Mast() {
  const lamp = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    benchPulse.v = Math.max(0, benchPulse.v - dt * 1.6);
    const p = benchPulse.v;
    const flicker = 1 + Math.sin(performance.now() * 0.011) * 0.05;
    if (lamp.current) lamp.current.intensity = (34 + p * 90) * flicker;
    const bulbMat = bulb.current?.material as THREE.MeshStandardMaterial | undefined;
    if (bulbMat) bulbMat.emissiveIntensity = (1.6 + p * 2.2) * flicker;
    const coneMat = cone.current?.material as THREE.MeshBasicMaterial | undefined;
    if (coneMat) coneMat.opacity = 0.045 + p * 0.05;
  });
  return (
    <group>
      {/* base crate + struts */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[2.6, 1.1, 2.6]} />
        <meshStandardMaterial color="#3A2C52" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.14, 0]}>
        <boxGeometry args={[2.7, 0.1, 2.7]} />
        <meshStandardMaterial color="#7E3320" flatShading roughness={0.9} />
      </mesh>
      {/* tapered pole */}
      <mesh position={[0, 7.6, 0]}>
        <cylinderGeometry args={[0.12, 0.3, 13, 6]} />
        <meshStandardMaterial color="#4A3A68" flatShading roughness={0.85} />
      </mesh>
      {/* cross arms */}
      <mesh position={[0, 9.4, 0]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[3.4, 0.09, 0.09]} />
        <meshStandardMaterial color="#3A2C52" flatShading />
      </mesh>
      <mesh position={[0, 11.6, 0]} rotation={[0, -0.7, 0]}>
        <boxGeometry args={[2.4, 0.08, 0.08]} />
        <meshStandardMaterial color="#3A2C52" flatShading />
      </mesh>
      {/* amber lamp (the only active light on the stage) */}
      <mesh ref={bulb} position={[0, 14.4, 0]}>
        <sphereGeometry args={[0.34, 10, 8]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.6} flatShading />
      </mesh>
      <pointLight ref={lamp} position={[0, 14.2, 0]} color="#FFB454" intensity={34} distance={46} decay={1.9} />
      {/* whisper-faint cone of lamplight (headlight language, ≤0.1 opacity) */}
      <mesh ref={cone} position={[0, 8.6, 0]}>
        <coneGeometry args={[6.2, 11.6, 18, 1, true]} />
        <meshBasicMaterial
          color="#FFD9A0"
          transparent
          opacity={0.045}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ---------- teleport plinths: one per band ---------- */

interface PlinthProps {
  slug: string | null;
  name: string;
  index: number;
  count: number;
  selected: boolean;
  hovered: boolean;
  onPick: (slug: string | null) => void;
  onHover: (name: string | null) => void;
}

function Plinth({ slug, name, index, count, selected, hovered, onPick, onHover }: PlinthProps) {
  const marker = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const a = (index / count) * Math.PI * 2 + Math.PI / count;
  const x = Math.cos(a) * RING_R;
  const z = Math.sin(a) * RING_R;
  const phase = index * 1.7;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const m = marker.current;
    if (m) {
      m.rotation.y = t * (selected ? 1.6 : 0.55) + phase;
      m.position.y = 1.75 + Math.sin(t * 1.3 + phase) * 0.14 + (selected ? 0.28 : 0);
    }
    const g = glow.current?.material as THREE.MeshBasicMaterial | undefined;
    if (g) g.opacity = selected ? 0.5 + Math.sin(t * 3.4) * 0.14 : hovered ? 0.3 : 0.1;
  });

  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        onPick(slug);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(name);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = '';
      }}
    >
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.85, 1.05, 0.56, 8]} />
        <meshStandardMaterial color={hovered || selected ? '#4A3A68' : '#2A2140'} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.07, 8]} />
        <meshStandardMaterial
          color={selected ? '#FFB454' : '#7E3320'}
          emissive={selected ? '#FFB454' : '#000000'}
          emissiveIntensity={selected ? 0.8 : 0}
          flatShading
        />
      </mesh>
      {/* hover glow disc */}
      <mesh ref={glow} position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.25, 20]} />
        <meshBasicMaterial
          color={selected ? '#FFC969' : '#57C4B8'}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* band diamond */}
      <mesh ref={marker} position={[0, 1.75, 0]}>
        <octahedronGeometry args={[0.42]} />
        <meshStandardMaterial
          color={selected ? '#FFC969' : hovered ? '#57C4B8' : '#8A7FA8'}
          emissive={selected ? '#FFB454' : hovered ? '#2E8C8C' : '#241B3A'}
          emissiveIntensity={selected ? 1.5 : hovered ? 0.9 : 0.5}
          flatShading
        />
      </mesh>
      {/* generous invisible hit volume so small targets stay easy to click */}
      <mesh position={[0, 1.2, 0]} visible={false}>
        <cylinderGeometry args={[1.5, 1.5, 3.4, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

/* ---------- oscilloscope consoles ---------- */

function ScopeConsole({ position, rotY, phase }: { position: [number, number, number]; rotY: number; phase: number }) {
  const scan = useRef<THREE.Mesh>(null);
  const screen = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = benchPulse.v;
    const speed = 1.4 + p * 5;
    const x = Math.sin(t * speed + phase) * 0.44;
    if (scan.current) scan.current.position.x = x;
    const mat = screen.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = 0.65 + p * 1.4 + Math.sin(t * 17 + phase) * 0.04;
  });
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.7, 1.0, 1.05]} />
        <meshStandardMaterial color="#3A2C52" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[1.76, 0.06, 1.1]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      {/* angled screen hood */}
      <group position={[0, 0.62, 0.5]} rotation={[-0.42, 0, 0]}>
        <mesh ref={screen} position={[0, 0, 0.03]}>
          <planeGeometry args={[1.3, 0.62]} />
          <meshStandardMaterial color="#0E2B28" emissive="#57C4B8" emissiveIntensity={0.65} flatShading />
        </mesh>
        <mesh ref={scan} position={[0, 0, 0.045]}>
          <planeGeometry args={[0.05, 0.56]} />
          <meshBasicMaterial color="#BFF5EE" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* half-dome graticule marks */}
        <mesh position={[0, 0.2, 0.04]}>
          <planeGeometry args={[1.2, 0.02]} />
          <meshBasicMaterial color="#2E8C8C" transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, -0.2, 0.04]}>
          <planeGeometry args={[1.2, 0.02]} />
          <meshBasicMaterial color="#2E8C8C" transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- the stage ---------- */

export function SandboxScene({ band, onPickBand, onHoverBand, hoverName }: SceneProps) {
  const bands = useMemo(() => bandList(), []);
  const stage = useRef<THREE.Group>(null);
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  // barely-there stage breathing — parked for reduced motion
  useFrame(({ clock }) => {
    if (reduceMotion || !stage.current) return;
    stage.current.rotation.y = Math.sin(clock.elapsedTime * 0.05) * 0.012;
  });
  return (
    <group ref={stage}>
      <color attach="background" args={['#100C1A']} />
      <fogExp2 attach="fog" args={['#14101F', 0.02]} />
      <hemisphereLight args={['#2A2140', '#14101F', 0.55]} />
      <Stars radius={90} depth={30} count={1400} factor={2.2} saturation={0} fade speed={0.4} />

      {/* night salt pan */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[46, 40]} />
        <meshStandardMaterial color="#171125" flatShading roughness={1} />
      </mesh>
      {/* stage pad + plinth ring rails */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]}>
        <circleGeometry args={[17.4, 36]} />
        <meshStandardMaterial color="#1D1630" flatShading roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <ringGeometry args={[RING_R - 1.5, RING_R - 1.4, 48]} />
        <meshBasicMaterial color="#B07C3A" transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <ringGeometry args={[RING_R + 1.4, RING_R + 1.5, 48]} />
        <meshBasicMaterial color="#B07C3A" transparent opacity={0.35} />
      </mesh>
      {/* etched compass spokes */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, (i * Math.PI) / 4]} position={[0, 0.005, 0]}>
          <planeGeometry args={[34, 0.1]} />
          <meshBasicMaterial color="#3A2C52" transparent opacity={0.5} />
        </mesh>
      ))}

      <Mast />
      <SpireField />
      <ScopeConsole position={[-5.4, 0, 6.4]} rotY={0.6} phase={0} />
      <ScopeConsole position={[5.4, 0, 6.4]} rotY={-0.6} phase={2.4} />

      {bands.map((b, i) => (
        <Plinth
          key={b.slug ?? 'long-static'}
          slug={b.slug}
          name={b.name}
          index={i}
          count={bands.length}
          selected={band === b.slug}
          hovered={hoverName === b.name}
          onPick={onPickBand}
          onHover={onHoverBand}
        />
      ))}
    </group>
  );
}

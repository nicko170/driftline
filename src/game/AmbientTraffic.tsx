/**
 * AMBIENT TRAFFIC — the Driftline lives. A handful of NPC couriers, guild
 * haulers and choir skiffs cruise fixed loops between settlements. Purely
 * visual (no colliders, no physics bodies): hover-follow over the analytic
 * terrain, gentle bob, banked turns, faction-coloured glow. Cheap enough to
 * always run — six groups of a few prims, no allocations per frame.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { terrainHeight } from '../lib/terrain';
import { GLASSROAD_PATH } from '../world/layout';

type VehicleKind = 'courier' | 'hauler' | 'skiff';

interface VehicleSpec {
  kind: VehicleKind;
  /** Loop polyline (x,z world). Vehicles teleport-wrap seamlessly. */
  route: [number, number][];
  speed: number;   // m/s along the polyline
  phase: number;   // 0..1 start position along the loop
  color: string;   // hull
  glow: string;    // faction glow
  hover: number;   // ride height
}

const VEHICLES: VehicleSpec[] = [
  {
    kind: 'courier', speed: 30, phase: 0.1, color: '#B3502E', glow: '#FFB454', hover: 1.3,
    route: [...GLASSROAD_PATH] as [number, number][], // saltmouth end ⇄ canyon
  },
  {
    kind: 'courier', speed: 26, phase: 0.55, color: '#7E3320', glow: '#FFB454', hover: 1.3,
    route: [[0, 300], [240, 470], [480, 620], [240, 470]], // saltmouth ⇄ choirhollow
  },
  {
    kind: 'hauler', speed: 14, phase: 0.3, color: '#B07C3A', glow: '#FFB454', hover: 1.6,
    route: [[0, 300], [-220, 520], [-430, 640], [-520, 720], [-430, 640], [-220, 520]], // saltmouth ⇄ cinderflats
  },
  {
    kind: 'hauler', speed: 13, phase: 0.75, color: '#8A8578', glow: '#FFB454', hover: 1.6,
    route: [[0, 300], [-350, -60], [-780, -380], [-350, -60]], // saltmouth ⇄ skydocks
  },
  {
    kind: 'skiff', speed: 21, phase: 0.15, color: '#2E8C8C', glow: '#57C4B8', hover: 1.45,
    route: [[520, -520], [680, -470], [820, -420], [680, -470]], // glassroad ⇄ windspine
  },
  {
    kind: 'skiff', speed: 19, phase: 0.6, color: '#57C4B8', glow: '#57C4B8', hover: 1.45,
    route: [[0, 300], [-100, -60], [-120, -560], [-120, -980], [-120, -560], [-100, -60]], // saltmouth ⇄ drowned array
  },
];

/** Cumulative segment lengths for one loop. */
function measure(route: [number, number][]): { segs: number[]; total: number } {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i];
    const [bx, bz] = route[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    segs.push(len);
    total += len;
  }
  return { segs, total };
}

const _dir = new THREE.Vector3();
function Vehicle({ spec }: { spec: VehicleSpec }) {
  const ref = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const { segs, total } = useMemo(() => measure(spec.route), [spec.route]);
  const state = useRef({ s: spec.phase * total, yaw: 0, bank: 0 });

  useFrame((root, delta) => {
    const g = ref.current;
    if (!g) return;
    const st = state.current;
    const step = Math.min(delta, 0.05);
    st.s = (st.s + spec.speed * step) % total;

    // locate on polyline
    let s = st.s;
    let i = 0;
    while (i < segs.length - 1 && s > segs[i]) { s -= segs[i]; i++; }
    const [ax, az] = spec.route[i];
    const [bx, bz] = spec.route[Math.min(i + 1, spec.route.length - 1)];
    const t = segs[i] > 0 ? s / segs[i] : 0;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const ground = terrainHeight(x, z);
    const bob = Math.sin(root.clock.elapsedTime * 1.8 + spec.phase * 12) * 0.16;
    g.position.set(x, ground + spec.hover + bob, z);

    // heading + bank (smoothed)
    _dir.set(bx - ax, 0, bz - az).normalize();
    const targetYaw = Math.atan2(_dir.x, _dir.z);
    let dy = targetYaw - st.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    st.yaw += dy * Math.min(1, 3.2 * step);
    st.bank += (THREE.MathUtils.clamp(-dy * 6, -0.4, 0.4) - st.bank) * Math.min(1, 4 * step);
    g.rotation.set(0, st.yaw, st.bank, 'YXZ');

    if (bodyRef.current) {
      const pitch = Math.sin(root.clock.elapsedTime * 2.3 + spec.phase * 7) * 0.02;
      bodyRef.current.rotation.x = pitch;
    }
  });

  return (
    <group ref={ref}>
      <group ref={bodyRef}>
        {spec.kind === 'courier' && <CourierMesh color={spec.color} glow={spec.glow} />}
        {spec.kind === 'hauler' && <HaulerMesh color={spec.color} glow={spec.glow} />}
        {spec.kind === 'skiff' && <SkiffMesh color={spec.color} glow={spec.glow} />}
      </group>
    </group>
  );
}

/* frameloop delta comes from useFrame's `delta` argument. */

function CourierMesh({ color, glow }: { color: string; glow: string }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.8, 0.4, 2.5]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.02, 1.45]} rotation={[0.22, 0, 0]}>
        <boxGeometry args={[0.55, 0.28, 0.85]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.72, -0.28]} rotation={[0.3, 0, 0]}>
        <capsuleGeometry args={[0.2, 0.46, 3, 6]} />
        <meshStandardMaterial color="#5C4632" flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      {/* under-glow */}
      <mesh position={[0, -0.32, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.66, 2.1]} />
        <meshBasicMaterial color={glow} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HaulerMesh({ color, glow }: { color: string; glow: string }) {
  return (
    <group>
      {/* deck */}
      <mesh castShadow position={[0, 0.1, -0.4]}>
        <boxGeometry args={[1.7, 0.5, 4.6]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {/* cab */}
      <mesh castShadow position={[0, 0.72, 1.55]}>
        <boxGeometry args={[1.4, 0.9, 1.1]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      <mesh position={[0, 0.72, 2.12]}>
        <boxGeometry args={[1.1, 0.42, 0.06]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={0.9} />
      </mesh>
      {/* cargo drums */}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} castShadow position={[x, 0.68, -0.6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 0.8, 7]} />
          <meshStandardMaterial color="#8A8578" flatShading />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.85, -1.7]}>
        <boxGeometry args={[1.2, 1.1, 1.2]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      {/* skirt glow */}
      <mesh position={[0, -0.22, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 4.2]} />
        <meshBasicMaterial color={glow} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SkiffMesh({ color, glow }: { color: string; glow: string }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[1.1, 0.34, 3.2]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {/* sail mast */}
      <mesh castShadow position={[0, 1.3, -0.6]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.08, 2.4, 0.08]} />
        <meshStandardMaterial color="#3A2E22" flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.7, -0.5]} rotation={[0.12, 0, 0.06]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial color="#E4D7BE" flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 2.8]} />
        <meshBasicMaterial color={glow} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function AmbientTraffic() {
  return (
    <group>
      {VEHICLES.map((v, i) => <Vehicle key={i} spec={v} />)}
    </group>
  );
}

/**
 * CANYON-SLALOM — "The Sluice": the couriers' time-trial down the Glass Road canyon.
 *
 * Eight slalom gates weave down the slick fused-glass canyon (the shared terrain
 * already cuts the grip to 0.5 inside the carve — this region dresses it into a
 * race course). Every gate position derives from the GLASSROAD_PATH polyline at
 * fixed course distances, and the anchors in anchors.json were computed with the
 * same math, so visuals, physics colliders and mission targets always agree.
 *
 * Performance: pylons / caps / crossbars / light strips / chevrons are instanced
 * (5 draw calls for the whole course); only the floating gate diamonds animate.
 */
import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import type { RegionModule, RegionMeta, Anchor, RegionCollider } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import { GLASSROAD_PATH } from '../../layout';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';
import demoMeta from './meta';

const regionMeta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

/** Demo/lab contract — this folder is also listed as a workshed entry. */
export const meta = demoMeta;

const C = {
  rust: '#B3502E',
  rustDeep: '#7E3320',
  bone: '#E4D7BE',
  teal: '#2E8C8C',
  tealBright: '#57C4B8',
  amber: '#FFB454',
  amberHot: '#FFC969',
};

/* ---------------- course math (fixed course distances along the canyon) ---------------- */

const GATE_IDS = ['gate-1', 'gate-2', 'gate-3', 'gate-4', 'gate-5', 'gate-6', 'gate-7', 'gate-8'] as const;
const GATE_D = [200, 380, 560, 740, 920, 1100, 1280, 1440]; // metres from the canyon mouth
const START_D = 60;
const FINISH_D = 1600;

/** Point + unit direction at distance d along the Glass Road polyline. */
function coursePoint(d: number): { x: number; z: number; dx: number; dz: number } {
  let acc = 0;
  for (let i = 0; i < GLASSROAD_PATH.length - 1; i++) {
    const [ax, az] = GLASSROAD_PATH[i];
    const [bx, bz] = GLASSROAD_PATH[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (d <= acc + len || i === GLASSROAD_PATH.length - 2) {
      const t = Math.min(Math.max((d - acc) / len, 0), 1);
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / len, dz: (bz - az) / len };
    }
    acc += len;
  }
  return { x: 0, z: 0, dx: 0, dz: -1 };
}

interface Frame {
  x: number;
  y: number;
  z: number;
  ry: number;
}

/** Frame at an anchor, rotated to face across the road. */
function frameAt(id: string, d: number): Frame {
  const [x, z] = anchors[id].pos;
  const cp = coursePoint(d);
  return { x, y: terrainHeight(x, z), z, ry: Math.atan2(cp.dx, cp.dz) };
}

/** Frame at a course distance (no anchor — for chevrons). */
function frameAlong(d: number): Frame {
  const cp = coursePoint(d);
  return { x: cp.x, y: terrainHeight(cp.x, cp.z), z: cp.z, ry: Math.atan2(cp.dx, cp.dz) };
}

/** Offset a frame laterally (perpendicular to the road) in world space. */
const lateral = (f: Frame, side: number): [number, number] => [
  f.x + Math.cos(f.ry) * side,
  f.z - Math.sin(f.ry) * side,
];

const GATE_HALF = 8; // gate pylons stand ±8m off the racing line
const PYLON_H = 11;

const gateFrames = GATE_IDS.map((id, i) => frameAt(id, GATE_D[i]));
const startFrame = frameAt('start-gantry', START_D);
const finishFrame = frameAt('finish-line', FINISH_D);

/* ---------------- instanced item lists (module-level, computed once) ---------------- */

interface BoxItem {
  pos: [number, number, number];
  ry: number;
}

// Gate pylons — 2 per gate
const pylons: BoxItem[] = [];
for (const f of gateFrames) {
  for (const side of [-GATE_HALF, GATE_HALF]) {
    const [x, z] = lateral(f, side);
    pylons.push({ pos: [x, f.y + PYLON_H / 2 - 0.4, z], ry: f.ry });
  }
}
// Amber caps on the pylon tops
const caps: BoxItem[] = pylons.map((p) => ({ pos: [p.pos[0], p.pos[1] + PYLON_H / 2 + 0.1, p.pos[2]], ry: p.ry }));
// Crossbars high over the racing line + their approach-face light strips
const crossbars: BoxItem[] = gateFrames.map((f) => ({ pos: [f.x, f.y + 9.6, f.z], ry: f.ry }));
const strips: BoxItem[] = gateFrames.map((f) => ({
  pos: [f.x + Math.sin(f.ry) * 0.62, f.y + 9.6, f.z + Math.cos(f.ry) * 0.62],
  ry: f.ry,
}));
// Guideline chevrons just past each gate, pointing riders toward the next one
const chevrons: BoxItem[] = GATE_D.map((d, i) => {
  const gateSide = i % 2 === 0 ? 1 : -1; // gates alternate ±14 m off centreline
  const f = frameAlong(d + 16);
  const cp = coursePoint(d + 16);
  const x = f.x + cp.dz * (12 * gateSide);
  const z = f.z - cp.dx * (12 * gateSide);
  return { pos: [x, terrainHeight(x, z) + 1.6, z], ry: f.ry };
});

/* ---------------- colliders (same math as visuals) ---------------- */

const marshallPos = anchors['marshal-post'].pos;
const ledgePos = anchors['spectator-ledge'].pos;

const colliders: RegionCollider[] = [
  ...pylons.map((p) => ({ pos: [p.pos[0], p.pos[2]] as [number, number], size: [1.7, PYLON_H, 1.7] as [number, number, number], rotY: p.ry })),
  ...[startFrame, finishFrame].flatMap((f) =>
    [-11.5, 11.5].map((side) => {
      const [x, z] = lateral(f, side);
      return { pos: [x, z] as [number, number], size: [2.4, 13, 2.4] as [number, number, number], rotY: f.ry };
    }),
  ),
  { pos: [marshallPos[0], marshallPos[1]], size: [5.5, 4, 4.5], rotY: startFrame.ry },
  { pos: [ledgePos[0], ledgePos[1]], size: [9, 2.4, 1], rotY: frameAlong(GATE_D[4]).ry },
  { pos: [marshallPos[0] + 4, marshallPos[1] + 3], size: [2.4, 1.6, 2], rotY: 0.5 },
];

/* ---------------- instanced box helper (one draw per prop family) ---------------- */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

function InstancedBoxes({
  items,
  size,
  color,
  emissive,
  emissiveIntensity = 1,
}: {
  items: BoxItem[];
  size: [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      _e.set(0, it.ry, 0);
      _q.setFromEuler(_e);
      _p.set(it.pos[0], it.pos[1], it.pos[2]);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
        flatShading
      />
    </instancedMesh>
  );
}

/* ---------------- gate diamonds (the only animated props) ---------------- */

function GateDiamonds() {
  const g = useRef<Group>(null);
  useFrame((state) => {
    const grp = g.current;
    if (!grp) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < grp.children.length; i++) {
      const m = grp.children[i];
      m.rotation.y = t * 1.4 + i * 0.9;
      m.position.y = gateFrames[i].y + 4.6 + Math.sin(t * 2 + i * 0.7) * 0.25;
    }
  });
  return (
    <group ref={g}>
      {gateFrames.map((f, i) => (
        <mesh key={i} position={[f.x, f.y + 4.6, f.z]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[1.15, 1.15, 1.15]} />
          <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={2.2} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- start / finish gantries ---------------- */

function Gantry({ frame, finish = false }: { frame: Frame; finish?: boolean }) {
  return (
    <group position={[frame.x, frame.y, frame.z]} rotation={[0, frame.ry, 0]}>
      {[-11.5, 11.5].map((px) => (
        <mesh key={px} position={[px, 6.2, 0]} castShadow>
          <boxGeometry args={[2.4, 13, 2.4]} />
          <meshStandardMaterial color={C.rust} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 12.6, 0]} castShadow>
        <boxGeometry args={[26, 1.6, 2.6]} />
        <meshStandardMaterial color={finish ? C.teal : C.rustDeep} flatShading />
      </mesh>
      <mesh position={[0, 11.4, 1.36]}>
        <boxGeometry args={[20, 0.55, 0.14]} />
        <meshStandardMaterial
          color={finish ? C.tealBright : C.amber}
          emissive={finish ? C.tealBright : C.amber}
          emissiveIntensity={1.6}
        />
      </mesh>
      {/* timing boards on the outer legs */}
      {[-13, 13].map((px) => (
        <group key={px} position={[px, 8, 1.3]}>
          <mesh>
            <boxGeometry args={[1.8, 6.5, 0.25]} />
            <meshStandardMaterial color={C.bone} flatShading />
          </mesh>
          {[2.2, 0.6, -1.0].map((py) => (
            <mesh key={py} position={[0, py, 0.2]}>
              <boxGeometry args={[1.3, 0.4, 0.06]} />
              <meshStandardMaterial color={C.amberHot} emissive={C.amberHot} emissiveIntensity={1.4} />
            </mesh>
          ))}
        </group>
      ))}
      {/* finish: checker strip of alternating lit/bone chips */}
      {finish &&
        Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[-8.8 + i * 1.6, 13.6, 0]}>
            <boxGeometry args={[1.5, 0.6, 0.2]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? C.amber : C.bone}
              emissive={i % 2 === 0 ? C.amber : '#000000'}
              emissiveIntensity={i % 2 === 0 ? 1.6 : 0}
            />
          </mesh>
        ))}
      <pointLight position={[0, 13, 2]} color={C.amber} intensity={36} distance={44} decay={2} />
    </group>
  );
}

/* ---------------- marshal's post (timing hut by the start) ---------------- */

function MarshalPost() {
  const [x, z] = marshallPos;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, startFrame.ry - 0.3, 0]}>
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[5.2, 3.6, 4.2]} />
        <meshStandardMaterial color={C.rustDeep} flatShading />
      </mesh>
      <mesh position={[0, 3.9, 0]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[6, 0.5, 5]} />
        <meshStandardMaterial color={C.bone} flatShading />
      </mesh>
      {/* window glow — the marshal works late */}
      <mesh position={[0, 1.9, 2.14]}>
        <boxGeometry args={[2.6, 1, 0.08]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.5} />
      </mesh>
      {/* signal mast */}
      <mesh position={[-3.4, 4.5, -1.4]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, 9, 5]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      <mesh position={[-3.4, 8.9, -1.4]}>
        <sphereGeometry args={[0.45, 8, 6]} />
        <meshStandardMaterial color={C.amberHot} emissive={C.amberHot} emissiveIntensity={2.4} flatShading />
      </mesh>
      {/* crates of betting salt out front */}
      {[[4, 0.8, 3.1, 0.5], [5.6, 0.65, 2.2, 1.1], [4.4, 1.9, 2.8, 0.9]].map(([px, py, pz, ry], i) => (
        <mesh key={i} position={[px, py, pz]} rotation={[0, ry, 0]} castShadow>
          <boxGeometry args={[1.5, 1.3, 1.4]} />
          <meshStandardMaterial color={i % 2 ? C.teal : C.rust} flatShading />
        </mesh>
      ))}
      <pointLight position={[0, 3.4, 3]} color={C.amber} intensity={9} distance={16} decay={2} />
    </group>
  );
}

/* ---------------- spectator ledge (mid-course rim, face gate 5) ---------------- */

function SpectatorLedge() {
  const [x, z] = ledgePos;
  const y = terrainHeight(x, z);
  const ry = frameAlong(GATE_D[4]).ry;
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      {/* windbreak wall facing away from the course */}
      <mesh position={[0, 1.2, -3.2]} castShadow>
        <boxGeometry args={[9, 2.4, 0.8]} />
        <meshStandardMaterial color={C.bone} flatShading />
      </mesh>
      {/* parked hover-bikes */}
      {[[-3.4, 0, 0.6, 0.35, C.rust], [-0.6, 0, 1.1, -0.2, C.teal]].map(([px, py, pz, br, col], i) => (
        <group key={i} position={[px as number, py as number, pz as number]} rotation={[0, br as number, 0]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[2.8, 0.7, 1]} />
            <meshStandardMaterial color={col as string} flatShading />
          </mesh>
          <mesh position={[0.9, 1.2, 0]}>
            <boxGeometry args={[0.9, 0.28, 0.6]} />
            <meshStandardMaterial color={C.rustDeep} flatShading />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[2.2, 0.1, 0.7]} />
            <meshStandardMaterial color={C.tealBright} emissive={C.tealBright} emissiveIntensity={1.6} />
          </mesh>
        </group>
      ))}
      {/* string lights on stubby posts */}
      {[3.4, 4.6, 5.8].map((px, i) => (
        <group key={i} position={[px, 0, 1.2]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.11, 3, 4]} />
            <meshStandardMaterial color={C.rustDeep} flatShading />
          </mesh>
          <mesh position={[0, 2.9, 0]}>
            <sphereGeometry args={[0.22, 6, 5]} />
            <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={2.2} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------- the region ---------------- */

function Props() {
  return (
    <group>
      <Gantry frame={startFrame} />
      <Gantry frame={finishFrame} finish />
      <MarshalPost />
      <SpectatorLedge />
      <InstancedBoxes items={pylons} size={[1.6, PYLON_H, 1.6]} color={C.rust} />
      <InstancedBoxes items={caps} size={[1.9, 0.5, 1.9]} color={C.amber} emissive={C.amber} emissiveIntensity={1.5} />
      <InstancedBoxes items={crossbars} size={[GATE_HALF * 2 + 2, 0.8, 1.1]} color={C.rustDeep} />
      <InstancedBoxes items={strips} size={[GATE_HALF * 2 - 1, 0.45, 0.12]} color={C.amber} emissive={C.amber} emissiveIntensity={1.6} />
      <InstancedBoxes items={chevrons} size={[2.4, 1.1, 0.16]} color={C.amberHot} emissive={C.amberHot} emissiveIntensity={1.3} />
      <GateDiamonds />
    </group>
  );
}

const region: RegionModule = { meta: regionMeta, anchors, Props, propsCull: 1.2, colliders };
export default region;

/**
 * SALTMOUTH — hub town. Low-poly primitives, flat shading, palette from DESIGN.md.
 * All structures are positioned on the terrain via the `G` helper.
 */
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = {
  wall: '#E4D7BE',
  wallShade: '#CBB896',
  roof: '#B3502E',
  roofDark: '#7E3320',
  pole: '#5C4632',
  teal: '#2E8C8C',
  amber: '#FFB454',
  salt: '#F3EEE2',
  ochre: '#B07C3A',
};

/** Group positioned on the terrain surface. */
function G({ at, ry = 0, children }: { at: [number, number]; ry?: number; children?: React.ReactNode }) {
  const y = terrainHeight(at[0], at[1]);
  return (
    <group position={[at[0], y, at[1]]} rotation={[0, ry, 0]}>
      {children}
    </group>
  );
}

function Hut({ at, ry, w = 7, d = 6, h = 3.4 }: { at: [number, number]; ry: number; w?: number; d?: number; h?: number }) {
  return (
    <G at={at} ry={ry}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={C.wall} flatShading />
      </mesh>
      <mesh position={[0, h + 0.9, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.78, 2, 4]} />
        <meshStandardMaterial color={C.roofDark} flatShading />
      </mesh>
      <mesh position={[0, h * 0.55, d / 2 + 0.05]}>
        <boxGeometry args={[1.6, h * 0.7, 0.1]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
    </G>
  );
}

function Lamp({ at }: { at: [number, number] }) {
  return (
    <G at={at}>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 5.2, 5]} />
        <meshStandardMaterial color={C.pole} flatShading />
      </mesh>
      <mesh position={[0, 5.3, 0]}>
        <sphereGeometry args={[0.35, 8, 6]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[0, 5.4, 0]} color={C.amber} intensity={6} distance={16} decay={2} />
    </G>
  );
}

function JobBoard() {
  const [x, z] = anchors['job-board'].pos;
  return (
    <G at={[x, z]} ry={0.5}>
      {/* posts */}
      {[-2.4, 2.4].map((px) => (
        <mesh key={px} position={[px, 1.9, 0]} castShadow>
          <boxGeometry args={[0.35, 3.8, 0.35]} />
          <meshStandardMaterial color={C.pole} flatShading />
        </mesh>
      ))}
      {/* board */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[5.6, 2.6, 0.25]} />
        <meshStandardMaterial color={C.roofDark} flatShading />
      </mesh>
      {/* glowing job slots */}
      {[-1.8, -0.6, 0.6, 1.8].map((px, i) => (
        <mesh key={i} position={[px, 2.75, 0.16]}>
          <planeGeometry args={[0.9, 1.6]} />
          <meshStandardMaterial color={i % 2 ? '#57C4B8' : C.amber} emissive={i % 2 ? '#57C4B8' : C.amber} emissiveIntensity={1.1} />
        </mesh>
      ))}
      {/* roof */}
      <mesh position={[0, 4.1, 0.2]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[6.4, 0.18, 1.6]} />
        <meshStandardMaterial color={C.roof} flatShading />
      </mesh>
      <pointLight position={[0, 3.2, 1.4]} color={C.amber} intensity={5} distance={10} decay={2} />
    </G>
  );
}

function Garage() {
  const [x, z] = anchors.garage.pos;
  return (
    <G at={[x, z]} ry={2.2}>
      {/* open shed: 4 posts + roof */}
      {[[-5, -4], [5, -4], [-5, 4], [5, 4]].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px, 2.4, pz]} castShadow>
          <boxGeometry args={[0.45, 4.8, 0.45]} />
          <meshStandardMaterial color={C.roof} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 5.1, 0]} castShadow>
        <boxGeometry args={[12.4, 0.35, 10.4]} />
        <meshStandardMaterial color={C.roofDark} flatShading />
      </mesh>
      {/* back wall with teal doors */}
      <mesh position={[0, 2.4, -4.8]} castShadow>
        <boxGeometry args={[12.4, 4.8, 0.4]} />
        <meshStandardMaterial color={C.wallShade} flatShading />
      </mesh>
      <mesh position={[-2, 1.7, -4.5]}>
        <boxGeometry args={[3.2, 3.4, 0.2]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      {/* crates + hoist */}
      {[[3.4, 1.2, 0.9], [2.4, 2.4, 0.7], [4.2, 3.1, 1.1]].map(([px, pz, s], i) => (
        <mesh key={i} position={[px, s / 2, pz - 1]} castShadow>
          <boxGeometry args={[s, s, s]} />
          <meshStandardMaterial color={i % 2 ? C.ochre : C.wallShade} flatShading />
        </mesh>
      ))}
      <mesh position={[4.5, 6.3, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 13, 5]} />
        <meshStandardMaterial color={C.pole} flatShading />
      </mesh>
      <mesh position={[4.5, 12.3, 0]}>
        <boxGeometry args={[2.6, 1.2, 0.3]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.3} />
      </mesh>
      <pointLight position={[0, 4.2, 0]} color={'#FFDCAE'} intensity={7} distance={14} decay={2} />
    </G>
  );
}

function Exchange() {
  const [x, z] = anchors.exchange.pos;
  return (
    <G at={[x, z]} ry={-0.12}>
      <mesh position={[0, 3, 0]} castShadow>
        <boxGeometry args={[16, 6, 9]} />
        <meshStandardMaterial color={C.wall} flatShading />
      </mesh>
      {[-6, -2, 2, 6].map((px) => (
        <mesh key={px} position={[px, 3.4, 5]} castShadow>
          <cylinderGeometry args={[0.35, 0.45, 6.8, 6]} />
          <meshStandardMaterial color={C.ochre} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 6.6, 2]} rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[17.2, 0.3, 8]} />
        <meshStandardMaterial color={C.roof} flatShading />
      </mesh>
      {/* guild banner */}
      <mesh position={[0, 4.6, 4.62]}>
        <planeGeometry args={[7, 1.6]} />
        <meshStandardMaterial color={C.ochre} emissive={C.ochre} emissiveIntensity={0.25} />
      </mesh>
    </G>
  );
}

function WaterTower() {
  const [x, z] = anchors['water-tower'].pos;
  return (
    <G at={[x, z]}>
      {[[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px * 0.7, 4.5, pz * 0.7]} rotation={[pz * 0.045, 0, -px * 0.045]} castShadow>
          <cylinderGeometry args={[0.22, 0.3, 9, 5]} />
          <meshStandardMaterial color={C.pole} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 10.2, 0]} castShadow>
        <cylinderGeometry args={[3.4, 3.4, 3.6, 10]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      <mesh position={[0, 12.6, 0]} castShadow>
        <coneGeometry args={[3.7, 1.6, 10]} />
        <meshStandardMaterial color={C.roof} flatShading />
      </mesh>
    </G>
  );
}

function MoorageMast() {
  const [x, z] = anchors.moorage.pos;
  return (
    <G at={[x, z]}>
      <mesh position={[0, 9, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.9, 18, 6]} />
        <meshStandardMaterial color={C.pole} flatShading />
      </mesh>
      <mesh position={[0, 17.6, 0]} castShadow>
        <boxGeometry args={[10, 0.7, 0.7]} />
        <meshStandardMaterial color={C.roof} flatShading />
      </mesh>
      {/* moored skyship hull */}
      <group position={[9, 14.5, 2]} rotation={[0, 0.35, 0.04]}>
        <mesh castShadow>
          <capsuleGeometry args={[2.1, 9, 4, 8]} />
          <meshStandardMaterial color={C.wallShade} flatShading />
        </mesh>
        <mesh position={[0, -1.9, 0]} castShadow>
          <boxGeometry args={[3.2, 1.6, 6]} />
          <meshStandardMaterial color={C.teal} flatShading />
        </mesh>
        <mesh position={[0, 0, 5.6]} castShadow>
          <boxGeometry args={[5.4, 0.5, 2]} />
          <meshStandardMaterial color={C.roofDark} flatShading />
        </mesh>
      </group>
      {/* tether */}
      <mesh position={[4.6, 16, 1]} rotation={[0, 0, 1.08]}>
        <cylinderGeometry args={[0.05, 0.05, 8, 4]} />
        <meshStandardMaterial color={C.pole} />
      </mesh>
    </G>
  );
}

function Props() {
  const huts: { at: [number, number]; ry: number; w?: number; d?: number }[] = [
    { at: [-34, 300], ry: 0.9 },
    { at: [-58, 276], ry: 0.5, w: 5.6, d: 5 },
    { at: [-20, 262], ry: -0.35 },
    { at: [28, 274], ry: 0.2, w: 8, d: 7 },
    { at: [58, 288], ry: -0.55 },
    { at: [76, 316], ry: 0.85, w: 5, d: 5 },
    { at: [-6, 330], ry: 2.6 },
    { at: [-44, 334], ry: 1.9, w: 6, d: 8 },
    { at: [22, 344], ry: -2.9 },
    { at: [6, 372], ry: 3.1, w: 5.4, d: 5 },
    { at: [-70, 310], ry: 1.2, w: 5, d: 4.6 },
  ];
  const saltPiles: [number, number][] = [[-96, 380], [-70, 420], [-120, 350], [100, 400]];
  const crates: [number, number][] = [[-8, 300], [-20, 286], [2, 300], [48, 306]];
  return (
    <group>
      {huts.map((h, i) => <Hut key={i} {...h} />)}
      <JobBoard />
      <Garage />
      <Exchange />
      <WaterTower />
      <MoorageMast />
      {saltPiles.map((p, i) => (
        <G key={`sp${i}`} at={p}>
          <mesh position={[0, 2.2, 0]} castShadow>
            <coneGeometry args={[4.5, 4.4, 7]} />
            <meshStandardMaterial color={C.salt} flatShading />
          </mesh>
        </G>
      ))}
      {crates.map((p, i) => (
        <G key={`c${i}`} at={p}>
          <mesh position={[0, 0.55, 0]} rotation={[0, i * 0.7, 0]} castShadow>
            <boxGeometry args={[1.1, 1.1, 1.1]} />
            <meshStandardMaterial color={i % 2 ? C.ochre : C.wallShade} flatShading />
          </mesh>
        </G>
      ))}
      <Lamp at={[-2, 300]} />
      <Lamp at={[30, 302]} />
      <Lamp at={[-38, 268]} />
      <Lamp at={[64, 276]} />
    </group>
  );
}

const region: RegionModule = {
  meta,
  anchors,
  Props,
  propsCull: 2.2,
  colliders: [
    { pos: [-34, 300], size: [7, 4, 6], rotY: 0.9 },
    { pos: [-58, 276], size: [5.6, 4, 5], rotY: 0.5 },
    { pos: [-20, 262], size: [7, 4, 6], rotY: -0.35 },
    { pos: [28, 274], size: [8, 4, 7], rotY: 0.2 },
    { pos: [58, 288], size: [7, 4, 6], rotY: -0.55 },
    { pos: [76, 316], size: [5, 4, 5], rotY: 0.85 },
    { pos: [-6, 330], size: [7, 4, 6], rotY: 2.6 },
    { pos: [-44, 334], size: [6, 4, 8], rotY: 1.9 },
    { pos: [22, 344], size: [7, 4, 6], rotY: -2.9 },
    { pos: [6, 372], size: [5.4, 4, 5] },
    { pos: [-70, 310], size: [5, 4, 4.6], rotY: 1.2 },
    { pos: [6, 258], size: [16, 6.5, 9], rotY: -0.12 },   // exchange
    { pos: [44, 318], size: [12.4, 1.5, 0.6], rotY: 2.2 }, // garage back wall only — ride in!
    { pos: [-52, 246], size: [4, 9, 4] },                 // water tower legs footprint
    { pos: [86, 262], size: [2, 18, 2] },                 // moorage mast
    { pos: [-14, 292], size: [5.6, 3, 0.5], rotY: 0.5 },  // job board face
  ],
};

export default region;

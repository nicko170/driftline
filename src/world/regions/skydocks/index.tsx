/** SKYDOCKS — mesa-top moorage. Masts, a big skyship hull, and the cargo winch. */
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = { bone: '#E4D7BE', rust: '#B3502E', teal: '#2E8C8C', amber: '#FFB454', pole: '#5C4632', ochre: '#B07C3A' };

function Mast({ at, h = 22 }: { at: [number, number]; h?: number }) {
  const y = terrainHeight(at[0], at[1]);
  return (
    <group position={[at[0], y, at[1]]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.8, h, 6]} />
        <meshStandardMaterial color={C.pole} flatShading />
      </mesh>
      <mesh position={[0, h - 0.5, 0]} castShadow>
        <boxGeometry args={[8, 0.6, 0.6]} />
        <meshStandardMaterial color={C.rust} flatShading />
      </mesh>
    </group>
  );
}

function Skyship({ at, elev = 30, ry = 0.3, s = 1 }: { at: [number, number]; elev?: number; ry?: number; s?: number }) {
  return (
    <group position={[at[0], elev, at[1]]} rotation={[0, ry, 0]} scale={s}>
      <mesh castShadow>
        <capsuleGeometry args={[3, 14, 4, 8]} />
        <meshStandardMaterial color={C.bone} flatShading />
      </mesh>
      <mesh position={[0, -3, 0]} castShadow>
        <boxGeometry args={[4.4, 2.4, 9]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      <mesh position={[0, 0, 8.5]} castShadow>
        <boxGeometry args={[8, 0.6, 3]} />
        <meshStandardMaterial color={C.rust} flatShading />
      </mesh>
      <mesh position={[0, 2.2, -7]}>
        <boxGeometry args={[0.3, 3.4, 2.4]} />
        <meshStandardMaterial color={C.ochre} flatShading />
      </mesh>
    </group>
  );
}

function Props() {
  const [mx, mz] = anchors['mesa-top'].pos;
  const my = (anchors['mesa-top'].elev ?? 40) - 3;
  return (
    <group>
      <Mast at={[mx - 30, mz + 20]} />
      <Mast at={[mx + 26, mz - 14]} h={26} />
      <Mast at={[mx + 8, mz + 42]} h={19} />
      <Skyship at={[mx - 42, mz + 26]} elev={my + 22} ry={0.5} />
      <Skyship at={[mx + 40, mz - 26]} elev={my + 26} ry={-0.9} s={0.8} />
      {/* dockmaster hut */}
      <group position={[anchors.dockmaster.pos[0], my + 3, anchors.dockmaster.pos[1]]} rotation={[0, 0.8, 0]}>
        <mesh position={[0, 1.8, 0]} castShadow>
          <boxGeometry args={[6, 3.6, 5]} />
          <meshStandardMaterial color={C.bone} flatShading />
        </mesh>
        <mesh position={[0, 4.3, 0]} castShadow>
          <coneGeometry args={[4.6, 1.8, 4]} />
          <meshStandardMaterial color={C.ochre} flatShading />
        </mesh>
        <mesh position={[0, 2.4, 2.6]}>
          <boxGeometry args={[2, 1.4, 0.1]} />
          <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.4} />
        </mesh>
      </group>
    </group>
  );
}

const region: RegionModule = {
  meta,
  anchors,
  Props,
  propsCull: 2.2,
  colliders: [
    { pos: [-780, -380], size: [8, 40, 8], elev: 20 }, // central mast footing
    { pos: [-750, -350], size: [6, 4, 5], elev: 37, rotY: 0.8 },
  ],
};
export default region;

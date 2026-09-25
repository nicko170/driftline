/** MOTHER'S GATE — the sealed cradle. A vast teal door set in the glass hills. */
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = { teal: '#2E8C8C', tealBright: '#57C4B8', bone: '#E4D7BE', space: '#221D33' };

function Props() {
  const [x, z] = anchors['the-door'].pos;
  const y = terrainHeight(x, z);
  return (
    <group>
      <group position={[x, y, z]} rotation={[0, 0.6, 0]}>
        {/* monolith door */}
        <mesh position={[0, 16, 0]} castShadow>
          <boxGeometry args={[22, 36, 4]} />
          <meshStandardMaterial color={C.space} flatShading />
        </mesh>
        <mesh position={[0, 16, 2.1]}>
          <boxGeometry args={[16, 30, 0.3]} />
          <meshStandardMaterial color={C.teal} emissive={C.teal} emissiveIntensity={0.55} />
        </mesh>
        {/* seam */}
        <mesh position={[0, 16, 2.3]}>
          <boxGeometry args={[0.5, 30, 0.2]} />
          <meshStandardMaterial color={C.tealBright} emissive={C.tealBright} emissiveIntensity={2.4} />
        </mesh>
        {/* lintel ring */}
        <mesh position={[0, 36.5, 0]}>
          <torusGeometry args={[6, 0.8, 6, 24]} />
          <meshStandardMaterial color={C.bone} flatShading />
        </mesh>
        <pointLight position={[0, 18, 8]} color={C.tealBright} intensity={12} distance={60} decay={2} />
      </group>
      {/* approach steles */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[x - 40 - i * 22, terrainHeight(x - 40 - i * 22, z - 30 - i * 14) + 3.5, z - 30 - i * 14]} rotation={[0, i * 0.4, 0.08]} castShadow>
          <boxGeometry args={[2.4, 8 + i, 1.6]} />
          <meshStandardMaterial color={C.teal} flatShading />
        </mesh>
      ))}
    </group>
  );
}

const region: RegionModule = {
  meta,
  anchors,
  Props,
  propsCull: 2.4,
  colliders: [{ pos: [980, 880], size: [24, 36, 5], rotY: 0.6 }],
};
export default region;

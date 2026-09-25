/** DROWNED ARRAY — solar panels tilting out of the salt pan, a half-sunk substation. */
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import { mulberry32 } from '../../../lib/noise';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = { panel: '#22314A', frame: '#6B7280', bone: '#E4D7BE', tealBright: '#57C4B8', rust: '#B3502E' };

function Props() {
  const rand = mulberry32(9001);
  const [cx, cz] = meta.center;
  const panels: { at: [number, number]; tilt: number; ry: number; sink: number }[] = [];
  for (let gx = -5; gx <= 5; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (rand() < 0.22) continue;
      const x = cx + gx * 26 + (rand() - 0.5) * 8;
      const z = cz + gz * 30 + (rand() - 0.5) * 8;
      panels.push({ at: [x, z], tilt: 0.5 + rand() * 0.7, ry: (rand() - 0.5) * 0.6, sink: rand() * 1.6 });
    }
  }
  const [sx, sz] = anchors.substation.pos;
  return (
    <group>
      {panels.map((p, i) => {
        const y = terrainHeight(p.at[0], p.at[1]) - p.sink;
        return (
          <mesh key={i} position={[p.at[0], y + 1.6, p.at[1]]} rotation={[-p.tilt, p.ry, 0]} castShadow>
            <boxGeometry args={[9, 0.25, 6]} />
            <meshStandardMaterial color={C.panel} metalness={0.5} roughness={0.55} flatShading />
          </mesh>
        );
      })}
      {/* half-sunk substation */}
      <group position={[sx, terrainHeight(sx, sz) - 1.2, sz]} rotation={[0.06, 0.7, -0.04]}>
        <mesh position={[0, 2, 0]} castShadow>
          <boxGeometry args={[12, 5, 7]} />
          <meshStandardMaterial color={C.rust} flatShading />
        </mesh>
        <mesh position={[3, 5.4, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.9, 3, 6]} />
          <meshStandardMaterial color={C.frame} flatShading />
        </mesh>
        <mesh position={[-3, 5.1, 1.4]}>
          <boxGeometry args={[1.4, 1, 0.2]} />
          <meshStandardMaterial color={C.tealBright} emissive={C.tealBright} emissiveIntensity={1.4} />
        </mesh>
      </group>
    </group>
  );
}

const region: RegionModule = {
  meta,
  anchors,
  Props,
  propsCull: 1.7,
  colliders: [{ pos: [-140, -940], size: [12, 5, 7], rotY: 0.7 }],
};
export default region;

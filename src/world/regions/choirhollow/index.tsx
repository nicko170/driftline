/** CHOIR HOLLOW — crater temple, teal lamp ring, the great listening horn. */
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = { bone: '#E4D7BE', teal: '#2E8C8C', tealBright: '#57C4B8', pole: '#5C4632' };

function Temple() {
  const [x, z] = anchors['temple-steps'].pos;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {[7, 5.6, 4.2].map((s, i) => (
        <mesh key={i} position={[0, 0.6 + i * 1.1, 0]} castShadow>
          <cylinderGeometry args={[s, s + 0.4, 1.1, 8]} />
          <meshStandardMaterial color={C.bone} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 5.2, 0]} castShadow>
        <coneGeometry args={[2.4, 4.4, 6]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      <mesh position={[0, 7.8, 0]}>
        <sphereGeometry args={[0.7, 10, 8]} />
        <meshStandardMaterial color={C.tealBright} emissive={C.tealBright} emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[0, 8, 0]} color={C.tealBright} intensity={9} distance={26} decay={2} />
    </group>
  );
}

function Horn() {
  const [x, z] = anchors['listening-horn'].pos;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, -0.9, 0]}>
      <mesh position={[0, 4, 0]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 8, 5]} />
        <meshStandardMaterial color={C.pole} flatShading />
      </mesh>
      <mesh position={[0, 7.6, -2]} rotation={[1.05, 0, 0]} castShadow>
        <coneGeometry args={[3.4, 4.5, 10, 1, true]} />
        <meshStandardMaterial color={C.teal} flatShading side={2} />
      </mesh>
    </group>
  );
}

function Props() {
  // lamp ring around the crater
  const [cx, cz] = meta.center;
  const lamps: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    lamps.push([cx + Math.cos(a) * 205, cz + Math.sin(a) * 205]);
  }
  return (
    <group>
      <Temple />
      <Horn />
      {lamps.map((at, i) => (
        <group key={i} position={[at[0], terrainHeight(at[0], at[1]), at[1]]}>
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.18, 4.4, 5]} />
            <meshStandardMaterial color={C.pole} flatShading />
          </mesh>
          <mesh position={[0, 4.6, 0]}>
            <sphereGeometry args={[0.34, 8, 6]} />
            <meshStandardMaterial color={C.tealBright} emissive={C.tealBright} emissiveIntensity={1.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const region: RegionModule = {
  meta,
  anchors,
  Props,
  propsCull: 2.2,
  colliders: [{ pos: [480, 620], size: [10, 6, 10] }],
};
export default region;

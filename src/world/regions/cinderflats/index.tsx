/** CINDERFLATS — Reclaimer yards: scrap towers, the crusher, sorted piles. */
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import { mulberry32 } from '../../../lib/noise';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = { rust: '#B3502E', rustDeep: '#7E3320', grey: '#8A8578', teal: '#2E8C8C', bone: '#E4D7BE', amber: '#FFB454' };

function Pile({ at, s = 1, color = C.grey }: { at: [number, number]; s?: number; color?: string }) {
  const y = terrainHeight(at[0], at[1]);
  return (
    <group position={[at[0], y, at[1]]}>
      <mesh position={[0, 2.2 * s, 0]} castShadow>
        <coneGeometry args={[4 * s, 4.4 * s, 6]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[2 * s, 0.8 * s, 1.4 * s]} castShadow>
        <boxGeometry args={[2.4 * s, 1.6 * s, 1.8 * s]} />
        <meshStandardMaterial color={C.rustDeep} flatShading />
      </mesh>
    </group>
  );
}

function Crusher() {
  const [x, z] = anchors.crusher.pos;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 3, 0]} castShadow>
        <boxGeometry args={[10, 6, 8]} />
        <meshStandardMaterial color={C.rust} flatShading />
      </mesh>
      <mesh position={[0, 7.4, 0]} castShadow>
        <boxGeometry args={[6, 3, 5]} />
        <meshStandardMaterial color={C.rustDeep} flatShading />
      </mesh>
      <mesh position={[5.4, 4.5, 0]} rotation={[0, 0, -0.5]} castShadow>
        <boxGeometry args={[5, 1.2, 1.6]} />
        <meshStandardMaterial color={C.grey} flatShading />
      </mesh>
      <mesh position={[0, 9.4, 0]}>
        <boxGeometry args={[2.6, 0.9, 0.2]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function Props() {
  const rand = mulberry32(4242);
  const [cx, cz] = meta.center;
  const piles: { at: [number, number]; s: number; color: string }[] = [];
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = 40 + rand() * 180;
    piles.push({
      at: [cx + Math.cos(a) * d, cz + Math.sin(a) * d],
      s: 0.7 + rand() * 1.4,
      color: [C.grey, C.rustDeep, C.rust][i % 3],
    });
  }
  return (
    <group>
      {piles.map((p, i) => <Pile key={i} {...p} />)}
      <Crusher />
      {piles.slice(0, 5).map((p, i) => (
        <mesh key={`f${i}`} position={[p.at[0] + 8, terrainHeight(p.at[0] + 8, p.at[1]) + 2.6, p.at[1]]}>
          <cylinderGeometry args={[0.08, 0.12, 5.2, 4]} />
          <meshStandardMaterial color={C.bone} flatShading />
        </mesh>
      ))}
    </group>
  );
}

const region: RegionModule = {
  meta,
  anchors,
  Props,
  propsCull: 1.8,
  colliders: [
    { pos: [-580, 780], size: [10, 9, 8], rotY: 0.4 },
  ],
};
export default region;

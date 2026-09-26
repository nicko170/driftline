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

/** The big salvage gantry crane straddling the Crusher — the operator who
 *  names a Widow pile gets naming rights for life (yard-rules lore). */
function Crane() {
  const [cx, cz] = anchors.crusher.pos;
  const legZ = 26; // legs straddle the crusher along z
  const ya = terrainHeight(cx, cz - legZ);
  const yb = terrainHeight(cx, cz + legZ);
  const beamY = Math.max(ya, yb) + 24;
  return (
    <group>
      {/* legs (A-frames) */}
      {[cz - legZ, cz + legZ].map((z, i) => {
        const y = terrainHeight(cx, z);
        return (
          <group key={i} position={[cx, y, z]}>
            {[-1.6, 1.6].map((dx) => (
              <mesh key={dx} position={[dx, 12, 0]} rotation={[0, 0, dx > 0 ? -0.12 : 0.12]} castShadow>
                <boxGeometry args={[1.6, 24, 1.6]} />
                <meshStandardMaterial color={C.rustDeep} flatShading />
              </mesh>
            ))}
            <mesh position={[0, 20, 0]} castShadow>
              <boxGeometry args={[5, 1.2, 1.4]} />
              <meshStandardMaterial color={C.grey} flatShading />
            </mesh>
          </group>
        );
      })}
      {/* cross beam */}
      <mesh position={[cx, beamY, cz]} castShadow>
        <boxGeometry args={[3.2, 2.4, legZ * 2 + 8]} />
        <meshStandardMaterial color={C.rust} flatShading />
      </mesh>
      {/* operator cab hanging off the beam */}
      <mesh position={[cx + 2.6, beamY - 3.2, cz - 10]} castShadow>
        <boxGeometry args={[2.4, 2.6, 2.6]} />
        <meshStandardMaterial color={C.bone} flatShading />
      </mesh>
      <mesh position={[cx + 3.85, beamY - 3.2, cz - 10]}>
        <boxGeometry args={[0.08, 1.1, 1.8]} />
        <meshStandardMaterial color={C.teal} emissive={C.teal} emissiveIntensity={0.6} />
      </mesh>
      {/* trolley + cable + magnet block mid-span */}
      <mesh position={[cx, beamY - 1.8, cz]} castShadow>
        <boxGeometry args={[2.2, 1.4, 3]} />
        <meshStandardMaterial color={C.grey} flatShading />
      </mesh>
      <mesh position={[cx, beamY - 11, cz]}>
        <boxGeometry args={[0.14, 17, 0.14]} />
        <meshStandardMaterial color="#3A2E22" flatShading />
      </mesh>
      <mesh position={[cx, beamY - 20.4, cz]} castShadow>
        <cylinderGeometry args={[2.4, 2.4, 1.2, 8]} />
        <meshStandardMaterial color={C.rustDeep} flatShading />
      </mesh>
      {/* beacon */}
      <mesh position={[cx, beamY + 1.8, cz - legZ + 2]}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={2.2} />
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
      <Crane />
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
    // crane legs
    { pos: [-580, 754], size: [5, 24, 2] },
    { pos: [-580, 806], size: [5, 24, 2] },
  ],
};
export default region;

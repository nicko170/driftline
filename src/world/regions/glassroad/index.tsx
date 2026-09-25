/**
 * GLASSROAD — teal glass canyon. Gate arches at both mouths, fused-glass spires
 * along the rim, a small wayside shrine at mid-span. Slick floor handled by terrain grip.
 */
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import { distToPolyline, GLASSROAD_PATH } from '../../layout';
import { mulberry32 } from '../../../lib/noise';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = { teal: '#2E8C8C', tealBright: '#57C4B8', rust: '#B3502E', bone: '#E4D7BE', amber: '#FFB454' };

function Gate({ ref }: { ref: 'gate-south' | 'gate-north' }) {
  const [x, z] = anchors[ref].pos;
  const y = terrainHeight(x, z);
  // orient the arch across the road direction (approx along nearest path segment)
  let ry = 0;
  let best = Infinity;
  for (let i = 0; i < GLASSROAD_PATH.length - 1; i++) {
    const d = Math.hypot(x - GLASSROAD_PATH[i][0], z - GLASSROAD_PATH[i][1]);
    if (d < best) {
      best = d;
      ry = Math.atan2(GLASSROAD_PATH[i + 1][0] - GLASSROAD_PATH[i][0], GLASSROAD_PATH[i + 1][1] - GLASSROAD_PATH[i][1]);
    }
  }
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      {[-9, 9].map((px) => (
        <mesh key={px} position={[px, 7, 0]} castShadow>
          <boxGeometry args={[2.2, 14, 2.2]} />
          <meshStandardMaterial color={C.rust} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 14.6, 0]} castShadow>
        <boxGeometry args={[21, 1.6, 2.4]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      <mesh position={[0, 13.4, 1.25]}>
        <boxGeometry args={[10, 1.1, 0.1]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Shrine() {
  const [x, z] = anchors['mid-span'].pos;
  const y = terrainHeight(x, z);
  return (
    <group position={[x + 14, y, z]} >
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[3, 2.8, 3]} />
        <meshStandardMaterial color={C.bone} flatShading />
      </mesh>
      <mesh position={[0, 3.4, 0]} castShadow>
        <coneGeometry args={[2.4, 1.8, 4]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      <mesh position={[0, 2.2, 1.6]}>
        <sphereGeometry args={[0.4, 8, 6]} />
        <meshStandardMaterial color={C.tealBright} emissive={C.tealBright} emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 3, 2]} color={C.tealBright} intensity={5} distance={12} decay={2} />
    </group>
  );
}

function Props() {
  // fused glass spires along the canyon rim — deterministic scatter
  const rand = mulberry32(1337);
  const spires: { x: number; z: number; h: number; r: number; ry: number }[] = [];
  for (let i = 0; i < 260 && spires.length < 90; i++) {
    const t = rand();
    const seg = Math.floor(rand() * (GLASSROAD_PATH.length - 1));
    const [ax, az] = GLASSROAD_PATH[seg];
    const [bx, bz] = GLASSROAD_PATH[seg + 1];
    const x = ax + (bx - ax) * t + (rand() - 0.5) * 260;
    const z = az + (bz - az) * t + (rand() - 0.5) * 260;
    const d = distToPolyline(x, z, GLASSROAD_PATH);
    if (d < 55 || d > 170) continue; // only on the rims, never in the road
    spires.push({ x, z, h: 4 + rand() * 14, r: 0.8 + rand() * 2.2, ry: rand() * Math.PI });
  }
  return (
    <group>
      <Gate ref="gate-south" />
      <Gate ref="gate-north" />
      <Shrine />
      {spires.map((s, i) => (
        <mesh key={i} position={[s.x, terrainHeight(s.x, s.z) + s.h * 0.32, s.z]} rotation={[(i % 3) * 0.06, s.ry, (i % 5) * 0.05]} castShadow>
          <coneGeometry args={[s.r, s.h, 5]} />
          <meshStandardMaterial
            color={i % 4 === 0 ? C.tealBright : C.teal}
            emissive={C.teal}
            emissiveIntensity={0.18}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

const region: RegionModule = {
  meta,
  anchors,
  Props,
  propsCull: 1.6,
  colliders: [
    { pos: [150, 372], size: [2.2, 14, 2.2], rotY: 0 },
    { pos: [1002, -1002], size: [2.2, 14, 2.2], rotY: 0 },
  ],
};
export default region;

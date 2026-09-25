/** WINDSPINE — turbine ridge. Rotors spin lazily; towers follow the ridge line. */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { RegionModule, RegionMeta, Anchor } from '../../registry';
import { terrainHeight } from '../../../lib/terrain';
import { WINDSPINE_LINE } from '../../layout';
import metaJson from './meta.json';
import anchorsJson from './anchors.json';

const meta = metaJson as unknown as RegionMeta;
const anchors = anchorsJson as unknown as Record<string, Anchor>;

const C = { tower: '#E4D7BE', blade: '#F3EEE2', nacelle: '#B3502E', tent: '#B07C3A', teal: '#2E8C8C' };

function Turbine({ at, idx }: { at: [number, number]; idx: number }) {
  const rotor = useRef<Group>(null);
  const y = terrainHeight(at[0], at[1]);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z += dt * (0.7 + (idx % 4) * 0.22);
  });
  return (
    <group position={[at[0], y, at[1]]}>
      <mesh position={[0, 13, 0]} castShadow>
        <cylinderGeometry args={[0.55, 1.1, 26, 6]} />
        <meshStandardMaterial color={C.tower} flatShading />
      </mesh>
      <mesh position={[0, 26.4, 0.9]} castShadow>
        <boxGeometry args={[1.6, 1.6, 3.2]} />
        <meshStandardMaterial color={C.nacelle} flatShading />
      </mesh>
      <group ref={rotor} position={[0, 26.4, 2.7]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 11.5, 0.16]} />
            <meshStandardMaterial color={C.blade} flatShading />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.8, 8, 6]} />
          <meshStandardMaterial color={C.nacelle} flatShading />
        </mesh>
      </group>
    </group>
  );
}

function SurveyCamp() {
  const [x, z] = anchors['survey-camp'].pos;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {[[-4, 0, 0.4], [3, 3, -0.8], [4, -3, 1.9]].map(([px, pz, ry], i) => (
        <mesh key={i} position={[px, 1.5, pz]} rotation={[0, ry, 0]} castShadow>
          <coneGeometry args={[2.6, 3, 4]} />
          <meshStandardMaterial color={C.tent} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 4, 6]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 8, 4]} />
        <meshStandardMaterial color={C.teal} flatShading />
      </mesh>
      <mesh position={[0, 8.1, 6]}>
        <boxGeometry args={[1.6, 0.8, 0.14]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Props() {
  // turbines interleaved along the ridge line
  const spots: [number, number][] = [];
  for (let i = 0; i < WINDSPINE_LINE.length - 1; i++) {
    const [ax, az] = WINDSPINE_LINE[i];
    const [bx, bz] = WINDSPINE_LINE[i + 1];
    for (const t of [0.15, 0.55, 0.9]) {
      spots.push([ax + (bx - ax) * t + ((i * 37) % 23) - 11, az + (bz - az) * t + ((i * 53) % 29) - 14]);
    }
  }
  return (
    <group>
      {spots.map((at, i) => <Turbine key={i} at={at} idx={i} />)}
      <SurveyCamp />
    </group>
  );
}

const region: RegionModule = { meta, anchors, Props, propsCull: 1.9 };
export default region;

/**
 * AMBIENT STORM FRONT — the free-ride weather wall. Logic lives in
 * weather.ts (`tickWeather`), driven here once per frame; this component
 * also renders the wall: wide nested quarter-shells of sand haze, a churning
 * base disc and slow counter-rotation, all opacity-scaled by the front's
 * fade so it rolls in and dissolves instead of popping.
 *
 * Same visual language as MissionDirector's storm wall (the desert doesn't
 * have two kinds of weather), only wider and slower. Mounted outside the
 * Physics block in GameScreen.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { weather, tickWeather, clearWeather } from './weather';

const WALL_COLORS = ['#D9A45B', '#C98F4E', '#B97745', '#8A5335'];

export default function WeatherFront() {
  const group = useRef<THREE.Group>(null);
  const shells = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  // stale fronts/audio never survive leaving /play mid-storm
  useEffect(() => () => clearWeather(), []);

  useFrame((state, dt) => {
    tickWeather(Math.min(dt, 0.1));
    const f = weather.front;
    const g = group.current;
    if (!g) return;
    g.visible = !!f;
    if (!f) return;
    g.position.set(f.x, 0, f.z); // y sits low; tall shells span any terrain
    g.rotation.y = Math.atan2(f.vx, f.vz) + Math.PI; // open side trails behind travel
    const t = state.clock.elapsedTime;
    shells.current.forEach((s, i) => {
      if (s) s.rotation.y = Math.sin(t * (0.1 + i * 0.06)) * 0.16 + i * 0.22;
    });
    mats.current.forEach((m, i) => {
      if (m) m.opacity = (0.26 - i * 0.05) * f.fade;
    });
  });

  return (
    <group ref={group} visible={false}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(m) => { shells.current[i] = m; }}
          position={[0, 34 + i * 9, 0]}
          scale={[1 + i * 0.14, 1 + i * 0.08, 1 + i * 0.14]}
        >
          <cylinderGeometry args={[210, 210, 330 + i * 34, 40, 1, true, Math.PI * 0.42, Math.PI * 1.16]} />
          <meshBasicMaterial
            ref={(m) => { mats.current[i] = m; }}
            color={WALL_COLORS[i]}
            transparent
            opacity={0.26 - i * 0.05}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* churning base dust */}
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[208, 212, 16, 40, 1, true, Math.PI * 0.42, Math.PI * 1.16]} />
        <meshBasicMaterial
          ref={(m) => { mats.current[4] = m; }}
          color="#E8C07A"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

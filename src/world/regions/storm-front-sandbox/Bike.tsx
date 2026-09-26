/**
 * Storm Front Sandbox — the test bike.
 *
 * A deliberately *simple* arcade hover-bike (this bench is for tuning the
 * storm, not the bike — hover-playground owns that). Throttle/brake/steer,
 * Shift boost, Space hop; soft push-back at the pan rim. Poses are written to
 * the shared `bike` scratch so the storm director and HUD read them free.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clamp01, lerp } from '../../../lib/noise';
import { bike, lab, PAN_R, panHeight } from './state';

const keys = new Set<string>();

function isFormTarget() {
  const el = document.activeElement;
  const tag = el?.tagName ?? '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement)?.isContentEditable;
}

export function Bike() {
  const root = useRef<THREE.Group>(null!);
  const glowMat = useRef<THREE.MeshStandardMaterial>(null!);
  const shadowDisc = useRef<THREE.Mesh>(null!);
  const lean = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isFormTarget()) return;
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const spawnY = useMemo(() => panHeight(0, -60), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;

    const fwd = keys.has('w') || keys.has('arrowup') ? 1 : 0;
    const back = keys.has('s') || keys.has('arrowdown') ? 1 : 0;
    const steer = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    const boost = keys.has('shift');
    bike.boostHeld = boost;

    const top = lab.bikeTop * (boost ? 1.32 : 1);
    if (fwd) bike.speed = Math.min(top, bike.speed + 26 * dt);
    else if (back) bike.speed = Math.max(-9, bike.speed - 34 * dt);
    else bike.speed = lerp(bike.speed, 0, 1 - Math.exp(-dt * 0.55));

    // steering authority falls off at speed (arcade grip)
    const speedN = clamp01(Math.abs(bike.speed) / Math.max(lab.bikeTop, 1));
    bike.heading += steer * (1.35 - speedN * 0.55) * dt * Math.min(1, Math.abs(bike.speed) / 7);

    // soft rim: push back inside the pan
    const r = Math.hypot(bike.x, bike.z);
    if (r > PAN_R) bike.speed = lerp(bike.speed, 0, 1 - Math.exp(-dt * 1.2));

    bike.x += Math.sin(bike.heading) * bike.speed * dt;
    bike.z += Math.cos(bike.heading) * bike.speed * dt;

    // hop
    if (keys.has(' ') && bike.hopY <= 0.01 && bike.vy <= 0) bike.vy = 6.5;
    if (bike.vy !== 0 || bike.hopY > 0) {
      bike.vy -= 18 * dt;
      bike.hopY = Math.max(0, bike.hopY + bike.vy * dt);
      if (bike.hopY === 0) bike.vy = 0;
    }

    const bob = Math.sin(t * Math.PI * 4) * 0.05 + Math.sin(t * 13.7) * 0.015 * speedN;
    const ground = panHeight(bike.x, bike.z);
    bike.y = ground + 1.12 + bob + bike.hopY + (boost && fwd ? 0.18 : 0);

    // visuals
    lean.current = lerp(lean.current, steer * speedN * 0.24, 1 - Math.exp(-dt * 7));
    pitch.current = lerp(pitch.current, (fwd ? -0.05 : back ? 0.09 : 0) * clamp01(Math.abs(bike.speed) / 20), 1 - Math.exp(-dt * 5));
    root.current.position.set(bike.x, bike.y, bike.z);
    root.current.rotation.set(pitch.current, bike.heading, lean.current);
    if (glowMat.current) glowMat.current.emissiveIntensity = 0.9 + speedN * 0.9 + (boost && fwd ? 1.8 : 0);
    if (shadowDisc.current) {
      shadowDisc.current.position.set(bike.x, ground + 0.04, bike.z);
      (shadowDisc.current.material as THREE.MeshBasicMaterial).opacity = clamp01(0.26 - bike.hopY * 0.09 - bob * 0.5);
    }
  });

  return (
    <>
      <group ref={root} position={[0, spawnY + 1.12, -60]}>
        {/* hull */}
        <mesh castShadow>
          <boxGeometry args={[1.1, 0.55, 2.9]} />
          <meshStandardMaterial color="#B3502E" flatShading roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.16, 1.65]} rotation={[Math.PI / 4, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.34, 0.9]} />
          <meshStandardMaterial color="#D9A45B" flatShading roughness={0.9} />
        </mesh>
        {/* teal lift skirts */}
        {[-0.62, 0.62].map((o) => (
          <mesh key={o} position={[o, -0.18, 0]}>
            <boxGeometry args={[0.14, 0.16, 2.5]} />
            <meshStandardMaterial ref={o < 0 ? glowMat : undefined} color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1} flatShading />
          </mesh>
        ))}
        {/* rider */}
        <mesh position={[0, 0.52, -0.15]} castShadow>
          <sphereGeometry args={[0.34, 8, 6]} />
          <meshStandardMaterial color="#7E3320" flatShading />
        </mesh>
        <mesh position={[0, 0.78, 0.05]}>
          <sphereGeometry args={[0.2, 8, 6]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
        {/* boost tail flame */}
        <mesh position={[0, 0, -1.7]}>
          <coneGeometry args={[0.22, 0.9, 6]} />
          <meshBasicMaterial color="#FFB454" transparent opacity={0.85} />
        </mesh>
      </group>
      <mesh ref={shadowDisc} rotation={[-Math.PI / 2, 0, 0]} position={[0, spawnY + 0.04, -60]}>
        <circleGeometry args={[1.5, 16]} />
        <meshBasicMaterial color="#3A2A20" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </>
  );
}

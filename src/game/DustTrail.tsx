/**
 * Bike dust trail + heat shimmer points. One recycled buffer, zero per-frame
 * allocation. Colour shifts with the surface (salt white vs sand vs glass).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { telemetry } from '../telemetry';
import { surfaceAt, terrainHeight } from '../lib/terrain';

const COUNT = 140;

export default function DustTrail() {
  const points = useRef<THREE.Points>(null);

  const data = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const ages = new Float32Array(COUNT).fill(99);
    const vels = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 1] = -9999;
    }
    return { positions, ages, vels, next: 0 };
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    return g;
  }, [data]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color('#D9C6A2'),
        size: 0.9,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [],
  );

  const emitAcc = useRef(0);

  useFrame((_, dt) => {
    const d = data;
    const speed = telemetry.speed;

    // emit
    if (telemetry.grounded && speed > 6) {
      emitAcc.current += dt * Math.min(60, speed * 1.4);
      while (emitAcc.current > 1) {
        emitAcc.current -= 1;
        const i = d.next;
        d.next = (d.next + 1) % COUNT;
        // heading is a true bearing (0 = north = -z); forward = (sin h, 0, -cos h)
        // — emit just behind the bike
        const h = telemetry.heading;
        const jitterX = (Math.random() - 0.5) * 0.8;
        const jitterZ = (Math.random() - 0.5) * 0.8;
        d.positions[i * 3] = telemetry.x - Math.sin(h) * 1.4 + jitterX;
        d.positions[i * 3 + 1] = terrainHeight(telemetry.x, telemetry.z) + 0.3;
        d.positions[i * 3 + 2] = telemetry.z + Math.cos(h) * 1.4 + jitterZ;
        d.vels[i * 3] = (Math.random() - 0.5) * 1.4 - Math.sin(h) * speed * 0.12;
        d.vels[i * 3 + 1] = 0.8 + Math.random() * 1.2;
        d.vels[i * 3 + 2] = (Math.random() - 0.5) * 1.4 + Math.cos(h) * speed * 0.12;
        d.ages[i] = 0;
      }
    }

    // colour by surface under the bike
    const surf = surfaceAt(telemetry.x, telemetry.z);
    if (surf.kind === 'salt') material.color.set('#EFE8D4');
    else if (surf.kind === 'glass') material.color.set('#7FD4C9');
    else material.color.set('#D9B077');

    // age + advect
    for (let i = 0; i < COUNT; i++) {
      if (d.ages[i] > 2.4) continue;
      d.ages[i] += dt;
      d.positions[i * 3] += d.vels[i * 3] * dt;
      d.positions[i * 3 + 1] += d.vels[i * 3 + 1] * dt;
      d.positions[i * 3 + 2] += d.vels[i * 3 + 2] * dt;
      if (d.ages[i] > 2.4) d.positions[i * 3 + 1] = -9999;
    }
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

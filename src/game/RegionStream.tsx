/**
 * Streams region props by player distance (regions register global colliders so
 * you can bump into a hut from any distance — props visuals gate on proximity).
 * Region index.tsx modules lazy-load: on-world regions are preloaded at
 * GameScreen mount; anything approaching gets loaded with a 1.6× margin so
 * props are resident before they enter the visible gate.
 */
import { useMemo, useSyncExternalStore, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import {
  REGIONS,
  allColliders,
  getRegionVersion,
  isBenchRegion,
  loadRegion,
  subscribeRegions,
} from '../world/registry';
import { telemetry } from '../telemetry';

export function RegionColliders() {
  const version = useSyncExternalStore(subscribeRegions, getRegionVersion);
  const colliders = useMemo(() => allColliders(), [version]);
  return (
    <group>
      {colliders.map((c, i) => (
        <RigidBody key={`${c.region}-${i}`} type="fixed" colliders={false}>
          <CuboidCollider
            args={[c.size[0] / 2, c.size[1] / 2 + 3, c.size[2] / 2]}
            position={[c.pos[0], c.y, c.pos[1]]}
            rotation={[0, c.rotY ?? 0, 0]}
            restitution={0.25}
            friction={0.6}
          />
        </RigidBody>
      ))}
    </group>
  );
}

export default function RegionStream() {
  useSyncExternalStore(subscribeRegions, getRegionVersion);
  const [visible, setVisible] = useState<string[]>([]);
  const acc = useRef(0);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.5) return;
    acc.current = 0;
    const v: string[] = [];
    for (const region of REGIONS.values()) {
      const { center, radius } = region.meta;
      if (isBenchRegion(region.meta)) continue;
      const cull = region.propsCull ?? 2;
      const d2 = (center[0] - telemetry.x) ** 2 + (center[1] - telemetry.z) ** 2;
      const r = radius * cull;
      // preload with margin so Props is resident before it enters the gate
      if (region.Props === undefined && d2 < r * r * 2.56) void loadRegion(region.meta.slug);
      if (d2 < r * r) v.push(region.meta.slug);
    }
    setVisible((prev) => (prev.length === v.length && prev.every((s, i) => s === v[i]) ? prev : v));
  });

  return (
    <group>
      {visible.map((slug) => {
        const region = REGIONS.get(slug);
        if (!region?.Props) return null;
        const P = region.Props;
        return <P key={slug} />;
      })}
    </group>
  );
}

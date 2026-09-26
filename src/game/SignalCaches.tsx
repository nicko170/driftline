/**
 * Signal caches — rendered + collected here. Uncollected caches are weathered
 * tripods holding a floating lore-violet octahedron (⟡ the record/library
 * glyph colour — distinct from every mission marker), with a faint glimmer
 * beam visible at range. One useFrame drives bob/spin for all instances and
 * the pickup check; no per-frame allocations.
 *
 * Pickup: within CAPTURE_RADIUS, any speed — these are joy-of-discovery
 * pickups, not skill gates. On collect: codex unlock (via the `lore:` flag),
 * +BOUNTY_CREDITS, toast, chime. Collected state derives from save.codex so
 * caches persist across sessions with zero new save state.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { telemetry } from '../telemetry';
import { terrainHeight } from '../lib/terrain';
import { useGameStore, useSaveStore } from '../state/store';
import { loreEntries } from '../codex/library';
import { audio } from '../audio/audio';
import { BOUNTY_CREDITS, CAPTURE_RADIUS, HINT_RANGE, SIGNAL_CACHES, type SignalCache } from './caches';

const CACHE_VIOLET = '#9A86D0';
const loreTitle = new Map(loreEntries.map((e) => [e.slug, e.title]));

export default function SignalCaches() {
  const codex = useSaveStore((s) => s.codex);
  const live = useMemo(() => SIGNAL_CACHES.filter((c) => !codex.includes(c.lore)), [codex]);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    let nearest: { c: SignalCache; d: number } | null = null;

    for (let i = 0; i < live.length; i++) {
      const c = live[i];
      const g = groupRefs.current[i];
      if (g) {
        // gentle bob + spin (phase-offset per cache)
        g.rotation.y = t * 0.7 + i * 1.3;
        g.position.y = 1.9 + Math.sin(t * 1.7 + i * 2.1) * 0.22;
      }

      const dx = c.x - telemetry.x;
      const dz = c.z - telemetry.z;
      const d = Math.hypot(dx, dz);
      if (d < (nearest?.d ?? Infinity)) nearest = { c, d };

      if (d < CAPTURE_RADIUS && useGameStore.getState().mode === 'riding') {
        const save = useSaveStore.getState();
        if (save.codex.includes(c.lore)) continue; // raced a re-render — fine
        save.setFlags([`lore:${c.lore}`]);
        save.addCredits(BOUNTY_CREDITS);
        audio.chime();
        useGameStore.getState().queueToast({
          id: `cache-${c.id}`,
          icon: '⟡',
          title: 'Signal cache recovered',
          desc: `${loreTitle.get(c.lore) ?? 'Codex entry'} — filed to the codex. Guild archival bounty +${BOUNTY_CREDITS} cr.`,
        });
      }
    }

    // HUD hint / minimap feed: nearest uncollected cache if within hail
    if (nearest && nearest.d < HINT_RANGE) {
      telemetry.signal = { x: nearest.c.x, z: nearest.c.z, dist: nearest.d };
    } else {
      telemetry.signal = null;
    }
  });

  return (
    <group>
      {live.map((c, i) => (
        <group key={c.id} position={[c.x, terrainHeight(c.x, c.z), c.z]}>
          {/* ground ring */}
          <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.5, 2.1, 24]} />
            <meshBasicMaterial color={CACHE_VIOLET} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* weathered tripod */}
          {[0, 2.094, 4.189].map((a) => (
            <mesh key={a} position={[Math.cos(a) * 0.55, 0.7, Math.sin(a) * 0.55]} rotation={[Math.sin(a) * 0.3, 0, Math.cos(a) * -0.3]}>
              <cylinderGeometry args={[0.05, 0.08, 1.5, 5]} />
              <meshStandardMaterial color="#5C4632" flatShading />
            </mesh>
          ))}
          {/* floating core — bob + spin driven in the parent frame loop */}
          <group ref={(el) => { groupRefs.current[i] = el; }} position={[0, 1.9, 0]}>
            <mesh>
              <octahedronGeometry args={[0.55]} />
              <meshStandardMaterial color={CACHE_VIOLET} emissive={CACHE_VIOLET} emissiveIntensity={1.5} flatShading />
            </mesh>
            {/* faint vertical glimmer so caches read at range against the sky */}
            <mesh position={[0, 11, 0]}>
              <cylinderGeometry args={[0.14, 0.5, 22, 6, 1, true]} />
              <meshBasicMaterial color={CACHE_VIOLET} transparent opacity={0.13} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * MissionDirector — runs the active mission inside the canvas:
 * objective proximity checks, collect pickups, race gates, timers,
 * rewards and completion. Renders the waypoint beam + race gates + collectibles.
 */
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore, useSaveStore } from '../state/store';
import { missionsById, type Objective } from '../missions/library';
import { getAnchor } from '../world/registry';
import { telemetry, addShake } from '../telemetry';
import { audio } from '../audio/audio';
import { mulberry32 } from '../lib/noise';
import { terrainHeight } from '../lib/terrain';

const REACH = 8;          // objective capture radius
const SLOW = 16;          // must be slower than this to pick up / drop off

/* ---------------- runtime visuals ---------------- */

function WaypointBeam({ pos, color = '#FFB454' }: { pos: THREE.Vector3; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime;
      ref.current.rotation.y = t * 0.8;
      ref.current.position.y = pos.y + Math.sin(t * 2) * 0.3;
    }
  });
  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* ground ring */}
      <mesh position={[0, pos.y + 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[REACH * 0.7, REACH * 0.92, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* sky beam */}
      <mesh position={[0, pos.y + 30, 0]}>
        <cylinderGeometry args={[0.5, 1.6, 60, 10, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <group ref={ref} position={[pos.x * 0, pos.y, 0]}>
        <mesh position={[0, 4.2, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[1.3, 1.3, 1.3]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      </group>
    </group>
  );
}

function CollectItem({ pos }: { pos: { x: number; y: number; z: number } }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.03;
      ref.current.position.y = pos.y + 1.6 + Math.sin(state.clock.elapsedTime * 2.4 + pos.x) * 0.35;
    }
  });
  return (
    <mesh ref={ref} position={[pos.x, pos.y + 1.6, pos.z]}>
      <octahedronGeometry args={[0.8]} />
      <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={2} flatShading />
    </mesh>
  );
}

/* ---------------- the director ---------------- */

export default function MissionDirector() {
  const [collected, setCollected] = useState<{ x: number; y: number; z: number }[]>([]);
  const spawnKey = useRef('');
  const failFlashed = useRef<string | null>(null);

  useFrame((_, dt) => {
    const game = useGameStore.getState();
    const save = useSaveStore.getState();

    // fail banner reset
    if (game.missionFailed && failFlashed.current !== game.missionFailed) {
      failFlashed.current = game.missionFailed;
      audio.thud(0.5);
      addShake(0.3);
    } else if (!game.missionFailed) failFlashed.current = null;

    if (!game.activeMissionId) {
      if (spawnKey.current) {
        spawnKey.current = '';
        setCollected([]);
      }
      return;
    }
    const mission = missionsById.get(game.activeMissionId);
    if (!mission) {
      game.clearMission();
      return;
    }

    // timer
    if (game.timeLeft !== null) {
      game.tickTimer(dt);
      if (game.timeLeft !== null && game.timeLeft <= 0) {
        game.failMission(`${mission.title} — out of time. The client noticed.`);
        return;
      }
    }

    const obj: Objective | undefined = mission.objectives[game.objectiveIndex];
    if (!obj) return;

    // collect: spawn pickups around the anchor once per objective
    if (obj.type === 'collect') {
      const key = `${mission.id}:${game.objectiveIndex}`;
      if (spawnKey.current !== key) {
        spawnKey.current = key;
        const anchor = obj.target ? getAnchor(obj.target) : null;
        if (anchor) {
          const rand = mulberry32(mission.id.length * 977 + game.objectiveIndex);
          const items = [];
          const n = obj.count ?? 3;
          for (let i = 0; i < n; i++) {
            const a = rand() * Math.PI * 2;
            const d = 6 + rand() * 22;
            const x = anchor.x + Math.cos(a) * d;
            const z = anchor.z + Math.sin(a) * d;
            items.push({ x, y: terrainHeight(x, z), z });
          }
          setCollected(items);
        }
      }
      // pickup check
      const idx = collected.findIndex(
        (it) => (it.x - telemetry.x) ** 2 + (it.z - telemetry.z) ** 2 < 36,
      );
      if (idx >= 0) {
        const next = [...collected];
        next.splice(idx, 1);
        setCollected(next);
        game.setObjectiveCount(game.objectiveCount + 1);
        audio.chime();
        if (game.objectiveCount + 1 >= (obj.count ?? 3)) {
          advance(mission.id);
        }
      }
      return;
    }

    const ref = obj.type === 'race' ? obj.targets?.[game.objectiveCount] : obj.target;
    const anchor = ref ? getAnchor(ref) : null;
    if (!anchor) return;

    const d2 = (anchor.x - telemetry.x) ** 2 + (anchor.z - telemetry.z) ** 2;
    if (d2 > REACH * REACH) return;

    if (obj.type === 'race') {
      game.setObjectiveCount(game.objectiveCount + 1);
      audio.blip(980, 0.08);
      if (game.objectiveCount + 1 >= (obj.targets?.length ?? 0)) advance(mission.id);
      return;
    }

    const slowEnough = telemetry.speed < SLOW;
    if ((obj.type === 'pickup' || obj.type === 'dropoff' || obj.type === 'deliver' || obj.type === 'goto' || obj.type === 'scout') && slowEnough) {
      audio.chime();
      advance(mission.id);
    }
  });

  function advance(missionId: string) {
    const game = useGameStore.getState();
    const mission = missionsById.get(missionId);
    if (!mission) return;
    if (game.objectiveIndex + 1 < mission.objectives.length) {
      game.advanceObjective();
      const next = mission.objectives[game.objectiveIndex + 1];
      if (next?.label) game.say(mission.giver, next.label);
      return;
    }
    // complete!
    const save = useSaveStore.getState();
    save.completeMission(mission.id, mission.rewards);
    game.clearMission();
    spawnKey.current = '';
    setCollected([]);
    if (mission.dialogue.complete?.length) {
      const choices = mission.dialogue.choices?.[0];
      game.openDialogue(mission.dialogue.complete, choices);
    }
    audio.chime();
  }

  // active waypoint + collectibles
  const activeId = useGameStore((s) => s.activeMissionId);
  const objIndex = useGameStore((s) => s.objectiveIndex);
  const objCount = useGameStore((s) => s.objectiveCount);
  const mission = activeId ? missionsById.get(activeId) : null;
  const obj = mission?.objectives[objIndex];
  const refStr = obj?.type === 'race' ? obj.targets?.[objCount] : obj?.target;
  const anchor = refStr ? getAnchor(refStr) : null;

  return (
    <group>
      {anchor && <WaypointBeam pos={new THREE.Vector3(anchor.x, anchor.y, anchor.z)} />}
      {obj?.type === 'collect' && collected.map((it, i) => <CollectItem key={i} pos={it} />)}
      {obj?.type === 'race' &&
        obj.targets?.map((t, i) => {
          const a = getAnchor(t);
          if (!a) return null;
          return (
            <group key={t} position={[a.x, a.y + 4, a.z]}>
              <mesh rotation={[0, 0, 0]}>
                <torusGeometry args={[6, 0.4, 6, 20]} />
                <meshBasicMaterial color={i === objCount ? '#FFB454' : i < objCount ? '#57C4B8' : '#5C4632'} transparent opacity={i <= objCount ? 0.9 : 0.35} />
              </mesh>
            </group>
          );
        })}
    </group>
  );
}

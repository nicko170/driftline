/**
 * MissionDirector — runs the active mission inside the canvas:
 * objective proximity checks, pickups, race gates, timers, escort convoys,
 * chase targets, scout scans, storm walls, fragile-cargo damage and rewards.
 *
 * Objective semantics (see .ralph/ROUTES.md):
 *  pickup/dropoff/deliver/goto — reach the anchor under SLOW speed
 *  collect — grab `count` spawns scattered around the anchor
 *  race    — pass checkpoint gates in order (obj.targets)
 *  scout   — reach the viewpoint, then hold still to complete a scan
 *  escort  — NPC convoy crawls a route (obj.target spawn → obj.targets);
 *            stay in range or lose it
 *  chase   — NPC runner ping-pongs its route; get close to catch it
 *  storm   — a wall of sand hunts you; dive to the shelter anchor in time
 */
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore, useSaveStore } from '../state/store';
import { missionsById, type Mission, type Objective } from '../missions/library';
import { storyByChapter } from '../missions/chapters';
import { getAnchor, type ResolvedAnchor } from '../world/registry';
import { telemetry, addShake } from '../telemetry';
import { audio } from '../audio/audio';
import { pickLine } from '../dialogue/library';
import { mulberry32 } from '../lib/noise';
import { terrainHeight } from '../lib/terrain';
import { ride, flushRideStats } from './rideStats';

const REACH = 8;          // objective capture radius
const SLOW = 20;          // must be slower than this to pick up / drop off
const ESCORT_RANGE = 95;  // stay within this of the convoy (m)
const ESCORT_GRACE = 10;  // seconds out of range before the run fails
const CHASE_CATCH = 15;   // catch radius (m)
const STORM_KILL = 0;     // wall face crosses the player → fail
const STORM_R = 150;      // storm wall radius (m)
const SCOUT_RADIUS = 26;  // must be inside this of a scout anchor to scan
const SCOUT_HOLD = 3.2;   // seconds of scanning
const FRAGILE_DMG = 0.012;// integrity lost per unit of impact

type NpcKind = 'escort' | 'chase';

interface NpcState {
  x: number; z: number;
  route: ResolvedAnchor[];
  seg: number;              // current route index (moving toward route[seg])
  dir: 1 | -1;              // ping-pong direction (chase)
  done: boolean;
}

/* ---------------- runtime visuals ---------------- */

const TYPE_COLORS: Record<string, string> = {
  escort: '#57C4B8',
  chase: '#E4572E',
  scout: '#57C4B8',
  storm: '#E4572E',
};

function WaypointBeam({ pos, color = '#FFB454' }: { pos: { x: number; y: number; z: number }; color?: string }) {
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
      <group ref={ref} position={[0, pos.y, 0]}>
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

/** Slow crawlers — Salt Guild hover-wagons, reclaimer haulers. */
function EscortHauler({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const bob = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (bob.current) {
      bob.current.position.y = Math.sin(state.clock.elapsedTime * 1.8) * 0.18;
      bob.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.3) * 0.02;
    }
  });
  return (
    <group ref={groupRef}>
      <group ref={bob}>
        {/* hull */}
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[2.6, 1.1, 5.6]} />
          <meshStandardMaterial color="#B07C3A" flatShading />
        </mesh>
        {/* cargo canopy */}
        <mesh castShadow position={[0, 1.35, -0.8]}>
          <boxGeometry args={[2.2, 0.7, 3.2]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
        {/* cab */}
        <mesh castShadow position={[0, 1.1, 2.4]}>
          <boxGeometry args={[2.0, 0.8, 1.0]} />
          <meshStandardMaterial color="#2E8C8C" flatShading />
        </mesh>
        {/* skids */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.5, 0.1, 0]}>
            <boxGeometry args={[0.5, 0.3, 5.0]} />
            <meshStandardMaterial color="#5C4632" flatShading />
          </mesh>
        ))}
        {/* convoy beacon */}
        <mesh position={[0, 2.2, -0.8]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={2.4} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** A fast little skiff that doesn't want to be caught. */
function ChaseSkiff({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const bob = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (bob.current) {
      bob.current.position.y = Math.sin(state.clock.elapsedTime * 3.1) * 0.22;
      bob.current.rotation.z = Math.sin(state.clock.elapsedTime * 2.2) * 0.05;
    }
  });
  return (
    <group ref={groupRef}>
      <group ref={bob}>
        <mesh castShadow position={[0, 0.45, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[1.1, 0.5, 3.2]} />
          <meshStandardMaterial color="#E4572E" flatShading />
        </mesh>
        <mesh castShadow position={[0, 0.5, 1.9]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.7, 0.3, 0.9]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
        <mesh position={[0, 0.5, -1.9]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.2]} />
          <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={2.2} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The storm wall: nested half-shells of sand haze that chase the player.
 * Position/orientation written imperatively every frame; slight counter-
 * rotation between shells gives it depth without textures.
 */
function StormWall({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const shells = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    shells.current.forEach((s, i) => {
      if (s) s.rotation.y = Math.sin(t * (0.12 + i * 0.07)) * 0.14 + i * 0.2;
    });
  });
  return (
    <group ref={groupRef}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => { shells.current[i] = m; }}
          position={[0, 30 + i * 8, 0]}
          scale={[1 + i * 0.16, 1 + i * 0.1, 1 + i * 0.16]}
        >
          <cylinderGeometry args={[STORM_R, STORM_R, 200 + i * 30, 36, 1, true, Math.PI * 0.5, Math.PI]} />
          <meshBasicMaterial
            color={i === 0 ? '#C98F4E' : i === 1 ? '#B97745' : '#8A5335'}
            transparent
            opacity={0.22 - i * 0.05}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* churning base dust */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[STORM_R * 0.99, STORM_R * 1.01, 12, 36, 1, true, Math.PI * 0.5, Math.PI]} />
        <meshBasicMaterial color="#D9A45B" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Rotating scan arcs at a scout viewpoint. */
function ScoutRing({ pos, progress }: { pos: { x: number; y: number; z: number }; progress: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * (0.6 + progress * 3);
  });
  return (
    <group position={[pos.x, pos.y + 0.5, pos.z]}>
      <group ref={ref}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[SCOUT_RADIUS - 1.6, SCOUT_RADIUS - 0.4, 40, 1, 0, Math.PI * (0.4 + progress * 1.6)]} />
          <meshBasicMaterial color="#57C4B8" transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[SCOUT_RADIUS, SCOUT_RADIUS + 0.5, 40, 1, Math.PI, Math.PI * 0.9]} />
          <meshBasicMaterial color="#FFB454" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- the director ---------------- */

interface Rt {
  key: string;
  npc: NpcState | null;
  npcY: number;
  storm: { x: number; z: number } | null;
  scoutHold: number;
  escortOut: number;
  barked: boolean;
}

const freshRt = (): Rt => ({ key: '', npc: null, npcY: 0, storm: null, scoutHold: 0, escortOut: 0, barked: false });

export default function MissionDirector() {
  const [collected, setCollected] = useState<{ x: number; y: number; z: number }[]>([]);
  const spawnKey = useRef('');
  const rt = useRef<Rt>(freshRt());
  const failFlashed = useRef<{ id: string; reason: string } | null>(null);
  const npcRef = useRef<THREE.Group>(null);
  const stormRef = useRef<THREE.Group>(null);
  const fragileMission = useRef<string | null>(null);

  useFrame((_, dt) => {
    const game = useGameStore.getState();
    const save = useSaveStore.getState();
    const r = rt.current;

    // fail banner flash
    if (game.missionFailed && failFlashed.current !== game.missionFailed) {
      failFlashed.current = game.missionFailed;
      audio.thud(0.5);
      addShake(0.3);
      audio.setStorm(0);
      telemetry.storm = null;
      telemetry.escort = null;
      telemetry.chase = null;
      telemetry.convoy = null;
      telemetry.scout = null;
      telemetry.objective = null;
      telemetry.slowHint = false;
      fragileMission.current = null;
      rt.current = freshRt();
    } else if (!game.missionFailed) failFlashed.current = null;

    if (!game.activeMissionId) {
      if (spawnKey.current) {
        spawnKey.current = '';
        setCollected([]);
      }
      if (r.key) {
        rt.current = freshRt();
        telemetry.escort = null;
        telemetry.chase = null;
        telemetry.convoy = null;
        telemetry.storm = null;
        telemetry.scout = null;
        telemetry.objective = null;
        telemetry.slowHint = false;
        audio.setStorm(0);
      }
      return;
    }
    const mission = missionsById.get(game.activeMissionId);
    if (!mission) {
      game.clearMission();
      return;
    }

    // fragile cargo bookkeeping
    if (mission.cargo?.fragile && fragileMission.current !== mission.id) {
      fragileMission.current = mission.id;
      game.setCargoIntegrity(1);
    } else if (!mission.cargo?.fragile && fragileMission.current) {
      fragileMission.current = null;
      game.setCargoIntegrity(null);
    }
    if (mission.cargo?.fragile && telemetry.impact > 0.5) {
      const dmg = telemetry.impact * FRAGILE_DMG;
      game.damageCargo(dmg);
      game.say(mission.giver, pickLine(mission.giver, 'mission') ?? 'Careful with the cargo!');
      if ((useGameStore.getState().cargoIntegrity ?? 1) <= 0) {
        game.failMission(`${mission.title} — the ${mission.cargo.label ?? 'cargo'} shattered. The Guild will hear about this one.`);
        telemetry.impact = 0;
        return;
      }
    }
    telemetry.impact = 0;

    // timer (only ticks while actually riding — dialogue/board time is free)
    if (game.timeLeft !== null && game.mode === 'riding') {
      game.tickTimer(dt);
      if (game.timeLeft !== null && game.timeLeft <= 0) {
        game.failMission(`${mission.title} — out of time. The client noticed.`);
        return;
      }
    }

    const obj: Objective | undefined = mission.objectives[game.objectiveIndex];
    if (!obj) return;

    // objective-keyed runtime (re)spawn
    const key = `${mission.id}:${game.objectiveIndex}`;
    if (r.key !== key) {
      r.key = key;
      r.npc = null;
      r.storm = null;
      r.scoutHold = 0;
      r.escortOut = 0;
      r.barked = false;
      telemetry.scout = null;
      telemetry.escort = null;
      telemetry.convoy = null;
      telemetry.chase = null;
      if (obj.type !== 'storm') {
        telemetry.storm = null;
        audio.setStorm(0);
      }

      if (obj.type === 'escort' || obj.type === 'chase') {
        const routeRefs = obj.targets?.length ? obj.targets : obj.target ? [obj.target] : [];
        const route = routeRefs.map(getAnchor).filter((a): a is ResolvedAnchor => !!a);
        const spawnRef = obj.target ? getAnchor(obj.target) : route[0];
        if (route.length && spawnRef) {
          r.npc = { x: spawnRef.x, z: spawnRef.z, route, seg: 0, dir: 1, done: false };
        }
      } else if (obj.type === 'storm') {
        const shelter = obj.target ? getAnchor(obj.target) : null;
        if (shelter) {
          const dx = shelter.x - telemetry.x;
          const dz = shelter.z - telemetry.z;
          const len = Math.hypot(dx, dz) || 1;
          r.storm = { x: telemetry.x - (dx / len) * 460, z: telemetry.z - (dz / len) * 460 };
          game.say(mission.giver, 'Weather just went hard to sand. Run for shelter — the wall is behind you.');
          audio.thud(0.8);
        }
      }
    }

    /* ---------- collect pickups ---------- */
    if (obj.type === 'collect') {
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
      const idx = collected.findIndex((it) => (it.x - telemetry.x) ** 2 + (it.z - telemetry.z) ** 2 < 36);
      if (idx >= 0) {
        const next = [...collected];
        next.splice(idx, 1);
        setCollected(next);
        game.setObjectiveCount(game.objectiveCount + 1);
        audio.chime();
        if (game.objectiveCount + 1 >= (obj.count ?? 3)) advance(mission);
      }
      const nearest = collected[0];
      if (nearest) telemetry.objective = { ...nearest };
      return;
    }

    /* ---------- escort ---------- */
    if (obj.type === 'escort' && r.npc) {
      const npc = r.npc;
      const speed = obj.speed ?? 13;
      const dest = npc.route[npc.seg];
      if (dest) {
        const dx = dest.x - npc.x;
        const dz = dest.z - npc.z;
        const d = Math.hypot(dx, dz);
        if (d < 6) {
          npc.seg++;
          if (npc.seg >= npc.route.length) {
            npc.done = true;
            audio.chime();
            advance(mission);
            return;
          }
        } else {
          npc.x += (dx / d) * speed * dt;
          npc.z += (dz / d) * speed * dt;
        }
      }
      r.npcY = terrainHeight(npc.x, npc.z) + 1.35;
      if (npcRef.current) {
        npcRef.current.position.set(npc.x, r.npcY, npc.z);
        const nxt = npc.route[Math.min(npc.seg, npc.route.length - 1)];
        if (nxt) npcRef.current.rotation.y = Math.atan2(nxt.x - npc.x, nxt.z - npc.z);
      }
      const pd = Math.hypot(npc.x - telemetry.x, npc.z - telemetry.z);
      if (pd > ESCORT_RANGE) r.escortOut = Math.min(ESCORT_GRACE, r.escortOut + dt);
      else r.escortOut = Math.max(0, r.escortOut - dt * 2);
      telemetry.escort = { dist: pd, out: r.escortOut / ESCORT_GRACE };
      telemetry.convoy = { x: npc.x, z: npc.z };
      telemetry.objective = { x: npc.x, y: r.npcY, z: npc.z };
      if (r.escortOut >= ESCORT_GRACE) {
        game.failMission(`${mission.title} — you lost the convoy in the dust.`);
        return;
      }
      if (!r.barked && pd < 60) {
        r.barked = true;
        game.say(mission.giver, pickLine(mission.giver, 'mission') ?? "Convoy's rolling. Keep formation.");
      }
      return;
    }

    /* ---------- chase ---------- */
    if (obj.type === 'chase' && r.npc) {
      const npc = r.npc;
      const tgt = npc.route[npc.seg];
      if (tgt) {
        const dx = tgt.x - npc.x;
        const dz = tgt.z - npc.z;
        const d = Math.hypot(dx, dz);
        if (d < 8) {
          // ping-pong along the route
          let next = npc.seg + npc.dir;
          if (next >= npc.route.length) { npc.dir = -1; next = npc.seg - 1; }
          if (next < 0) { npc.dir = 1; next = npc.seg + 1; }
          npc.seg = Math.max(0, Math.min(npc.route.length - 1, next));
        } else {
          const pd = Math.hypot(npc.x - telemetry.x, npc.z - telemetry.z);
          // rubber-band: flees harder when the player closes in
          const flee = (obj.speed ?? 21) * (pd < 60 ? 1.14 : 1) + THREE.MathUtils.clamp((pd - 160) * 0.02, 0, 4);
          npc.x += (dx / d) * flee * dt;
          npc.z += (dz / d) * flee * dt;
        }
      }
      r.npcY = terrainHeight(npc.x, npc.z) + 1.1;
      if (npcRef.current) {
        npcRef.current.position.set(npc.x, r.npcY, npc.z);
        const nxt = npc.route[Math.min(npc.seg, npc.route.length - 1)];
        if (nxt) npcRef.current.rotation.y = Math.atan2(nxt.x - npc.x, nxt.z - npc.z);
      }
      telemetry.chase = { x: npc.x, z: npc.z };
      telemetry.objective = { x: npc.x, y: r.npcY, z: npc.z };
      const pd2 = (npc.x - telemetry.x) ** 2 + (npc.z - telemetry.z) ** 2;
      if (pd2 < CHASE_CATCH * CHASE_CATCH) {
        audio.chime();
        game.say(mission.giver, 'Run them down — nicely done.');
        advance(mission);
      }
      return;
    }

    /* ---------- storm ---------- */
    if (obj.type === 'storm') {
      const shelter = obj.target ? getAnchor(obj.target) : null;
      if (!shelter) return;
      if (!r.storm) r.storm = { x: telemetry.x - 400, z: telemetry.z };
      // the wall hunts the player
      const dx = telemetry.x - r.storm.x;
      const dz = telemetry.z - r.storm.z;
      const cd = Math.hypot(dx, dz) || 1;
      const face = cd - STORM_R;
      const chase = 23 + THREE.MathUtils.clamp((face - 150) * 0.03, 0, 9);
      r.storm.x += (dx / cd) * chase * dt;
      r.storm.z += (dz / cd) * chase * dt;
      telemetry.storm = { x: r.storm.x, z: r.storm.z, r: STORM_R, dist: face };
      telemetry.objective = { x: shelter.x, y: shelter.y, z: shelter.z };
      const intensity = THREE.MathUtils.clamp(1 - face / 420, 0, 1);
      audio.setStorm(intensity);
      if (face < 260) addShake(Math.min(0.35, (1 - face / 260) * 0.16));
      if (stormRef.current) {
        stormRef.current.position.set(r.storm.x, terrainHeight(r.storm.x, r.storm.z) - 20, r.storm.z);
        stormRef.current.rotation.y = Math.atan2(dx, dz);
      }
      if (face <= STORM_KILL) {
        game.failMission(`${mission.title} — the wall took you. Dig out, patch up, ride again.`);
        audio.setStorm(0);
        return;
      }
      // made it to shelter (no slow-gate — you dive for it)
      const sd2 = (shelter.x - telemetry.x) ** 2 + (shelter.z - telemetry.z) ** 2;
      if (sd2 < (REACH * 1.8) ** 2) {
        audio.chime();
        addShake(0.2);
        telemetry.storm = null;
        audio.setStorm(0);
        advance(mission);
      }
      return;
    }

    /* ---------- scout (reach, then hold to scan) ---------- */
    if (obj.type === 'scout') {
      const anchor = obj.target ? getAnchor(obj.target) : null;
      if (!anchor) return;
      telemetry.objective = { x: anchor.x, y: anchor.y, z: anchor.z };
      const d2 = (anchor.x - telemetry.x) ** 2 + (anchor.z - telemetry.z) ** 2;
      const inside = d2 < SCOUT_RADIUS * SCOUT_RADIUS;
      if (inside && telemetry.speed < 7) {
        r.scoutHold = Math.min(SCOUT_HOLD, r.scoutHold + dt);
      } else if (inside) {
        r.scoutHold = Math.max(0, r.scoutHold - dt * 0.5);
        telemetry.slowHint = true;
      } else {
        r.scoutHold = 0;
        telemetry.slowHint = false;
      }
      telemetry.scout = { progress: r.scoutHold / SCOUT_HOLD };
      if (r.scoutHold >= SCOUT_HOLD) {
        telemetry.scout = null;
        telemetry.slowHint = false;
        audio.chime();
        advance(mission);
      }
      if (!(inside && telemetry.speed >= 7)) telemetry.slowHint = false;
      return;
    }

    /* ---------- point objectives: pickup/dropoff/deliver/goto/race ---------- */
    const ref = obj.type === 'race' ? obj.targets?.[game.objectiveCount] : obj.target;
    const anchor = ref ? getAnchor(ref) : null;
    if (!anchor) return;
    telemetry.objective = { x: anchor.x, y: anchor.y, z: anchor.z };

    const d2 = (anchor.x - telemetry.x) ** 2 + (anchor.z - telemetry.z) ** 2;
    telemetry.slowHint = d2 < (REACH * 2.2) ** 2 && obj.type !== 'race' && telemetry.speed >= SLOW;
    if (d2 > REACH * REACH) return;

    if (obj.type === 'race') {
      game.setObjectiveCount(game.objectiveCount + 1);
      audio.blip(980, 0.08);
      if (game.objectiveCount + 1 >= (obj.targets?.length ?? 0)) advance(mission);
      return;
    }

    const slowEnough = telemetry.speed < SLOW;
    if ((obj.type === 'pickup' || obj.type === 'dropoff' || obj.type === 'deliver' || obj.type === 'goto') && slowEnough) {
      telemetry.slowHint = false;
      audio.chime();
      advance(mission);
    }
  });

  function advance(mission: Mission) {
    const game = useGameStore.getState();
    if (game.objectiveIndex + 1 < mission.objectives.length) {
      game.advanceObjective();
      const next = mission.objectives[game.objectiveIndex + 1];
      if (next?.label) game.say(mission.giver, next.label);
      return;
    }
    // complete! — fragile cargo scales the payout
    const save = useSaveStore.getState();
    const rewards = { ...mission.rewards };
    if (mission.cargo?.fragile) {
      const integrity = game.cargoIntegrity ?? 1;
      const scaled = Math.round(rewards.credits * (0.35 + 0.65 * integrity));
      if (scaled !== rewards.credits) {
        game.say(mission.giver, `Cargo took a beating — ${Math.round(integrity * 100)}% intact. Pay's adjusted.`);
      } else {
        game.say(mission.giver, 'Not a scratch on it. Guild rates approved — full pay.');
      }
      rewards.credits = scaled;
    }
    save.completeMission(mission.id, rewards);
    // chapter completion → one-time debrief card (after the completion dialogue)
    if (mission.chapter !== 'side') {
      const n = mission.chapter as number;
      const after = useSaveStore.getState();
      const list = storyByChapter().get(n) ?? [];
      if (list.length && list.every((m) => after.missionsDone.includes(m.id)) && !after.outrosSeen.includes(n)) {
        game.setChapterOutro(n);
      }
    }
    // lifetime stats + achievement check (flushRideStats evaluates unlocks)
    ride.missionsDone += 1;
    if (mission.objectives.some((o) => o.type === 'storm')) ride.stormsOutrun += 1;
    ride.dirty = true;
    flushRideStats();
    game.clearMission();
    spawnKey.current = '';
    setCollected([]);
    if (mission.dialogue.complete?.length) {
      const choices = mission.dialogue.choices?.[0];
      game.openDialogue(mission.dialogue.complete, choices);
    }
    audio.chime();
  }

  /* ---------------- render ---------------- */
  const activeId = useGameStore((s) => s.activeMissionId);
  const objIndex = useGameStore((s) => s.objectiveIndex);
  const objCount = useGameStore((s) => s.objectiveCount);
  const mission = activeId ? missionsById.get(activeId) : null;
  const obj = mission?.objectives[objIndex];
  const refStr = obj?.type === 'race' ? obj.targets?.[objCount] : obj?.target;
  let beamAnchor = refStr ? getAnchor(refStr) : null;
  // escort beams point at the *destination* (last route anchor), not the spawn
  if (obj?.type === 'escort' && obj.targets?.length) {
    beamAnchor = getAnchor(obj.targets[obj.targets.length - 1]);
  }
  const beamColor = obj ? (TYPE_COLORS[obj.type] ?? '#FFB454') : '#FFB454';

  return (
    <group>
      {beamAnchor && obj?.type !== 'chase' && (
        <WaypointBeam pos={new THREE.Vector3(beamAnchor.x, beamAnchor.y, beamAnchor.z)} color={beamColor} />
      )}
      {obj?.type === 'collect' && collected.map((it, i) => <CollectItem key={i} pos={it} />)}
      {obj?.type === 'escort' && <EscortHauler groupRef={npcRef} />}
      {obj?.type === 'chase' && (
        <>
          <ChaseSkiff groupRef={npcRef} />
          {/* beam rides the target */}
          <group>
            <ChaseBeam npcRef={npcRef} />
          </group>
        </>
      )}
      {obj?.type === 'storm' && <StormWall groupRef={stormRef} />}
      {obj?.type === 'scout' && beamAnchor && (
        <ScoutRing pos={{ x: beamAnchor.x, y: beamAnchor.y, z: beamAnchor.z }} progress={rt.current.scoutHold / SCOUT_HOLD} />
      )}
      {obj?.type === 'race' &&
        obj.targets?.map((t, i) => {
          const a = getAnchor(t);
          if (!a) return null;
          return (
            <group key={t} position={[a.x, a.y + 4, a.z]}>
              <mesh>
                <torusGeometry args={[6, 0.4, 6, 20]} />
                <meshBasicMaterial color={i === objCount ? '#FFB454' : i < objCount ? '#57C4B8' : '#5C4632'} transparent opacity={i <= objCount ? 0.9 : 0.35} />
              </mesh>
            </group>
          );
        })}
    </group>
  );
}

/** A waypoint beam that tracks the chase skiff every frame. */
function ChaseBeam({ npcRef }: { npcRef: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current && npcRef.current) {
      const p = npcRef.current.position;
      ref.current.position.set(p.x, 0, p.z);
    }
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 40, 0]}>
        <cylinderGeometry args={[0.4, 1.2, 80, 8, 1, true]} />
        <meshBasicMaterial color="#E4572E" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

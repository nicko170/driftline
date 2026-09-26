/**
 * Handling Curve Lab world — everything on screen reads the analytic terrain
 * in terrain.ts: the vertex-painted heightfield (salt pan / sand ring / glass
 * lanes / the amber eight), instanced glass shards, glass-lane test gates,
 * the start gantry over the apex checkbar, horizon pylon ring, spawn pad,
 * dust trail + motes. Colliders are fixed bumps-only shapes — the bike motion
 * is driven against ground(); props never kill.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CylinderCollider, CuboidCollider } from '@react-three/rapier';
import { mulberry32 } from '../../../lib/noise';
import { ground, vertexColor, SHARDS, GATES, GANTRY, PLAY_RADIUS, SPAWN } from './terrain';
import { tele } from './telemetry';

const _m = new THREE.Object3D();

/* ============================== terrain ============================== */

export function PanGround() {
  const geo = useMemo(() => {
    const SIZE = 720;
    const SEG = 224; // ~3.2 m cells, fine enough for the painted eight
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = ground(x, z);
      pos.setY(i, y);
      vertexColor(x, z, y, colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

/* ========================= obstacles / props ========================= */

export function Obstacles() {
  const shardMesh = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = shardMesh.current;
    if (!mesh) return;
    SHARDS.forEach((s, i) => {
      _m.position.set(s.x, ground(s.x, s.z) + s.s * 0.72, s.z);
      _m.scale.set(s.s * 0.45, s.s, s.s * 0.45);
      _m.rotation.set(0.08, s.rot, 0.06);
      _m.updateMatrix();
      mesh.setMatrixAt(i, _m.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      {/* glass shards ringing the pan (teal sight-line markers) */}
      <instancedMesh ref={shardMesh} args={[undefined, undefined, SHARDS.length]} castShadow frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#2E8C8C" emissive="#57C4B8" emissiveIntensity={0.12} flatShading roughness={0.4} />
      </instancedMesh>

      {/* glass-lane test gates: rust posts + teal diamonds (teal = glass) */}
      {GATES.map((p, i) => (
        <group key={i} position={[p.x, ground(p.x, p.z), p.z]}>
          <mesh castShadow position={[0, 3.2, 0]}>
            <boxGeometry args={[0.45, 6.4, 0.45]} />
            <meshStandardMaterial color="#7E3320" flatShading />
          </mesh>
          <mesh position={[0, 6.9, 0]} rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.1} flatShading />
          </mesh>
        </group>
      ))}

      {/* start gantry over the apex checkbar */}
      {GANTRY.map((p, i) => (
        <group key={`g${i}`} position={[p.x, ground(p.x, p.z), p.z]}>
          <mesh castShadow position={[0, 4, 0]}>
            <boxGeometry args={[0.55, 8, 0.55]} />
            <meshStandardMaterial color="#B07C3A" flatShading />
          </mesh>
          <mesh position={[0, 8.3, 0]}>
            <boxGeometry args={[1, 0.7, 1]} />
            <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
      <mesh
        castShadow
        position={[(GANTRY[0].x + GANTRY[1].x) / 2, ground(SPAWN.x, SPAWN.z) + 7.6, 0.9]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <boxGeometry args={[0.5, Math.abs(GANTRY[1].x - GANTRY[0].x) + 0.8, 0.5]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>

      {/* colliders: bumps, not walls */}
      <RigidBody type="fixed" colliders={false}>
        {SHARDS.map((s, i) => (
          <CylinderCollider
            key={`s${i}`}
            args={[s.s * 0.5, s.s * 0.4]}
            position={[s.x, ground(s.x, s.z) + s.s * 0.5 - 0.3, s.z]}
            restitution={0.3}
            friction={0.5}
          />
        ))}
        {GATES.map((p, i) => (
          <CuboidCollider
            key={`p${i}`}
            args={[0.28, 3.4, 0.28]}
            position={[p.x, ground(p.x, p.z) + 3.2, p.z]}
            restitution={0.3}
            friction={0.5}
          />
        ))}
        {GANTRY.map((p, i) => (
          <CuboidCollider
            key={`t${i}`}
            args={[0.34, 4, 0.34]}
            position={[p.x, ground(p.x, p.z) + 4, p.z]}
            restitution={0.3}
            friction={0.5}
          />
        ))}
      </RigidBody>
    </group>
  );
}

/* ===================== horizon pylons + spawn pad ===================== */

export function HorizonRing() {
  const poles = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const N = 26;

  useEffect(() => {
    const R = PLAY_RADIUS + 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const h = i % 3 === 0 ? 11 : 7.5;
      const y = ground(x, z);
      _m.rotation.set(0, -a, 0);
      _m.position.set(x, y + h / 2, z);
      _m.scale.set(0.5, h, 0.5);
      _m.updateMatrix();
      poles.current?.setMatrixAt(i, _m.matrix);
      _m.position.set(x, y + h + 0.35, z);
      _m.scale.set(1, 1, 1);
      _m.updateMatrix();
      caps.current?.setMatrixAt(i, _m.matrix);
    }
    if (poles.current) poles.current.instanceMatrix.needsUpdate = true;
    if (caps.current) caps.current.instanceMatrix.needsUpdate = true;
  }, []);

  const padY = ground(SPAWN.x, SPAWN.z) + 0.06;

  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, N]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2E8C8C" flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, N]} frustumCulled={false}>
        <boxGeometry args={[0.95, 0.7, 0.95]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.4} />
      </instancedMesh>
      {/* spawn pad at the apex checkbar */}
      <mesh position={[SPAWN.x, padY, SPAWN.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 3.1, 40]} />
        <meshStandardMaterial color="#FFB454" emissive="#FFB454" emissiveIntensity={0.9} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[SPAWN.x, padY - 0.01, SPAWN.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.55, 32]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={0.25} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ============================ dust systems =========================== */

const TRAIL_MAX = 260;

export function DustTrail() {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const data = useMemo(() => {
    const positions = new Float32Array(TRAIL_MAX * 3);
    const colors = new Float32Array(TRAIL_MAX * 3);
    const vel = new Float32Array(TRAIL_MAX * 3);
    const life = new Float32Array(TRAIL_MAX);
    for (let i = 0; i < TRAIL_MAX; i++) positions[i * 3 + 1] = -9999;
    return { positions, colors, vel, life, cursor: 0 };
  }, []);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const t = tele;
    if (t.grounded && t.speed > (t.drifting ? 4 : 6)) {
      const n = t.speed > 30 ? 3 : t.speed > 14 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const i = data.cursor;
        data.cursor = (data.cursor + 1) % TRAIL_MAX;
        const j = i * 3;
        data.life[i] = 0.55 + Math.random() * 0.35;
        data.positions[j] = t.x + (Math.random() - 0.5) * 0.8;
        data.positions[j + 1] = t.y - 0.5;
        data.positions[j + 2] = t.z + (Math.random() - 0.5) * 0.8;
        data.vel[j] = (Math.random() - 0.5) * 2.2;
        data.vel[j + 1] = 1 + Math.random() * 1.4;
        data.vel[j + 2] = (Math.random() - 0.5) * 2.2;
        // dust reports the painted surface honestly: glass kicks teal
        if (t.surface === 'glass') {
          data.colors[j] = 0.34;
          data.colors[j + 1] = 0.77;
          data.colors[j + 2] = 0.72;
        } else if (t.surface === 'sand') {
          data.colors[j] = 0.85;
          data.colors[j + 1] = 0.64;
          data.colors[j + 2] = 0.36;
        } else {
          data.colors[j] = 0.87;
          data.colors[j + 1] = 0.82;
          data.colors[j + 2] = 0.7;
        }
      }
    }
    const { positions, vel, life } = data;
    for (let i = 0; i < TRAIL_MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= d;
      const j = i * 3;
      if (life[i] <= 0) {
        positions[j + 1] = -9999;
        continue;
      }
      positions[j] += vel[j] * d;
      positions[j + 1] += vel[j + 1] * d;
      positions[j + 2] += vel[j + 2] * d;
      vel[j + 1] *= Math.exp(-2.2 * d);
    }
    const geo = geoRef.current;
    if (geo) {
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.55} vertexColors transparent opacity={0.5} depthWrite={false} sizeAttenuation />
    </points>
  );
}

const MOTE_COUNT = 200;

export function DustMotes() {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const data = useMemo(() => {
    const positions = new Float32Array(MOTE_COUNT * 3);
    const phase = new Float32Array(MOTE_COUNT);
    const rnd = mulberry32(31);
    for (let i = 0; i < MOTE_COUNT; i++) {
      positions[i * 3] = (rnd() - 0.5) * 320;
      positions[i * 3 + 1] = 1 + rnd() * 22;
      positions[i * 3 + 2] = (rnd() - 0.5) * 320;
      phase[i] = rnd() * Math.PI * 2;
    }
    return { positions, phase, base: positions.slice() };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { positions, phase, base } = data;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const j = i * 3;
      positions[j] = base[j] + Math.sin(t * 0.35 + phase[i]) * 5;
      positions[j + 1] = base[j + 1] + Math.sin(t * 0.6 + phase[i] * 2) * 1.6;
      positions[j + 2] = base[j + 2] + Math.cos(t * 0.28 + phase[i]) * 5;
    }
    const geo = geoRef.current;
    if (geo) (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.22} color="#E9DCBE" transparent opacity={0.55} depthWrite={false} sizeAttenuation />
    </points>
  );
}

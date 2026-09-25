/**
 * THE BIKE — arcade hover physics.
 *
 * Scheme: a dynamic rigid body for collisions, but motion is driven arcade-style
 * against the analytic terrain (lib/terrain): a vertical ride-height controller,
 * thrust + shaped lateral grip (glass = slick), manual smoothed rotation
 * (yaw steer + ground align + lean). Bumps from props disturb velocity only,
 * never throw the bike — collisions bump, they don't kill.
 *
 * Controls: WASD/arrows · Shift boost · Space hop · brake+steer = drift
 * (drift exit refunds boost). Air control: steering works, momentum carries.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { terrainHeight, terrainNormal, surfaceAt } from '../lib/terrain';
import { input, pollKeyboard, pollGamepad } from '../input/input';
import { telemetry, addShake } from '../telemetry';
import { audio } from '../audio/audio';
import { useSaveStore, useGameStore } from '../state/store';
import { getAnchor } from '../world/registry';

/* scratch (no per-frame allocations) */
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qAlign = new THREE.Quaternion();
const _qLean = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _n = { x: 0, y: 1, z: 0 };
const _axisF = new THREE.Vector3();
const _axisS = new THREE.Vector3();
const _nVec = new THREE.Vector3();

const SPAWN = getAnchor('saltmouth:spawn') ?? { x: 22, y: 3, z: 352 };

export default function Bike() {
  const rb = useRef<RapierRigidBody>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const paint = useSaveStore((s) => s.upgrades.paint);

  // controller state (module-level frame persistence)
  const ctrl = useRef({
    yaw: Math.PI * 0.9, // face roughly into town toward the board
    align: new THREE.Quaternion(),
    lean: 0,
    pitch: 0,
    boost: 1,
    driftTime: 0,
    wasDrifting: false,
    hopCooldown: 0,
    airTime: 0,
  });

  useBeforePhysicsStep(() => {
    const body = rb.current;
    if (!body) return;
    const c = ctrl.current;
    const dt = 1 / 60;
    const save = useSaveStore.getState();
    const game = useGameStore.getState();
    const up = save.upgrades;

    pollKeyboard();
    pollGamepad();

    const freeze = game.mode === 'dialogue' || game.mode === 'board' || game.mode === 'garage' || game.physicsPaused;

    const pos = body.translation();
    const vel = body.linvel();
    const ground = terrainHeight(pos.x, pos.z);
    const surf = surfaceAt(pos.x, pos.z);

    const hoverH = 1.25;
    const above = pos.y - ground;
    c.hopCooldown = Math.max(0, c.hopCooldown - dt);
    const grounded = above < hoverH * 1.45 && c.hopCooldown <= 0;
    c.airTime = grounded ? 0 : c.airTime + dt;

    /* ---------- steering ---------- */
    const speed = Math.hypot(vel.x, vel.z);
    const steerRate = (1.9 + up.handling * 0.22) / (1 + speed / 30);
    if (!freeze) c.yaw -= input.steer * steerRate * dt * (grounded ? 1 : 0.45);

    _fwd.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));

    /* ---------- boost & drift ---------- */
    const drifting = grounded && input.brake > 0.5 && Math.abs(input.steer) > 0.25 && speed > 7;
    if (drifting) {
      c.driftTime += dt;
      c.wasDrifting = true;
    } else if (c.wasDrifting) {
      // boost-on-exit reward
      const reward = Math.min(0.35, c.driftTime * 0.1);
      if (reward > 0.04) {
        c.boost = Math.min(1, c.boost + reward);
        const kick = Math.min(4.5, c.driftTime * 2.4);
        body.applyImpulse({ x: _fwd.x * kick, y: 0, z: _fwd.z * kick }, true);
        audio.blip(520, 0.1);
      }
      c.wasDrifting = false;
      c.driftTime = 0;
    }
    const boosting = !freeze && input.boost && c.boost > 0.02 && input.throttle > 0;
    if (boosting) c.boost = Math.max(0, c.boost - dt * (0.26 - up.boost * 0.035));
    else c.boost = Math.min(1, c.boost + dt * (0.07 + up.boost * 0.02 + (grounded ? 0 : 0.01)));

    /* ---------- throttle / thrust ---------- */
    const accel = (24 + up.engine * 5) * (boosting ? 1.8 : 1);
    const vMax = (36 + up.engine * 3.5) * (boosting ? 1.38 : 1);

    let vx = vel.x;
    let vy = vel.y;
    let vz = vel.z;

    if (grounded && !freeze) {
      // forward drive with soft top speed
      const fdot = vx * _fwd.x + vz * _fwd.z;
      const push = input.throttle * accel * (1 - Math.max(0, fdot) / vMax);
      vx += _fwd.x * push * dt;
      vz += _fwd.z * push * dt;
      if (input.brake > 0 && !drifting) {
        const b = Math.min(0.12 * input.brake, 1);
        vx -= vx * b;
        vz -= vz * b;
      }
      // lateral grip (canyon glass is slick; drift slashes grip)
      const lateralX = vx - _fwd.x * (vx * _fwd.x + vz * _fwd.z);
      const lateralZ = vz - _fwd.z * (vx * _fwd.x + vz * _fwd.z);
      const grip = (9 + up.handling * 1.6) * surf.grip * (drifting ? 0.16 : 1);
      const keep = Math.exp(-grip * dt);
      vx -= lateralX * (1 - keep);
      vz -= lateralZ * (1 - keep);
      // rolling drag
      const drag = Math.exp(-0.55 * dt);
      vx *= drag;
      vz *= drag;

      // ride height controller
      const targetY = ground + hoverH;
      const wantVy = THREE.MathUtils.clamp((targetY - pos.y) * 6.5, -14, 13);
      vy = vy * 0.22 + wantVy * 0.78;

      if (input.hop && c.hopCooldown <= 0) {
        input.hop = false;
        vy = Math.min(vy + 8.6, 11.5);
        c.hopCooldown = 0.28;
        addShake(0.12);
        audio.blip(300, 0.08);
      }
    } else if (!freeze) {
      // airborne: gravity + light drag + air steering authority
      vy -= 17 * dt;
      vx *= Math.exp(-0.12 * dt);
      vz *= Math.exp(-0.12 * dt);
      if (input.throttle > 0) {
        vx += _fwd.x * accel * 0.18 * dt;
        vz += _fwd.z * accel * 0.18 * dt;
      }
    }

    // world bounds — soft wall just inside the boundary mountains
    const lim = 1140;
    if (Math.abs(pos.x) > lim || Math.abs(pos.z) > lim) {
      vx += pos.x > lim ? -30 * dt : pos.x < -lim ? 30 * dt : 0;
      vz += pos.z > lim ? -30 * dt : pos.z < -lim ? 30 * dt : 0;
    }

    body.setLinvel({ x: vx, y: vy, z: vz }, true);

    // landing feedback
    if (grounded && c.airTime > 0.55) {
      addShake(Math.min(0.5, 0.12 + c.airTime * 0.2));
      audio.thud(Math.min(1, c.airTime * 0.5));
    }

    /* ---------- rotation (manual, smoothed) ---------- */
    terrainNormal(pos.x, pos.z, _n);
    _nVec.set(_n.x, _n.y, _n.z);
    _qAlign.setFromUnitVectors(_up, grounded ? _nVec : _up);
    // smooth the alignment quaternion towards target
    c.align.slerp(_qAlign, grounded ? Math.min(1, 10 * dt) : Math.min(1, 2.5 * dt));

    const leanTarget = grounded ? input.steer * (drifting ? 0.34 : 0.2) : 0;
    c.lean += (leanTarget - c.lean) * Math.min(1, 8 * dt);
    const pitchTarget = grounded ? input.throttle * -0.07 + Math.max(0, vy) * 0.01 : THREE.MathUtils.clamp(-vy * 0.02, -0.3, 0.3);
    c.pitch += (pitchTarget - c.pitch) * Math.min(1, 6 * dt);

    _axisF.set(0, 0, 1);
    _qLean.setFromAxisAngle(_axisF, c.lean);
    _axisS.set(1, 0, 0);
    _qPitch.setFromAxisAngle(_axisS, c.pitch);
    _qYaw.setFromAxisAngle(_up, c.yaw);
    _q.copy(c.align).multiply(_qYaw).multiply(_qPitch).multiply(_qLean);
    body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);

    /* ---------- telemetry + audio ---------- */
    telemetry.x = pos.x;
    telemetry.y = pos.y;
    telemetry.z = pos.z;
    telemetry.speed = Math.hypot(vx, vz);
    telemetry.heading = Math.atan2(_fwd.x, -_fwd.z);
    telemetry.boost = c.boost;
    telemetry.boosting = boosting;
    telemetry.grounded = grounded;
    telemetry.drifting = drifting;

    if (audio.ready) audio.updateVehicle(telemetry.speed, freeze ? 0 : input.throttle, boosting);
  });

  // engine glow follows throttle
  useFrame(() => {
    if (glow.current) {
      glow.current.emissiveIntensity = 0.9 + Math.min(1, telemetry.speed / 30) * 1.6 + (telemetry.boosting ? 1.6 : 0);
    }
  });

  const impactAbsorb = useSaveStore.getState().upgrades.shield * 6;

  return (
    <RigidBody
      ref={rb}
      colliders={false}
      position={[SPAWN.x, terrainHeight(SPAWN.x, SPAWN.z) + 1.6, SPAWN.z]}
      linearDamping={0.02}
      angularDamping={4}
      ccd
      onCollisionEnter={(e) => {
        const impulse = Math.max(0, (e.target.collider ? 1 : 1) * telemetry.speed);
        if (impulse > 9) {
          const dmg = Math.max(0, impulse - 9 - impactAbsorb);
          telemetry.impact = dmg;
          addShake(Math.min(0.7, dmg * 0.04));
          audio.thud(Math.min(1, dmg * 0.05));
        }
      }}
    >
      <CuboidCollider args={[1.25, 0.42, 0.55]} restitution={0.25} friction={0.4} />
      <BikeModel paint={paint} glowRef={glow} />
    </RigidBody>
  );
}

function BikeModel({ paint, glowRef }: { paint: string; glowRef: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  return (
    <group position={[0, 0.12, 0]}>
      {/* main hull */}
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.85, 0.42, 2.6]} />
        <meshStandardMaterial color={paint} flatShading />
      </mesh>
      {/* nose */}
      <mesh castShadow position={[0, 0.02, 1.55]} rotation={[0.24, 0, 0]}>
        <boxGeometry args={[0.6, 0.3, 0.9]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      {/* cowl fins */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 0.62, 0.0, 1.0]} rotation={[0, s * 0.34, 0]}>
          <boxGeometry args={[0.7, 0.1, 1.1]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
      ))}
      {/* engine pods */}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} castShadow position={[s * 0.58, -0.02, -0.9]}>
          <boxGeometry args={[0.34, 0.3, 1.1]} />
          <meshStandardMaterial color="#5C4632" flatShading />
        </mesh>
      ))}
      {/* exhaust glow */}
      <mesh position={[0, 0.02, -1.55]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.24]} />
        <meshStandardMaterial ref={glowRef} color="#FFB454" emissive="#FFB454" emissiveIntensity={1.4} side={THREE.DoubleSide} />
      </mesh>
      {/* under-glow strip */}
      <mesh position={[0, -0.34, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 2.2]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={0.5} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* seat + rider silhouette */}
      <mesh castShadow position={[0, 0.42, -0.35]}>
        <boxGeometry args={[0.5, 0.18, 0.9]} />
        <meshStandardMaterial color="#3A2E22" flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.78, -0.28]} rotation={[0.32, 0, 0]}>
        <capsuleGeometry args={[0.21, 0.5, 3, 6]} />
        <meshStandardMaterial color="#8A5A34" flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.14, 0.02]}>
        <sphereGeometry args={[0.19, 8, 6]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      <mesh position={[0, 1.16, 0.16]}>
        <boxGeometry args={[0.28, 0.1, 0.12]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={1.2} />
      </mesh>
      {/* handlebar */}
      <mesh castShadow position={[0, 0.55, 0.65]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.1, 5]} />
        <meshStandardMaterial color="#3A2E22" flatShading />
      </mesh>
    </group>
  );
}

/**
 * LabBike — the shipping Driftline hover controller (see src/game/Bike.tsx)
 * with every tuned constant re-derived from the tuning store via effective()
 * at the top of each physics step, so sliders and upgrade ladders apply
 * same-frame. Fixed constants (hover height 1.25, spring 6.5, boost multi
 * ×1.8 accel / ×1.38 vMax, drift grip ×0.16, air gravity 17…) are copied
 * verbatim from the shipping controller — the bench tunes the opened
 * numbers, not the shape of the feel. Writes the shared lab telemetry.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { ground, groundNormal, surfaceAt, SPAWN, PLAY_RADIUS } from './terrain';
import { input, pollKeyboard, pollGamepad } from '../../../input/input';
import { audio } from '../../../audio/audio';
import { tele, addShake, clearRing } from './telemetry';
import { effective, useTuning, SURFACE_GRIP_KEY } from './params';

/* fixed shipping constants (never sliders) */
const HOVER = 1.25;
const SPRING = 6.5;
const BOOST_ACCEL = 1.8;
const BOOST_VMAX = 1.38;
const DRIFT_GRIP = 0.16;
const REWARD_CAP = 0.35;
const REWARD_RATE = 0.1;
/** shipping hop ceiling 11.5 m/s on an 8.6 impulse ≈ ×1.337 */
const HOP_CEIL = 1.337;

/* scratch — no per-frame allocations */
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qAlign = new THREE.Quaternion();
const _qLean = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _nVec = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _n = { x: 0, y: 1, z: 0 };

export default function LabBike() {
  const rb = useRef<RapierRigidBody>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);

  const ctrl = useRef({
    yaw: SPAWN.yaw,
    align: new THREE.Quaternion(),
    lean: 0,
    pitch: 0,
    boost: 1,
    driftTime: 0,
    wasDrifting: false,
    hopCooldown: 0,
    airTime: 0,
    resetToken: -1,
  });

  useBeforePhysicsStep(() => {
    const body = rb.current;
    if (!body) return;
    const c = ctrl.current;
    const dt = 1 / 60;
    const st = useTuning.getState();
    const e = effective(st.params, st.ladders);

    pollKeyboard();
    pollGamepad();

    /* ---------- reset ---------- */
    if (st.resetToken !== c.resetToken) {
      c.resetToken = st.resetToken;
      body.setTranslation({ x: SPAWN.x, y: ground(SPAWN.x, SPAWN.z) + 1.7, z: SPAWN.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      c.yaw = SPAWN.yaw;
      c.boost = 1;
      c.lean = 0;
      c.pitch = 0;
      c.driftTime = 0;
      c.wasDrifting = false;
      clearRing();
      audio.blip(660, 0.08);
    }

    const pos = body.translation();
    const vel = body.linvel();
    const g = ground(pos.x, pos.z);
    const surf = surfaceAt(pos.x, pos.z);
    const surfGrip = st.params[SURFACE_GRIP_KEY[surf]];

    const above = pos.y - g;
    c.hopCooldown = Math.max(0, c.hopCooldown - dt);
    const prevAir = c.airTime;
    const grounded = above < HOVER * 1.45 && c.hopCooldown <= 0;
    c.airTime = grounded ? 0 : c.airTime + dt;

    /* ---------- steering (shipping falloff shape) ---------- */
    const speed = Math.hypot(vel.x, vel.z);
    const steerRate = e.steer / (1 + speed / 30);
    c.yaw -= input.steer * steerRate * dt * (grounded ? 1 : 0.45);
    _fwd.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));

    /* ---------- boost & drift ---------- */
    const drifting = grounded && input.brake > 0.5 && Math.abs(input.steer) > 0.25 && speed > 7;
    if (drifting) {
      c.driftTime += dt;
      c.wasDrifting = true;
    } else if (c.wasDrifting) {
      // boost-on-exit reward
      const reward = Math.min(REWARD_CAP, c.driftTime * REWARD_RATE);
      if (reward > 0.04) {
        c.boost = Math.min(1, c.boost + reward);
        const kick = Math.min(e.driftKick * 1.875, c.driftTime * e.driftKick);
        body.applyImpulse({ x: _fwd.x * kick, y: 0, z: _fwd.z * kick }, true);
        tele.lastReward = reward;
        tele.lastKick = kick;
        tele.rewardStamp = performance.now() / 1000;
        audio.blip(520, 0.1);
      }
      c.wasDrifting = false;
      c.driftTime = 0;
    }
    const boosting = input.boost && c.boost > 0.02 && input.throttle > 0;
    if (boosting) c.boost = Math.max(0, c.boost - dt * e.drain);
    else c.boost = Math.min(1, c.boost + dt * (e.regen + (grounded ? 0 : 0.01)));

    /* ---------- throttle / thrust ---------- */
    const accel = e.accel * (boosting ? BOOST_ACCEL : 1);
    const vMax = e.vMax * (boosting ? BOOST_VMAX : 1);

    let vx = vel.x;
    let vy = vel.y;
    let vz = vel.z;

    if (grounded) {
      const fdot = vx * _fwd.x + vz * _fwd.z;
      const push = input.throttle * accel * (1 - Math.max(0, fdot) / vMax);
      vx += _fwd.x * push * dt;
      vz += _fwd.z * push * dt;
      if (input.brake > 0 && !drifting) {
        const b = Math.min(0.12 * input.brake, 1);
        vx -= vx * b;
        vz -= vz * b;
      }
      // lateral grip — painted zones get their grip from the tuning store
      const latX = vx - _fwd.x * fdot;
      const latZ = vz - _fwd.z * fdot;
      const grip = e.gripScale * surfGrip * (drifting ? DRIFT_GRIP : 1);
      const keep = Math.exp(-grip * dt);
      vx -= latX * (1 - keep);
      vz -= latZ * (1 - keep);
      const drag = Math.exp(-0.55 * dt);
      vx *= drag;
      vz *= drag;

      // ride-height spring (shipping shape)
      const targetY = g + HOVER;
      const wantVy = THREE.MathUtils.clamp((targetY - pos.y) * SPRING, -14, 13);
      vy = vy * 0.22 + wantVy * 0.78;

      if (input.hop && c.hopCooldown <= 0) {
        input.hop = false;
        vy = Math.min(vy + e.hop, e.hop * HOP_CEIL);
        c.hopCooldown = 0.28;
        addShake(0.12);
        audio.blip(300, 0.08);
      }
    } else {
      // airborne: gravity + light drag + air control
      vy -= 17 * dt;
      vx *= Math.exp(-0.12 * dt);
      vz *= Math.exp(-0.12 * dt);
      if (input.throttle > 0) {
        vx += _fwd.x * accel * 0.18 * dt;
        vz += _fwd.z * accel * 0.18 * dt;
      }
    }

    // soft circular bound just outside the pylon ring
    const lim = PLAY_RADIUS + 4;
    const rr = Math.hypot(pos.x, pos.z);
    if (rr > lim) {
      const push = (rr - lim) * 0.9 * dt * 60;
      vx += (-pos.x / rr) * push * dt * 8;
      vz += (-pos.z / rr) * push * dt * 8;
    }

    body.setLinvel({ x: vx, y: vy, z: vz }, true);

    if (grounded && prevAir > 0.55) {
      addShake(Math.min(0.5, 0.12 + prevAir * 0.2));
      audio.thud(Math.min(1, prevAir * 0.5));
    }

    /* ---------- rotation (manual, smoothed) ---------- */
    groundNormal(pos.x, pos.z, _n);
    _nVec.set(_n.x, _n.y, _n.z);
    _qAlign.setFromUnitVectors(_up, grounded ? _nVec : _up);
    c.align.slerp(_qAlign, grounded ? Math.min(1, 10 * dt) : Math.min(1, 2.5 * dt));

    const leanTarget = grounded ? input.steer * (drifting ? 0.34 : 0.2) : 0;
    c.lean += (leanTarget - c.lean) * Math.min(1, 8 * dt);
    const pitchTarget = grounded
      ? input.throttle * -0.07 + Math.max(0, vy) * 0.01
      : THREE.MathUtils.clamp(-vy * 0.02, -0.3, 0.3);
    c.pitch += (pitchTarget - c.pitch) * Math.min(1, 6 * dt);

    _axis.set(0, 0, 1);
    _qLean.setFromAxisAngle(_axis, c.lean);
    _axis.set(1, 0, 0);
    _qPitch.setFromAxisAngle(_axis, c.pitch);
    _qYaw.setFromAxisAngle(_up, c.yaw);
    _q.copy(c.align).multiply(_qYaw).multiply(_qPitch).multiply(_qLean);
    body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);

    /* ---------- telemetry + audio ---------- */
    const fdot2 = vx * _fwd.x + vz * _fwd.z;
    const latX2 = vx - _fwd.x * fdot2;
    const latZ2 = vz - _fwd.z * fdot2;
    tele.x = pos.x;
    tele.y = pos.y;
    tele.z = pos.z;
    tele.yaw = c.yaw;
    tele.speed = Math.hypot(vx, vz);
    tele.boost = c.boost;
    tele.boosting = boosting;
    tele.grounded = grounded;
    tele.drifting = drifting;
    tele.driftTime = drifting ? c.driftTime : 0;
    tele.rewardLive = drifting ? Math.min(1, Math.min(REWARD_CAP, c.driftTime * REWARD_RATE) / REWARD_CAP) : 0;
    tele.slipDeg = Math.atan2(Math.hypot(latX2, latZ2), Math.max(2, Math.abs(fdot2))) * (180 / Math.PI);
    tele.surface = surf;

    if (audio.ready) audio.updateVehicle(tele.speed, input.throttle, boosting);
  });

  // engine glow follows speed/boost
  useFrame(() => {
    if (glow.current) {
      glow.current.emissiveIntensity =
        0.9 + Math.min(1, tele.speed / 30) * 1.6 + (tele.boosting ? 1.6 : 0);
    }
  });

  return (
    <RigidBody
      ref={rb}
      colliders={false}
      position={[SPAWN.x, ground(SPAWN.x, SPAWN.z) + 1.7, SPAWN.z]}
      linearDamping={0.02}
      angularDamping={4}
      ccd
      onCollisionEnter={() => {
        if (tele.speed > 9) {
          addShake(Math.min(0.6, tele.speed * 0.02));
          audio.thud(Math.min(1, tele.speed * 0.03));
        }
      }}
    >
      <CuboidCollider args={[1.25, 0.42, 0.55]} restitution={0.25} friction={0.4} />
      <BikeModel glowRef={glow} />
    </RigidBody>
  );
}

function BikeModel({ glowRef }: { glowRef: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  return (
    <group position={[0, 0.12, 0]}>
      {/* hull — shipping rust, bone cowl, teal under-glow */}
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.85, 0.42, 2.6]} />
        <meshStandardMaterial color="#B3502E" flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.02, 1.55]} rotation={[0.24, 0, 0]}>
        <boxGeometry args={[0.6, 0.3, 0.9]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 0.62, 0, 1.0]} rotation={[0, s * 0.34, 0]}>
          <boxGeometry args={[0.7, 0.1, 1.1]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} castShadow position={[s * 0.58, -0.02, -0.9]}>
          <boxGeometry args={[0.34, 0.3, 1.1]} />
          <meshStandardMaterial color="#5C4632" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.02, -1.55]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.24]} />
        <meshStandardMaterial ref={glowRef} color="#FFB454" emissive="#FFB454" emissiveIntensity={1.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.34, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 2.2]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={0.5} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
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
      <mesh castShadow position={[0, 0.55, 0.65]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.1, 5]} />
        <meshStandardMaterial color="#3A2E22" flatShading />
      </mesh>
    </group>
  );
}

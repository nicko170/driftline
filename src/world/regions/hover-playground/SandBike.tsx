/**
 * Sandbox bike — the same arcade hover controller as the shipping game,
 * but every constant comes from the tuning store and is read fresh every
 * physics step (sliders apply same-frame). `resetToken` teleports home.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { ground, groundNormal, surfaceAt, SPAWN, PLAY_RADIUS } from './terrain';
import { input, pollKeyboard, pollGamepad } from '../../../input/input';
import { audio } from '../../../audio/audio';
import { labTelemetry, addLabShake } from './telemetry';
import { useTuning } from './params';

/* scratch — no per-frame allocations */
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qAlign = new THREE.Quaternion();
const _qLean = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3();
const _nVec = new THREE.Vector3();
const _n = { x: 0, y: 1, z: 0 };

export default function SandBike() {
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
    const p = useTuning.getState().params;
    const token = useTuning.getState().resetToken;

    pollKeyboard();
    pollGamepad();

    /* ---------- reset ---------- */
    if (token !== c.resetToken) {
      c.resetToken = token;
      body.setTranslation({ x: SPAWN.x, y: ground(SPAWN.x, SPAWN.z) + 1.7, z: SPAWN.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      c.yaw = SPAWN.yaw;
      c.boost = 1;
      c.lean = 0;
      c.pitch = 0;
      audio.blip(660, 0.08);
    }

    const pos = body.translation();
    const vel = body.linvel();
    const g = ground(pos.x, pos.z);
    const surf = surfaceAt(pos.x, pos.z);

    const above = pos.y - g;
    c.hopCooldown = Math.max(0, c.hopCooldown - dt);
    const grounded = above < p.hover * 1.45 && c.hopCooldown <= 0;
    c.airTime = grounded ? 0 : c.airTime + dt;

    /* ---------- steering ---------- */
    const speed = Math.hypot(vel.x, vel.z);
    const steerRate = p.steer / (1 + speed / 30);
    c.yaw -= input.steer * steerRate * dt * (grounded ? 1 : 0.45);
    _fwd.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));

    /* ---------- boost & drift ---------- */
    const drifting = grounded && input.brake > 0.5 && Math.abs(input.steer) > 0.25 && speed > 7;
    if (drifting) {
      c.driftTime += dt;
      c.wasDrifting = true;
    } else if (c.wasDrifting) {
      const reward = Math.min(0.35, c.driftTime * 0.1);
      if (reward > 0.04) {
        c.boost = Math.min(1, c.boost + reward);
        const kick = Math.min(p.driftKick * 1.9, c.driftTime * p.driftKick);
        body.applyImpulse({ x: _fwd.x * kick, y: 0, z: _fwd.z * kick }, true);
        audio.blip(520, 0.1);
      }
      c.wasDrifting = false;
      c.driftTime = 0;
    }
    const boosting = input.boost && c.boost > 0.02 && input.throttle > 0;
    if (boosting) c.boost = Math.max(0, c.boost - dt * p.boostDrain);
    else c.boost = Math.min(1, c.boost + dt * (p.boostRegen + (grounded ? 0 : 0.01)));

    /* ---------- thrust / grip ---------- */
    const accel = p.accel * (boosting ? p.boostMulti : 1);
    const vMax = p.vMax * (boosting ? 1.38 : 1);

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
      // lateral grip (glass lane is slick; drift slashes grip)
      const latX = vx - _fwd.x * (vx * _fwd.x + vz * _fwd.z);
      const latZ = vz - _fwd.z * (vx * _fwd.x + vz * _fwd.z);
      const grip = p.grip * surf.grip * (drifting ? p.driftGrip : 1);
      const keep = Math.exp(-grip * dt);
      vx -= latX * (1 - keep);
      vz -= latZ * (1 - keep);
      const drag = Math.exp(-0.55 * dt);
      vx *= drag;
      vz *= drag;

      // ride-height spring
      const targetY = g + p.hover;
      const wantVy = THREE.MathUtils.clamp((targetY - pos.y) * p.spring, -16, 15);
      vy = vy * (1 - p.damp) + wantVy * p.damp;

      if (input.hop && c.hopCooldown <= 0) {
        input.hop = false;
        vy = Math.min(vy + p.hop, p.hop * 1.35);
        c.hopCooldown = 0.28;
        addLabShake(0.12);
        audio.blip(300, 0.08);
      }
    } else {
      // airborne: manual gravity, light drag, air control
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

    if (grounded && c.airTime > 0.55) {
      addLabShake(Math.min(0.5, 0.12 + c.airTime * 0.2));
      audio.thud(Math.min(1, c.airTime * 0.5));
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
    labTelemetry.x = pos.x;
    labTelemetry.y = pos.y;
    labTelemetry.z = pos.z;
    labTelemetry.yaw = c.yaw;
    labTelemetry.speed = Math.hypot(vx, vz);
    labTelemetry.boost = c.boost;
    labTelemetry.boosting = boosting;
    labTelemetry.grounded = grounded;
    labTelemetry.drifting = drifting;
    labTelemetry.driftTime = drifting ? c.driftTime : 0;
    labTelemetry.slipDeg = Math.atan2(Math.hypot(latX2, latZ2), Math.max(2, Math.abs(fdot2))) * (180 / Math.PI);
    labTelemetry.surface = surf.kind;

    if (audio.ready) audio.updateVehicle(labTelemetry.speed, input.throttle, boosting);
  });

  // engine glow follows speed/boost
  useFrame(() => {
    if (glow.current) {
      glow.current.emissiveIntensity =
        0.9 + Math.min(1, labTelemetry.speed / 30) * 1.6 + (labTelemetry.boosting ? 1.6 : 0);
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
        if (labTelemetry.speed > 9) {
          addLabShake(Math.min(0.6, labTelemetry.speed * 0.02));
          audio.thud(Math.min(1, labTelemetry.speed * 0.03));
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
      {/* hull */}
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.85, 0.42, 2.6]} />
        <meshStandardMaterial color="#B3502E" flatShading />
      </mesh>
      {/* nose + fins */}
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
      {/* under-glow */}
      <mesh position={[0, -0.34, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 2.2]} />
        <meshStandardMaterial color="#57C4B8" emissive="#57C4B8" emissiveIntensity={0.5} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* seat + rider */}
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

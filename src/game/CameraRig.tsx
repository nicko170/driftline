/**
 * Chase camera: smooth follow, speed FOV, subtle shake (respects accessibility
 * setting), projects the active waypoint to NDC for the HUD marker.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { telemetry } from '../telemetry';
import { useSaveStore, useGameStore } from '../state/store';

const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _mark = new THREE.Vector3();

export default function CameraRig() {
  const { camera } = useThree();
  const vel = useRef(new THREE.Vector3(0, 0, 0));
  const lookVel = useRef(new THREE.Vector3(0, 0, 0));
  const initialized = useRef(false);

  useFrame((state, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const reducedShake = useSaveStore.getState().settings.reducedShake;
    const game = useGameStore.getState();

    const h = telemetry.heading;
    _fwd.set(Math.sin(h), 0, Math.cos(h));

    const speed = telemetry.speed;
    const dist = 7.2 + Math.min(4.5, speed * 0.075);
    const height = 2.6 + Math.min(1.2, speed * 0.02);

    _target.set(telemetry.x - _fwd.x * dist, telemetry.y + height, telemetry.z - _fwd.z * dist);

    if (!initialized.current) {
      cam.position.copy(_target);
      initialized.current = true;
    } else {
      // critically-damped-ish smoothing
      const k = 1 - Math.exp(-4.2 * dt);
      cam.position.lerp(_target, k);
    }

    // shake (decays)
    telemetry.shake = Math.max(0, telemetry.shake - dt * 2.2);
    if (!reducedShake && telemetry.shake > 0.001) {
      const s = telemetry.shake * 0.24;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }

    _look.set(telemetry.x + _fwd.x * 7, telemetry.y + 1.4 + speed * 0.012, telemetry.z + _fwd.z * 7);
    const lk = 1 - Math.exp(-6 * dt);
    lookVel.current.lerp(_look, lk);
    cam.lookAt(lookVel.current);

    // speed FOV + boost kick
    const targetFov = 60 + Math.min(13, speed * 0.24) * (telemetry.boosting ? 1.25 : 1);
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * Math.min(1, 5 * dt);
      cam.updateProjectionMatrix();
    }

    // project active waypoint for HUD (MissionDirector maintains it; follows NPCs)
    const objPoint = game.activeMissionId ? telemetry.objective : null;
    if (objPoint) {
      _mark.set(objPoint.x, objPoint.y + 3.5, objPoint.z).project(cam);
      telemetry.marker.x = THREE.MathUtils.clamp((_mark.x + 1) / 2, 0.04, 0.96);
      telemetry.marker.y = THREE.MathUtils.clamp((1 - _mark.y) / 2, 0.06, 0.9);
      telemetry.marker.behind = _mark.z > 1;
    } else {
      telemetry.marker.behind = true;
    }
    void state;
    void vel;
  });

  return null;
}

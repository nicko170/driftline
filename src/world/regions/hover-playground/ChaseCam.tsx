/** Chase camera for the sandbox: follow, speed FOV, subtle decaying shake. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { labTelemetry } from './telemetry';

const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export default function ChaseCam() {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const t = labTelemetry;
    labTelemetry.shake = Math.max(0, labTelemetry.shake - dt * 2.2);

    _fwd.set(Math.sin(t.yaw), 0, Math.cos(t.yaw));
    const dist = 7.4 + Math.min(4.5, t.speed * 0.075);
    const height = 2.7 + Math.min(1.2, t.speed * 0.02);
    _target.set(t.x - _fwd.x * dist, t.y + height, t.z - _fwd.z * dist);

    if (!initialized.current) {
      cam.position.copy(_target);
      look.current.set(t.x, t.y + 1.4, t.z);
      initialized.current = true;
    } else {
      cam.position.lerp(_target, 1 - Math.exp(-4.4 * dt));
    }

    if (labTelemetry.shake > 0.001) {
      const s = labTelemetry.shake * 0.22;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }

    _look.set(t.x + _fwd.x * 7, t.y + 1.4 + t.speed * 0.012, t.z + _fwd.z * 7);
    look.current.lerp(_look, 1 - Math.exp(-6 * dt));
    cam.lookAt(look.current);

    const targetFov = 58 + Math.min(14, t.speed * 0.26) * (t.boosting ? 1.22 : 1);
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * Math.min(1, 5 * dt);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

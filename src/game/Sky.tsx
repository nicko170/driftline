/**
 * Sky, sun and the day/night cycle. A slow clock advances unless paused;
 * palette lerps across dawn → day → dusk → night. Exposes `sky` for props that
 * care (lamps etc. have constant emissive — cheap already).
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useGameStore } from '../state/store';
import { telemetry } from '../telemetry';

/** 0..1, 0.30 = mid-morning at spawn. Advances slowly. */
export const sky = { t: 0.32 };

const DAY_LEN = 14 * 60; // seconds per full cycle

// keyframes: [t, skyTop, horizon, fog, sunColor, sunIntensity, ambient]
const KEYS: [number, string, string, string, string, number, number][] = [
  [0.0, '#14101F', '#2A2140', '#241C33', '#8899DD', 0.25, 0.5],  // night
  [0.22, '#1B1730', '#4A2E55', '#332847', '#C9A2FF', 0.3, 0.55], // pre-dawn
  [0.28, '#7E5A8C', '#E8915A', '#D9A08A', '#FFB454', 1.1, 0.7],  // dawn
  [0.36, '#87B8C4', '#E8D5AE', '#DCC7A0', '#FFF2D8', 1.6, 0.85], // morning
  [0.5, '#7FB4BE', '#E4D7BE', '#D9C6A2', '#FFEDC4', 1.7, 0.9],   // midday
  [0.66, '#8FAEC0', '#E0C090', '#CFB490', '#FFE8C0', 1.4, 0.8],  // afternoon
  [0.78, '#6E4E78', '#E07B4A', '#C98A6E', '#FF9E5A', 1.1, 0.7],  // dusk
  [0.86, '#2A2140', '#6E3E5C', '#4A3552', '#D07B5A', 0.5, 0.55], // twilight
];

const _skyTop = new THREE.Color();
const _horizon = new THREE.Color();
const _fog = new THREE.Color();
const _sun = new THREE.Color();
const _bg = new THREE.Color();
const _sandHaze = new THREE.Color('#C98F4E');
let stormFog = 0; // smoothed 0..1

function sampleSky(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1] ?? KEYS[0];
  let span = b[0] - a[0];
  if (span <= 0) span += 1;
  let local = t - a[0];
  if (local < 0) local += 1;
  const f = Math.min(1, local / span);
  _skyTop.set(a[1]).lerp(new THREE.Color(b[1]), f);
  _horizon.set(a[2]).lerp(new THREE.Color(b[2]), f);
  _fog.set(a[3]).lerp(new THREE.Color(b[3]), f);
  _sun.set(a[4]).lerp(new THREE.Color(b[4]), f);
  return { sunI: a[5] + (b[5] - a[5]) * f, ambI: a[6] + (b[6] - a[6]) * f };
}

export function nightFactor(): number {
  // 1 at deep night, 0 in day
  const t = sky.t;
  const d = Math.min(Math.abs(t - 0.02), Math.abs(t - 1.02));
  return Math.max(0, 1 - d * 6);
}

export default function Sky() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();

  useFrame((_, dt) => {
    if (!useGameStore.getState().physicsPaused) {
      sky.t = (sky.t + dt / DAY_LEN) % 1;
    }
    const { sunI, ambI } = sampleSky(sky.t);

    // storm haze: fog thickens and goes sand-coloured as the wall closes in
    const stormTarget = telemetry.storm ? Math.min(1, Math.max(0, 1 - telemetry.storm.dist / 500)) : 0;
    stormFog += (stormTarget - stormFog) * Math.min(1, 2.5 * dt);
    if (stormFog > 0.003) {
      _fog.lerp(_sandHaze, stormFog * 0.75);
      _horizon.lerp(_sandHaze, stormFog * 0.6);
    }

    // background + fog
    _bg.copy(_skyTop).lerp(_horizon, 0.35);
    scene.background = _bg;
    if (!scene.fog) scene.fog = new THREE.FogExp2(_fog.getHex(), 0.0018);
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(_fog);
    fog.density = 0.0013 + nightFactor() * 0.0009 + stormFog * 0.0042;

    if (sun.current) {
      // sun circles the world; snapped to the player so shadows stay crisp
      const elev = Math.sin((sky.t - 0.25) * Math.PI * 2) * 0.9 + 0.25;
      const azim = (sky.t - 0.25) * Math.PI * 2;
      const dist = 260;
      sun.current.position.set(
        telemetry.x + Math.cos(azim) * dist,
        60 + Math.max(0.05, elev) * 220,
        telemetry.z + Math.sin(azim) * dist * 0.6,
      );
      sun.current.target.position.set(telemetry.x, telemetry.y, telemetry.z);
      sun.current.target.updateMatrixWorld();
      sun.current.intensity = sunI * Math.max(0.15, Math.min(1, elev + 0.4));
      (sun.current.color as THREE.Color).copy(_sun);
    }
    if (hemi.current) {
      hemi.current.intensity = 0.22 + ambI * 0.34;
      (hemi.current.color as THREE.Color).copy(_skyTop).lerp(new THREE.Color('#FFFFFF'), 0.4);
      (hemi.current.groundColor as THREE.Color).set('#B07C3A').lerp(_fog, 0.4);
    }
  });

  return (
    <group>
      <hemisphereLight ref={hemi} intensity={0.5} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-near={10}
        shadow-camera-far={600}
        shadow-bias={-0.0006}
      />
      {nightFactor() > 0.25 && (
        <Stars radius={900} depth={80} count={3200} factor={5} saturation={0.15} fade speed={0.4} />
      )}
    </group>
  );
}

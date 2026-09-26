/**
 * Storm Wall Tuner — the stage.
 *
 * A fixed look-dev rail: ghost rider at the origin, the wall parked at
 * z = −(face + radius) facing the rider (+Z opening, the shipped
 * convention), tic posts every 100 m, and two live "reach" rings marking the
 * fog and tint ramp extents. The sky driver is a 1:1 port of the Sky.tsx
 * palette keyframes + storm-haze ramp so look-dev happens under the real
 * day/dusk/night and the real fog behaviour — just scrubbed, not ridden.
 *
 * Camera rigs: chase (the shipped viewpoint), orbit (art pass), top (tactical).
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { clamp01, fbm2, lerp } from '../../../lib/noise';
import { lab, rt, SHIPPED } from './state';
import { StormWall, WindStreaksRoot, PerfSampler, LAYER_WALL } from './Wall';

/* ================= sky mirror (keyframes copied 1:1 from src/game/Sky.tsx) ================= */

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
const _ground = new THREE.Color();
const _sandHaze = new THREE.Color(SHIPPED.fogColor);
const _w1 = new THREE.Color();
const _w2 = new THREE.Color();

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
  _skyTop.set(a[1]).lerp(_w1.set(b[1]), f);
  _horizon.set(a[2]).lerp(_w1.set(b[2]), f);
  _fog.set(a[3]).lerp(_w1.set(b[3]), f);
  _sun.set(a[4]).lerp(_w1.set(b[4]), f);
  return { sunI: a[5] + (b[5] - a[5]) * f, ambI: a[6] + (b[6] - a[6]) * f };
}

function nightFactorAt(t: number): number {
  const d = Math.min(Math.abs(t - 0.02), Math.abs(t - 1.02));
  return Math.max(0, 1 - d * 6);
}

/** Sun/sky/storm-haze + the staging director (face smoothing, squeeze run, tint). */
function SkyDriver() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2('#D9C6A2', 0.0015), []);
  useEffect(() => {
    scene.fog = fog;
    return () => { scene.fog = null; };
  }, [scene, fog]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    /* ---- staging director ---- */
    if (lab.squeeze) {
      rt.face = Math.max(0, rt.face - 46 * dt); // squeeze closes ~46 m/s (brisk cautious run)
      if (rt.face <= 0) lab.squeeze = false;
      lab.face = rt.face;
    } else {
      rt.face = lab.face;
    }
    rt.engulfed = rt.face <= 2;
    // shipped fog ramp: StormFog target lerps in with fogEase; tint is instant (HUD DOM style)
    const target = clamp01(1 - rt.face / lab.fogRange);
    rt.fogMix += (target - rt.fogMix) * Math.min(1, lab.fogEase * dt);
    rt.tint = Math.min(lab.tintCap, Math.max(0, 1 - rt.face / lab.tintRange) * lab.tintCap);

    /* ---- sky ---- */
    const { sunI, ambI } = sampleSky(lab.tod);
    _ground.set('#B07C3A').lerp(_fog, 0.4);

    // storm haze: shipped Sky.tsx ramp (sand-coloured fog + density bloom)
    if (rt.fogMix > 0.003) {
      _fog.lerp(_sandHaze, rt.fogMix * lab.skyLerp);
      _horizon.lerp(_sandHaze, rt.fogMix * lab.horizonLerp);
    }
    _bg.copy(_skyTop).lerp(_horizon, 0.35);
    scene.background = _bg;
    fog.color.copy(_fog);
    const base = 0.0013 + nightFactorAt(lab.tod) * 0.0009;
    fog.density = Math.max(0.0005, base + rt.fogMix * lab.fogBoost);

    if (sun.current) {
      const elev = Math.sin((lab.tod - 0.25) * Math.PI * 2) * 0.9 + 0.25;
      const azim = (lab.tod - 0.25) * Math.PI * 2;
      sun.current.position.set(Math.cos(azim) * 260, 60 + Math.max(0.05, elev) * 220, Math.sin(azim) * 260 * 0.6);
      sun.current.intensity = sunI * Math.max(0.15, Math.min(1, elev + 0.4));
      (sun.current.color as THREE.Color).copy(_sun);
    }
    if (hemi.current) {
      hemi.current.intensity = 0.22 + ambI * 0.34;
      (hemi.current.color as THREE.Color).copy(_skyTop).lerp(_w2.set('#FFFFFF'), 0.4);
      (hemi.current.groundColor as THREE.Color).copy(_ground);
    }
  });

  return (
    <group>
      <hemisphereLight ref={hemi} intensity={0.5} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
        shadow-camera-near={10}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
      />
      {nightFactorAt(lab.tod) > 0.25 && (
        <Stars radius={900} depth={80} count={3200} factor={5} saturation={0.15} fade speed={0.4} />
      )}
    </group>
  );
}

/* ================= ground / rail / set dressing ================= */

function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(1100, 96, 0, Math.PI * 2);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const salt = new THREE.Color('#E9E2D0');
    const sand = new THREE.Color('#D9A45B');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      // keep the rail pan flat; dunes rise past 260 m
      const dune = clamp01((r - 260) / 420);
      pos.setY(i, r > 4 ? fbm2(x * 0.008, z * 0.008, 3) * 14 * dune : 0);
      c.copy(salt).lerp(sand, clamp01(r / 520));
      const shade = 0.94 + fbm2(x * 0.03, z * 0.03, 2) * 0.06;
      colors[i * 3] = c.r * shade;
      colors[i * 3 + 1] = c.g * shade;
      colors[i * 3 + 2] = c.b * shade;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </mesh>
  );
}

/** Tic posts + base rings every 100 m down the rail, and the two live reach rings. */
function Rail() {
  const posts = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let k = 1; k <= 6; k++) arr.push([2.4, 1.6, -100 * k], [-2.4, 1.6, -100 * k]);
    return arr;
  }, []);
  const fogRing = useRef<THREE.Mesh>(null!);
  const tintRing = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    fogRing.current.position.z = -lab.fogRange;
    tintRing.current.position.z = -lab.tintRange;
  });
  return (
    <group>
      {posts.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.5, 3.2, 0.5]} />
          <meshStandardMaterial color="#E4D7BE" flatShading />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`r${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, -100 * (i + 1)]}>
          <ringGeometry args={[4.6, 5.2, 28]} />
          <meshBasicMaterial color="#B07C3A" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* amber diamond ring = fog reach, rust ring = tint reach (shape AND colour differ) */}
      <mesh ref={fogRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, -SHIPPED.fogRange]}>
        <ringGeometry args={[7.6, 8.4, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color="#FFB454" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={tintRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, -SHIPPED.tintRange]}>
        <ringGeometry args={[6.4, 7.0, 32]} />
        <meshBasicMaterial color="#B3502E" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SetDressing() {
  return (
    <group>
      {/* mesa silhouettes for scale + palette context against the wall */}
      <mesh position={[-300, 32, -560]} castShadow>
        <cylinderGeometry args={[42, 62, 70, 7]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      <mesh position={[-296, 74, -558]} castShadow>
        <cylinderGeometry args={[26, 40, 14, 7]} />
        <meshStandardMaterial color="#8A5335" flatShading />
      </mesh>
      <mesh position={[330, 24, -500]} castShadow>
        <cylinderGeometry args={[34, 52, 52, 6]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      {/* teal glass spires (fused-sand colour reference) */}
      {[[150, -320, 26], [166, -300, 16], [136, -296, 12]].map(([x, z, h], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow>
          <coneGeometry args={[4.5, h, 5]} />
          <meshStandardMaterial color="#2E8C8C" flatShading emissive="#57C4B8" emissiveIntensity={0.12} />
        </mesh>
      ))}
    </group>
  );
}

/** Ghost rider: shipped bike language (rust hull, bone spine, amber under-glow), hover-bobbed. */
function GhostRider() {
  const g = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current.position.y = 0.9 + Math.sin(t * Math.PI * 2 * 2) * 0.06; // idle bob ~2 Hz (DESIGN.md)
  });
  return (
    <group ref={g} position={[0, 0.9, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.1, 0.5, 3.2]} />
        <meshStandardMaterial color="#B3502E" flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.38, 1.2]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[0.7, 0.3, 1.4]} />
        <meshStandardMaterial color="#E4D7BE" flatShading />
      </mesh>
      <mesh position={[0, 0.42, -0.6]}>
        <boxGeometry args={[0.34, 0.22, 1.2]} />
        <meshStandardMaterial color="#7E3320" flatShading />
      </mesh>
      {/* amber under-glow plane (courier faction cue) */}
      <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, 3.6]} />
        <meshBasicMaterial color="#FFB454" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* rider */}
      <mesh castShadow position={[0, 0.62, -0.6]}>
        <capsuleGeometry args={[0.22, 0.5, 3, 6]} />
        <meshStandardMaterial color="#5C4632" flatShading />
      </mesh>
    </group>
  );
}

/* ================= camera rigs ================= */

function Rig() {
  const { camera } = useThree();
  const pos = useMemo(() => new THREE.Vector3(0, 8.5, 30), []);
  const look = useMemo(() => new THREE.Vector3(0, 30, -200), []);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);

  // main camera must see the storm isolation layer
  useEffect(() => {
    camera.layers.enable(LAYER_WALL);
    return () => camera.layers.disable(LAYER_WALL);
  }, [camera]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const d = rt.face + lab.radius; // wall centre distance from rider
    if (lab.rig === 'chase') {
      targetPos.set(Math.sin(t * 0.21) * 1.2, 8.5 + Math.sin(t * 0.33) * 0.4, 30);
      targetLook.set(0, Math.min(70, 18 + d * 0.06), -Math.max(60, d * 0.82));
    } else if (lab.rig === 'orbit') {
      const az = t * 0.07;
      const r = Math.max(170, d * 0.95 + 90);
      targetPos.set(Math.sin(az) * r, 62, -d + Math.cos(az) * r * 0.7);
      targetLook.set(0, 60, -d);
    } else {
      targetPos.set(0, 640, -d / 2 + 40);
      targetLook.set(0, 0, -d / 2 + 40 - 0.01);
    }
    camera.up.set(0, lab.rig === 'top' ? 0 : 1, lab.rig === 'top' ? -1 : 0);
    const k = 1 - Math.exp(-dt * 2.4);
    pos.lerp(targetPos, k);
    look.lerp(targetLook, k);
    camera.position.copy(pos);
    camera.lookAt(look);
  });
  return null;
}

/* ================= scene root ================= */

export function TunerScene() {
  return (
    <group>
      <SkyDriver />
      <Ground />
      <Rail />
      <SetDressing />
      <GhostRider />
      <StormWall />
      <WindStreaksRoot />
      <PerfSampler />
      <Rig />
    </group>
  );
}

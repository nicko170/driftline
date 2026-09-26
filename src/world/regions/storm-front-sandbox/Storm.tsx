/**
 * Storm Front Sandbox — the wall itself + the hunting director.
 *
 * Hunting math mirrors src/game/MissionDirector.tsx 1:1 (base speed +
 * rubber-band, face = centre-dist − R, kill at face ≤ 0, shelter at the arch,
 * no slow gate) with every constant live from `lab`. On top sits the upgrade
 * path being tuned here: a churning particle sheet on the face, taller
 * shells, turbulence wobble, and wind streaks that scream past the rider.
 * All buffers are module-scoped; the frame loop allocates nothing.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clamp01, lerp } from '../../../lib/noise';
import { bike, lab, panHeight, recallStorm, releaseStorm, setMessage, shelter, sim, stats, storm, SHIPPED } from './state';
import { chime, driveStormAudio } from './audio';

/* ================= director ================= */

function direct(dt: number) {
  const now = performance.now();

  if (storm.active) {
    const dx = bike.x - storm.x;
    const dz = bike.z - storm.z;
    const cd = Math.hypot(dx, dz) || 1;
    const face = cd - lab.radius;
    storm.face = face;
    // shipped hunting math: base speed + rubber-band kick on a big face
    const speed = lab.stormSpeed + Math.min(Math.max((face - 150) * lab.rubberband, 0), lab.catchCap);
    storm.speed = speed;
    storm.x += (dx / cd) * speed * dt;
    storm.z += (dz / cd) * speed * dt;
    storm.intensity = clamp01(1 - face / lab.feelRange);

    // margin (m/s): EMA of face delta
    stats.margin = lerp(stats.margin, (face - sim.prevFace) / Math.max(dt, 1e-4), 0.12);
    sim.prevFace = face;
    stats.runTime = (now - sim.runStartedAt) / 1000;

    // caught — face crosses the bike
    if (face <= 0) {
      stats.status = 'caught';
      setMessage('THE WALL TOOK YOU — DIGGING OUT…', 2.8);
      recallStorm();
      stats.status = 'caught';
      if (lab.autoRearm) sim.rearmAt = now + 3000;
      else sim.rearmAt = 0;
    }
  } else {
    storm.intensity = lerp(storm.intensity, 0, 1 - Math.exp(-dt * 2));
    stats.margin = lerp(stats.margin, 0, 0.1);
  }

  // shelter — dive for the arch, no slow gate
  const sd = Math.hypot(bike.x - shelter.x, bike.z - shelter.z);
  if (storm.active && sd < shelter.r) {
    const t = stats.runTime;
    stats.escapes += 1;
    if (stats.bestTime === 0 || t < stats.bestTime) stats.bestTime = t;
    setMessage(`SHELTERED — ${t.toFixed(1)}s`, 3.2);
    chime();
    recallStorm();
    stats.status = 'sheltered';
    if (lab.autoRearm) sim.rearmAt = now + 4200;
  }

  // auto re-arm
  if (!storm.active && lab.autoRearm && sim.rearmAt > 0 && now >= sim.rearmAt && stats.status !== 'hunt') {
    sim.rearmAt = 0;
    releaseStorm();
  }

  driveStormAudio(storm.intensity, clamp01(bike.speed / Math.max(lab.bikeTop, 1)), lab.density);
}

/* ================= the wall: shells + churn + particle sheet ================= */

const MAXP = 1500;

const SHEET_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAge;
  attribute vec3 aColor;
  uniform float uScale;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    float fade = 1.0 - aAge;
    vAlpha = fade * fade * uOpacity * step(aAge, 0.999);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (0.6 + aAge * 1.5) * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const SHEET_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float m = smoothstep(0.5, 0.18, length(d));
    if (vAlpha * m < 0.004) discard;
    gl_FragColor = vec4(vColor, vAlpha * m);
  }
`;

// sheet particle scratch (module-level, never reallocated)
const pPos = new Float32Array(MAXP * 3);
const pCol = new Float32Array(MAXP * 3);
const pSize = new Float32Array(MAXP);
const pAgeF = new Float32Array(MAXP);
const pAge = new Float32Array(MAXP).fill(1e9);
const pVel = new Float32Array(MAXP * 3);
const pSeed = new Float32Array(MAXP);
const pLife = new Float32Array(MAXP);
for (let i = 0; i < MAXP; i++) {
  pPos[i * 3 + 1] = -9999;
  pSeed[i] = i * 0.61;
}

const _cA = new THREE.Color('#D9A45B'); // sand bright
const _cB = new THREE.Color('#8A5335'); // rust deep
const _cT = new THREE.Color();

function sheetSpawn(i: number) {
  // local frame matches the shells: solid arc theta ∈ [π/2, 3π/2], opening +Z
  const R = lab.radius;
  const H = lab.wallHeight;
  const th = Math.PI * 0.5 + Math.random() * Math.PI;
  const rr = R * (0.82 + Math.pow(Math.random(), 1.4) * 0.34);
  const tangential = 7 + Math.random() * 11;
  pPos[i * 3] = rr * Math.sin(th);
  pPos[i * 3 + 1] = Math.pow(Math.random(), 1.6) * H * 0.92;
  pPos[i * 3 + 2] = rr * Math.cos(th);
  pVel[i * 3] = Math.cos(th) * tangential; // swirl: d(sinθ)/dt
  pVel[i * 3 + 1] = 1.5 + Math.random() * 6;
  pVel[i * 3 + 2] = -Math.sin(th) * tangential;
  pAge[i] = 0;
  pLife[i] = 1.1 + Math.random() * 1.6;
  pSize[i] = 5 + Math.random() * 9;
  const shade = 0.85 + Math.random() * 0.3;
  const mixT = Math.random();
  _cT.copy(_cA).lerp(_cB, mixT);
  pCol[i * 3] = _cT.r * shade;
  pCol[i * 3 + 1] = _cT.g * shade;
  pCol[i * 3 + 2] = _cT.b * shade;
}

function Sheet() {
  const data = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
    g.setAttribute('aAge', new THREE.BufferAttribute(pAgeF, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: SHEET_VERT,
      fragmentShader: SHEET_FRAG,
      uniforms: { uScale: { value: 800 }, uOpacity: { value: 0.6 } },
      transparent: true,
      depthWrite: false,
    });
    return { g, material };
  }, []);

  useFrame(({ size, gl }, dt) => {
    const d = data;
    const count = Math.min(MAXP, Math.floor(MAXP * clamp01(lab.density * 0.7 + 0.15)));
    const turb = lab.turbulence;
    const visible = storm.active || storm.intensity > 0.02;
    if (visible) {
      // top-up spawn: replace expired slots
      for (let i = 0; i < count; i++) {
        if (pAge[i] > pLife[i]) sheetSpawn(i);
      }
      const tt = performance.now() * 0.001;
      for (let i = 0; i < count; i++) {
        pAge[i] += dt;
        if (pAge[i] > pLife[i]) {
          pPos[i * 3 + 1] = -9999;
          pAgeF[i] = 1;
          continue;
        }
        if (turb > 0) {
          const s = pSeed[i];
          pVel[i * 3] += Math.sin(pPos[i * 3 + 1] * 0.11 + tt * 2.3 + s) * turb * 9 * dt;
          pVel[i * 3 + 1] += Math.cos(pPos[i * 3] * 0.08 - tt * 1.7 + s * 1.7) * turb * 5 * dt;
          pVel[i * 3 + 2] += Math.sin(pPos[i * 3 + 2] * 0.09 + tt * 2.0 + s * 0.7) * turb * 9 * dt;
        }
        pPos[i * 3] += pVel[i * 3] * dt;
        pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
        pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        if (pPos[i * 3 + 1] > lab.wallHeight) pAge[i] = pLife[i]; // shed off the top
        pAgeF[i] = pAge[i] / pLife[i];
      }
      for (let i = count; i < MAXP; i++) {
        if (pAge[i] <= pLife[i]) { pAge[i] = pLife[i] + 1; pPos[i * 3 + 1] = -9999; pAgeF[i] = 1; }
      }
    }
    (d.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (d.g.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (d.g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (d.g.attributes.aAge as THREE.BufferAttribute).needsUpdate = true;
    d.material.uniforms.uScale.value = size.height * gl.getPixelRatio() * 0.5;
    d.material.uniforms.uOpacity.value = 0.55 * lab.density;
  });

  return <points geometry={data.g} material={data.material} frustumCulled={false} />;
}

export function StormWall() {
  const root = useRef<THREE.Group>(null!);
  const shells = useRef<(THREE.Mesh | null)[]>([]);
  const skirt = useRef<THREE.Mesh>(null);
  const fpsEma = useRef(60);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    direct(dt);
    fpsEma.current = lerp(fpsEma.current, 1 / Math.max(rawDt, 1e-4), 0.05);
    stats.fps = fpsEma.current;

    const t = performance.now() * 0.001;
    const g = root.current;
    if (!storm.active && storm.intensity <= 0.02) {
      g.visible = false;
      return;
    }
    g.visible = true;

    // place + face the bike (same convention as the game: +Z opening → player)
    g.position.set(storm.x, panHeight(storm.x, storm.z) - 6, storm.z);
    g.rotation.y = Math.atan2(bike.x - storm.x, bike.z - storm.z);

    const R = lab.radius;
    const H = lab.wallHeight;
    const turb = lab.turbulence;
    const hScale = H / 200;
    shells.current.forEach((s, i) => {
      if (!s) return;
      // radius scales live via geometry rebuild? no — scale the mesh
      const rs = R / SHIPPED.radius;
      s.scale.set(rs * (1 + i * 0.16), hScale * (1 + i * 0.1), rs * (1 + i * 0.16));
      s.position.y = (30 + i * 8) * hScale;
      s.rotation.y = Math.sin(t * (0.12 + i * 0.07)) * (0.05 + turb * 0.16) + i * 0.2;
      const m = s.material as THREE.MeshBasicMaterial;
      m.opacity = (SHIPPED.shellOpacity[i] ?? 0.12) * lab.density * (0.92 + Math.sin(t * 3.1 + i * 2.2) * 0.04 * turb);
    });
    if (skirt.current) {
      const rs = R / SHIPPED.radius;
      skirt.current.scale.set(rs, 1, rs);
      skirt.current.rotation.y = -t * 0.22;
      (skirt.current.material as THREE.MeshBasicMaterial).opacity = 0.3 * lab.density;
    }
  });

  return (
    <group ref={root} visible={false}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { shells.current[i] = m; }}>
          <cylinderGeometry args={[SHIPPED.radius, SHIPPED.radius, 200, 36, 1, true, Math.PI * 0.5, Math.PI]} />
          <meshBasicMaterial
            color={SHIPPED.shellColors[i]}
            transparent
            opacity={SHIPPED.shellOpacity[i]}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* churn skirt hugging the ground */}
      <mesh ref={skirt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 6.5, 0]}>
        <ringGeometry args={[SHIPPED.radius * 0.68, SHIPPED.radius * 1.14, 40]} />
        <meshBasicMaterial color="#8A5335" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Sheet />
    </group>
  );
}

/* ================= wind streaks ================= */

const STREAKS = 320;
const sPos = new Float32Array(STREAKS * 3);
const sMul = new Float32Array(STREAKS);
{
  for (let i = 0; i < STREAKS; i++) {
    sPos[i * 3] = (Math.random() - 0.5) * 520;
    sPos[i * 3 + 1] = 2 + Math.random() * 90;
    sPos[i * 3 + 2] = (Math.random() - 0.5) * 520;
    sMul[i] = 0.7 + Math.random() * 0.7;
  }
}

export function WindStreaks() {
  const data = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    return { g };
  }, []);
  const matRef = useRef<THREE.PointsMaterial>(null!);

  useFrame(({ camera }, dt) => {
    if (!dt) return;
    const inten = storm.intensity;
    const on = lab.windStreaks;
    // wind blows from the storm toward the bike; ambient drift when calm
    let dx = bike.x - storm.x;
    let dz = bike.z - storm.z;
    const len = Math.hypot(dx, dz);
    if (!storm.active || len < 1) { dx = -0.25; dz = -1; }
    else { dx /= len; dz /= len; }
    const speed = (10 + 78 * inten) * sMulFn();
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    for (let i = 0; i < STREAKS; i++) {
      const v = speed * sMul[i];
      sPos[i * 3] += dx * v * dt;
      sPos[i * 3 + 2] += dz * v * dt;
      // wrap around the camera
      if (Math.abs(sPos[i * 3] - cx) > 280) sPos[i * 3] = cx - Math.sign(sPos[i * 3] - cx) * 280 + (Math.random() - 0.5) * 20;
      if (Math.abs(sPos[i * 3 + 2] - cz) > 280) sPos[i * 3 + 2] = cz - Math.sign(sPos[i * 3 + 2] - cz) * 280 + (Math.random() - 0.5) * 20;
      if (Math.abs(sPos[i * 3 + 1] - cy) > 120) sPos[i * 3 + 1] = 2 + Math.random() * 90 + cy * 0.3;
    }
    (data.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (matRef.current) matRef.current.opacity = on ? 0.06 + inten * 0.3 : 0;
  });

  return (
    <points geometry={data.g} frustumCulled={false}>
      <pointsMaterial ref={matRef} size={0.55} sizeAttenuation color="#E4D7BE" transparent opacity={0.1} depthWrite={false} />
    </points>
  );
}

let _mulCache = 1;
let _mulT = 0;
function sMulFn() {
  const now = performance.now();
  if (now - _mulT > 700) {
    _mulT = now;
    _mulCache = 0.9 + Math.random() * 0.25;
  }
  return _mulCache;
}

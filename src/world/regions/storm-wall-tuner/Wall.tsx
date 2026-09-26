/**
 * Storm Wall Tuner — the wall on rails.
 *
 * The shipped stack (3 nested open cylinder shells + churn band, from
 * MissionDirector.tsx) is rebuilt here with every look constant live from
 * `lab`: 1–5 shells with an inner→mid→outer colour ramp, opacity falloff,
 * wobble, an optional sandbox-style particle sheet, churn band, ground
 * skirt and wind streaks. No hunting director — the staging director in
 * Scene.tsx parks the wall at the scrubbed face distance.
 *
 * The whole wall renders on LAYER_WALL so the overdraw meter can render a
 * storm-only pass into a 64² target and read back real screen coverage and
 * composited alpha (stack-depth estimate). All buffers module-scoped; the
 * frame loop allocates nothing.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clamp01, lerp } from '../../../lib/noise';
import { FACE_MAX, lab, QUALITY, rt, SHIPPED, shellColorAt, shellOpacityAt, wallHeight } from './state';

export const LAYER_WALL = 7; // off the default layer so we can isolate the wall pass

const MAX_SHELLS = 5;
const MAXP = 1500;      // particle sheet cap (matches storm-front-sandbox budget)
const STREAKS = 320;    // wind streak cap

/* ================= the shells + churn + skirt ================= */

export function StormWall() {
  const root = useRef<THREE.Group>(null!);
  const shells = useRef<(THREE.Mesh | null)[]>([]);
  const churn = useRef<THREE.Mesh>(null);
  const skirt = useRef<THREE.Mesh>(null);
  const segKey = useRef(lab.segments);

  // put every wall mesh on the isolation layer (re-applied live — shells
  // remount when `segments` changes geometry)
  useEffect(() => {
    root.current.traverse((o) => o.layers.set(LAYER_WALL));
  });

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const n = lab.shells;
    const rs = lab.radius / SHIPPED.radius;
    const hScale = lab.heightScale;
    const g = root.current;
    g.position.set(0, -6, -(rt.face + lab.radius));
    g.traverse((o) => o.layers.set(LAYER_WALL)); // cheap: ≤ 9 nodes, keeps remounts isolated
    for (let i = 0; i < MAX_SHELLS; i++) {
      const s = shells.current[i];
      if (!s) continue;
      const on = i < n;
      s.visible = on;
      if (!on) continue;
      const den = n > 3 ? 0.92 : 1; // extra shells get a gentle radial pad
      s.scale.set(rs * (1 + i * SHIPPED.scaleStep * den), hScale * (1 + i * SHIPPED.heightStep), rs * (1 + i * SHIPPED.scaleStep * den));
      s.position.y = (SHIPPED.baseY + i * SHIPPED.yStep) * hScale;
      s.rotation.y = Math.sin(t * (0.12 + i * 0.07)) * (0.02 + lab.wobble * 0.18) + i * 0.2;
      const m = s.material as THREE.MeshBasicMaterial;
      m.color.set(shellColorAt(i, n));
      m.opacity = shellOpacityAt(i, n) * (0.94 + Math.sin(t * 3.1 + i * 2.2) * 0.06 * lab.wobble);
    }
    if (churn.current) {
      const m = churn.current.material as THREE.MeshBasicMaterial;
      churn.current.visible = lab.churn && QUALITY[lab.quality].churnSkirt;
      churn.current.scale.set(rs, 1, rs);
      churn.current.rotation.y = t * (0.1 + lab.wobble * 0.3);
      m.opacity = lab.churnOpacity * lab.density;
    }
    if (skirt.current) {
      const m = skirt.current.material as THREE.MeshBasicMaterial;
      skirt.current.visible = lab.skirt && QUALITY[lab.quality].churnSkirt;
      skirt.current.scale.set(rs, rs, 1);
      skirt.current.rotation.z = -t * (0.12 + lab.wobble * 0.14);
      m.opacity = 0.3 * lab.density;
    }
  });

  // keying shells on segments rebuilds the cylinder geometry on quality change
  if (segKey.current !== lab.segments) segKey.current = lab.segments;

  return (
    <group ref={root}>
      {Array.from({ length: MAX_SHELLS }, (_, i) => (
        <mesh key={`${i}-${segKey.current}`} ref={(m) => { shells.current[i] = m; }}>
          <cylinderGeometry args={[SHIPPED.radius, SHIPPED.radius, SHIPPED.heights, lab.segments, 1, true, Math.PI * 0.5, Math.PI]} />
          <meshBasicMaterial color={SHIPPED.colors[Math.min(i, 2)]} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* churn band hugging the ground (shipped: one open cylinder) */}
      <mesh ref={churn} position={[0, SHIPPED.churnHeight / 2, 0]}>
        <cylinderGeometry args={[SHIPPED.radius * 0.99, SHIPPED.radius * 1.01, SHIPPED.churnHeight, 36, 1, true, Math.PI * 0.5, Math.PI]} />
        <meshBasicMaterial color={SHIPPED.churnColor} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* ground skirt (upgrade path, off in shipped) */}
      <mesh ref={skirt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 6.5, 0]} visible={false}>
        <ringGeometry args={[SHIPPED.radius * 0.68, SHIPPED.radius * 1.14, 40]} />
        <meshBasicMaterial color="#8A5335" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Sheet />
    </group>
  );
}

/* ================= particle sheet (look-dev upgrade path) ================= */

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
  const H = wallHeight();
  const th = Math.PI * 0.5 + Math.random() * Math.PI;
  const rr = R * (0.82 + Math.pow(Math.random(), 1.4) * 0.34);
  const tangential = 7 + Math.random() * 11;
  pPos[i * 3] = rr * Math.sin(th);
  pPos[i * 3 + 1] = Math.pow(Math.random(), 1.6) * H * 0.92;
  pPos[i * 3 + 2] = rr * Math.cos(th);
  pVel[i * 3] = Math.cos(th) * tangential;
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
    const budget = QUALITY[lab.quality].sheetMax;
    const count = lab.sheet ? Math.min(budget, MAXP, Math.floor(lab.sheetCount)) : 0;
    const turb = lab.wobble;
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
      if (pPos[i * 3 + 1] > wallHeight()) pAge[i] = pLife[i];
      pAgeF[i] = pAge[i] / pLife[i];
    }
    for (let i = count; i < MAXP; i++) {
      if (pAge[i] <= pLife[i]) { pAge[i] = pLife[i] + 1; pPos[i * 3 + 1] = -9999; pAgeF[i] = 1; }
    }
    const d = data;
    (d.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (d.g.attributes.aAge as THREE.BufferAttribute).needsUpdate = true;
    d.material.uniforms.uScale.value = size.height * gl.getPixelRatio() * 0.5;
    d.material.uniforms.uOpacity.value = 0.55 * lab.density;
  });

  return <points geometry={data.g} material={data.material} frustumCulled={false} />;
}

/* ================= wind streaks (scaled by fog ramp, not by a hunting storm) ================= */

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

function WindStreaks() {
  const data = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    return { g };
  }, []);
  const matRef = useRef<THREE.PointsMaterial>(null!);
  const ptsRef = useRef<THREE.Points>(null!);

  useFrame(({ camera }, dt) => {
    if (ptsRef.current) ptsRef.current.layers.set(LAYER_WALL); // storm look — rides the isolation layer
    if (!dt) return;
    const n = lab.streaks ? QUALITY[lab.quality].streaks : 0;
    const inten = rt.fogMix; // wind picks up as the shipped fog ramp closes in
    // wind blows from the wall (+Z, toward the rider/camera)
    const speed = 10 + 78 * inten;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    for (let i = 0; i < STREAKS; i++) {
      const on = i < n;
      const v = on ? speed * sMul[i] : 0;
      sPos[i * 3 + 2] += v * dt;
      if (Math.abs(sPos[i * 3] - cx) > 280) sPos[i * 3] = cx + (Math.random() - 0.5) * 520;
      if (Math.abs(sPos[i * 3 + 2] - cz) > 280) sPos[i * 3 + 2] = cz - 280;
      if (sPos[i * 3 + 1] > cy + 120 || sPos[i * 3 + 1] < 0) sPos[i * 3 + 1] = 2 + Math.random() * 90 + cy * 0.3;
    }
    (data.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (matRef.current) matRef.current.opacity = n > 0 ? 0.06 + inten * 0.3 : 0;
  });

  return (
    <points ref={ptsRef} geometry={data.g} frustumCulled={false}>
      <pointsMaterial ref={matRef} size={0.55} sizeAttenuation color="#E4D7BE" transparent opacity={0.1} depthWrite={false} />
    </points>
  );
}

/** Scene-root streaks (world-space, camera-wrapped) — export so Scene can mount them outside the wall's transform. */
export function WindStreaksRoot() {
  return <WindStreaks />;
}

/* ================= overdraw meter =================
   Renders the scene storm-only (LAYER_WALL) into a 64² target and reads it
   back: coverage = painted pixel fraction, mean alpha = composited alpha over
   those pixels, stack depth ≈ log(1-A) / log(1-ᾱ) where ᾱ is the live mean
   per-layer opacity. Honest crib: per-layer alpha estimate, real coverage. */

function OverdrawMeter() {
  const target = useMemo(
    () => new THREE.WebGLRenderTarget(64, 64, { depthBuffer: true, generateMipmaps: false }),
    [],
  );
  const buf = useMemo(() => new Uint8Array(64 * 64 * 4), []);
  useEffect(() => () => target.dispose(), [target]);

  useFrame(({ gl, scene, camera }) => {
    const now = performance.now();
    if (!lab.measure || now - rt.lastMeasure < 400) return;
    rt.lastMeasure = now;

    const bg = scene.background;
    scene.background = null;
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    camera.layers.set(LAYER_WALL);
    gl.render(scene, camera);
    camera.layers.set(0);
    camera.layers.enable(LAYER_WALL);
    gl.setRenderTarget(null);
    scene.background = bg;
    gl.readRenderTargetPixels(target, 0, 0, 64, 64, buf);

    let covered = 0;
    let alphaSum = 0;
    for (let i = 0; i < 64 * 64; i++) {
      const a = buf[i * 4 + 3];
      if (a > 8) {
        covered++;
        alphaSum += a / 255;
      }
    }
    rt.samples++;
    rt.coverage = covered / (64 * 64);
    rt.meanAlpha = covered ? alphaSum / covered : 0;

    // mean per-layer alpha across the live stack (shells + churn + sheet budget share)
    let layers = 0;
    let sum = 0;
    for (let i = 0; i < lab.shells; i++) {
      layers++;
      sum += shellOpacityAt(i, lab.shells);
    }
    if (lab.churn && QUALITY[lab.quality].churnSkirt) {
      layers += 2; // churn band is double-sided, near-ground pixels often catch both faces
      sum += lab.churnOpacity * lab.density * 2;
    }
    const avg = layers > 0 ? sum / layers : 0;
    rt.avgLayerAlpha = avg;
    rt.stackEst =
      rt.meanAlpha > 0.001 && avg > 0.001 && avg < 0.99
        ? Math.log(1 - Math.min(rt.meanAlpha, 0.999)) / Math.log(1 - avg)
        : 0;
  });

  return null;
}

/** Perf sampler: reads renderer.info once per frame (last completed render). */
export function PerfSampler() {
  useFrame(({ gl }, rawDt) => {
    rt.fps = lerp(rt.fps, 1 / Math.max(rawDt, 1e-4), 0.05);
    rt.calls = gl.info.render.calls;
    rt.tris = gl.info.render.triangles;
  });
  return <OverdrawMeter />;
}

/** Park the wall at rail max on mount (bench always starts calm). */
export function WallDefaults() {
  useEffect(() => {
    rt.face = lab.face = Math.min(lab.face, FACE_MAX);
  }, []);
  return null;
}

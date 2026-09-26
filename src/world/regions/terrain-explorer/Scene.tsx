/**
 * Terrain Explorer scene — one world-grid mesh whose heights come from the
 * cached layer maps, recoloured per mode; route ribbons, region masks and a
 * reference grid sit on top. The whole terrain group carries the exaggeration
 * scale so overlays hug the (visual) ground.
 *
 * Performance: the noise maps build chunked over frames; layer/mode changes
 * only recombine + recolour in place (~10 ms at 224²). No per-frame allocations.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Grid, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { terrainHeight, vertexColor, surfaceAt } from '../../../lib/terrain';
import { clamp01, lerp } from '../../../lib/noise';
import {
  PLACEMENTS,
  GLASSROAD_PATH,
  WINDSPINE_LINE,
  WORLD_HALF,
  WORLD_SIZE,
} from '../../layout';
import {
  buildFieldMaps,
  combineAll,
  maxVertexDrift,
  sampleHeight,
} from './heightfield';
import type { FieldMaps } from './heightfield';
import { useExplorer } from './state';

/* ---------- module-scope field refs (shared by TerrainMesh / overlays) ---------- */
const field: { maps: FieldMaps | null; hmap: Float32Array | null } = { maps: null, hmap: null };
const pendingStats = { mapMs: 0, drift: 0 };
const EXACT_EPS = 1e-4; // f32 cache quantization is ~3e-6 m — visually and physically nothing
export const fieldIsExact = () =>
  useExplorer.getState().seed === 0 && pendingStats.drift < EXACT_EPS;

/* ---------- colours ---------- */

// hypsometric false-colour ramp (linear-ish sRGB floats), stops at elevations
const RAMP: [number, number, number, number][] = [
  [-30, 0.055, 0.23, 0.27], // canyon floor — deep teal ink
  [-8, 0.125, 0.45, 0.47], // teal
  [2, 0.953, 0.933, 0.886], // pan line — salt white
  [12, 0.894, 0.843, 0.745], // bone
  [24, 0.851, 0.643, 0.357], // sand
  [40, 0.69, 0.486, 0.227], // ochre
  [58, 0.702, 0.314, 0.18], // rust
  [78, 0.29, 0.235, 0.4], // violet stone
  [100, 0.77, 0.73, 0.87], // boundary crests — pale lavender
];
const BAND = 6; // metres per height band / contour interval

const SURFACE_COLORS: Record<string, [number, number, number]> = {
  salt: [0.96, 0.94, 0.9],
  sand: [0.82, 0.6, 0.33],
  glass: [0.22, 0.78, 0.72],
  rock: [0.64, 0.32, 0.2],
};

function rampColor(h: number, out: Float32Array, i: number): void {
  let a = RAMP[0];
  let b = RAMP[RAMP.length - 1];
  for (let s = 0; s < RAMP.length - 1; s++) {
    if (h < RAMP[s + 1][0]) {
      a = RAMP[s];
      b = RAMP[s + 1];
      break;
    }
  }
  const t = clamp01((h - a[0]) / Math.max(b[0] - a[0], 1e-6));
  out[i] = lerp(a[1], b[1], t);
  out[i + 1] = lerp(a[2], b[2], t);
  out[i + 2] = lerp(a[3], b[3], t);
}

const TMP3 = new Float32Array(3);

function buildIndex(res: number): THREE.BufferAttribute {
  const idx = new Uint32Array(res * res * 6);
  const n = res + 1;
  let p = 0;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
  }
  return new THREE.BufferAttribute(idx, 1);
}

/* ---------------- the terrain mesh ---------------- */

function TerrainMesh() {
  const layers = useExplorer((s) => s.layers);
  const mode = useExplorer((s) => s.mode);
  const contours = useExplorer((s) => s.contours);
  const res = useExplorer((s) => s.res);
  const seed = useExplorer((s) => s.seed);
  const mapsVersion = useExplorer((s) => s.mapsVersion);
  const setBuilding = useExplorer((s) => s.setBuilding);
  const bumpMaps = useExplorer((s) => s.bumpMaps);
  const bumpApplied = useExplorer((s) => s.bumpApplied);
  const setStats = useExplorer((s) => s.setStats);

  const meshRef = useRef<THREE.Mesh>(null);
  const genRef = useRef(0);

  // (re)build the cached noise/mask field when resolution or seed changes
  useEffect(() => {
    const gen = ++genRef.current;
    setBuilding(0);
    const t0 = performance.now();
    void buildFieldMaps(
      res,
      seed,
      (done, total) => {
        if (genRef.current === gen) setBuilding(done / total);
      },
      () => genRef.current !== gen,
    ).then((maps) => {
      if (!maps || genRef.current !== gen) return;
      field.maps = maps;
      field.hmap = new Float32Array(maps.n * maps.n);
      pendingStats.mapMs = performance.now() - t0;
      pendingStats.drift = maxVertexDrift(maps, 3);
      setBuilding(-1);
      bumpMaps();
    });
  }, [res, seed, setBuilding, bumpMaps]);

  // recombine heights + recolour (also runs right after fresh maps land)
  useEffect(() => {
    const maps = field.maps;
    const mesh = meshRef.current;
    const hmap = field.hmap;
    if (!maps || !mesh || !hmap) return;
    const t0 = performance.now();

    const n = maps.n;
    if (mesh.geometry instanceof THREE.BufferGeometry && (mesh.geometry.attributes.position?.count ?? 0) !== n * n) {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BufferGeometry();
    }
    let geo = mesh.geometry as THREE.BufferGeometry;
    if (!geo.attributes.position) {
      const pos = new Float32Array(n * n * 3);
      for (let k = 0; k < n * n; k++) {
        const i = k % n;
        const j = (k / n) | 0;
        pos[k * 3] = -WORLD_HALF + i * maps.step;
        pos[k * 3 + 1] = 0;
        pos[k * 3 + 2] = -WORLD_HALF + j * maps.step;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
      geo.setIndex(buildIndex(maps.res));
    }
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const cArr = col.array as Float32Array;

    const { min, max } = combineAll(maps, layers, hmap);
    const step = maps.step;

    for (let k = 0; k < n * n; k++) {
      const i = k % n;
      const j = (k / n) | 0;
      const x = -WORLD_HALF + i * step;
      const z = -WORLD_HALF + j * step;
      const h = hmap[k];
      pos.setY(k, h);

      // finite-difference slope |dh/dx| + |dh/dz|
      const il = i > 0 ? k - 1 : k;
      const ir = i < n - 1 ? k + 1 : k;
      const jd = j > 0 ? k - n : k;
      const ju = j < n - 1 ? k + n : k;
      const dx = (hmap[ir] - hmap[il]) / (2 * step);
      const dz = (hmap[ju] - hmap[jd]) / (2 * step);
      const slope = Math.abs(dx) + Math.abs(dz);

      const o = k * 3;
      if (mode === 'game') {
        vertexColor(x, z, h, slope, cArr, o); // shipped palette, verbatim
        if (contours) {
          const f = h / BAND;
          const fr = f - Math.floor(f);
          const d = Math.min(fr, 1 - fr);
          if (d < 0.04) {
            cArr[o] *= 0.55; cArr[o + 1] *= 0.55; cArr[o + 2] *= 0.55;
          }
        }
      } else if (mode === 'height') {
        const hq = (Math.floor(h / BAND) + 0.5) * BAND;
        rampColor(hq, cArr, o);
        // hillshade so relief still reads
        const ny = 1 / Math.sqrt(1 + dx * dx + dz * dz);
        let shade = 0.55 + 0.45 * ny;
        if (contours) {
          const f = h / BAND;
          const fr = f - Math.floor(f);
          const d = Math.min(fr, 1 - fr);
          if (d < 0.045) shade *= 0.42;
        }
        cArr[o] *= shade; cArr[o + 1] *= shade; cArr[o + 2] *= shade;
      } else {
        // surface grip map — game-real surfaceAt()
        const s = surfaceAt(x, z);
        const c = SURFACE_COLORS[s.kind] ?? SURFACE_COLORS.sand;
        const ny = 1 / Math.sqrt(1 + dx * dx + dz * dz);
        let shade = 0.6 + 0.4 * ny;
        if (contours) {
          const f = h / BAND;
          const fr = f - Math.floor(f);
          const d = Math.min(fr, 1 - fr);
          if (d < 0.045) shade *= 0.5;
        }
        cArr[o] = c[0] * shade; cArr[o + 1] = c[1] * shade; cArr[o + 2] = c[2] * shade;
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    setStats({
      verts: n * n,
      tris: maps.res * maps.res * 2,
      minH: min,
      maxH: max,
      mapMs: pendingStats.mapMs,
      applyMs: performance.now() - t0,
      drift: pendingStats.drift,
    });
    bumpApplied();
  }, [mapsVersion, layers, mode, contours, setStats, bumpApplied]);

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <bufferGeometry />
      <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
    </mesh>
  );
}

/* ---------------- route ribbons ---------------- */

interface RoutePt {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

function resampleRoute(line: [number, number][], stepLen = 14): RoutePt[] {
  const pts: RoutePt[] = [];
  let carried = 0;
  for (let s = 0; s < line.length - 1; s++) {
    const [ax, az] = line[s];
    const [bx, bz] = line[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    for (let d = carried; d < len; d += stepLen) {
      pts.push({ x: ax + ux * d, z: az + uz * d, dx: ux, dz: uz });
    }
    carried = stepLen - ((len - carried) % stepLen);
    if (carried >= stepLen) carried = 0;
    if (s === line.length - 2) pts.push({ x: bx, z: bz, dx: ux, dz: uz });
  }
  return pts;
}

function buildRibbon(pts: RoutePt[], width: number, lift: number): THREE.BufferGeometry | null {
  if (!field.maps || !field.hmap || pts.length < 2) return null;
  const maps = field.maps;
  const hmap = field.hmap;
  const w2 = width / 2;
  const pos = new Float32Array(pts.length * 2 * 3);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const px = -p.dz;
    const pz = p.dx;
    const o = i * 6;
    pos[o] = p.x + px * w2;
    pos[o + 1] = sampleHeight(maps, hmap, pos[o], p.z + pz * w2) + lift;
    pos[o + 2] = p.z + pz * w2;
    pos[o + 3] = p.x - px * w2;
    pos[o + 4] = sampleHeight(maps, hmap, pos[o + 3], p.z - pz * w2) + lift;
    pos[o + 5] = p.z - pz * w2;
  }
  const idx = new Uint32Array((pts.length - 1) * 6);
  let q = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    idx[q++] = a; idx[q++] = a + 1; idx[q++] = a + 2;
    idx[q++] = a + 1; idx[q++] = a + 3; idx[q++] = a + 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

function RouteRibbon({
  line,
  color,
  width = 8,
  lift = 3.2,
}: {
  line: [number, number][];
  color: string;
  width?: number;
  lift?: number;
}) {
  const appliedVersion = useExplorer((s) => s.appliedVersion);
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const pts = useMemo(() => resampleRoute(line), [line]);

  useEffect(() => {
    const next = buildRibbon(pts, width, lift);
    setGeo((prev) => {
      prev?.dispose();
      return next;
    });
  }, [pts, appliedVersion, width, lift]);

  if (!geo) return null;
  return (
    <mesh geometry={geo} renderOrder={2}>
      <meshBasicMaterial color={color} transparent opacity={0.82} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/* ---------------- region masks ---------------- */

const REGION_NAMES: Record<string, string> = {
  saltmouth: 'Saltmouth · hub',
  windspine: 'Windspine',
  glassroad: 'Glass Road',
  skydocks: 'Skydocks',
  cinderflats: 'Cinderflats',
  choirhollow: 'Choirhollow',
  'drowned-array': 'Drowned Array',
  mothersgate: "Mother's Gate",
};

function RegionMasks() {
  const appliedVersion = useExplorer((s) => s.appliedVersion);
  const showLabels = useExplorer((s) => s.showLabels);
  const [heights, setHeights] = useState<number[]>([]);

  useEffect(() => {
    if (!field.maps || !field.hmap) return;
    const maps = field.maps;
    const hmap = field.hmap;
    setHeights(
      PLACEMENTS.map((p) => {
        let m = -Infinity;
        for (let a = 0; a < 24; a++) {
          const t = (a / 24) * Math.PI * 2;
          const h = sampleHeight(
            maps,
            hmap,
            p.center[0] + Math.cos(t) * p.radius,
            p.center[1] + Math.sin(t) * p.radius,
          );
          if (h > m) m = h;
        }
        return m + 9;
      }),
    );
  }, [appliedVersion]);

  if (!heights.length) return null;
  return (
    <group>
      {PLACEMENTS.map((p, i) => {
        const y = heights[i];
        const hub = p.slug === 'saltmouth';
        const color = hub ? '#FFB454' : '#57C4B8';
        return (
          <group key={p.slug} position={[p.center[0], 0, p.center[1]]}>
            <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
              <ringGeometry args={[p.radius - 2.4, p.radius + 2.4, 72]} />
              <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
              <circleGeometry args={[p.radius - 2.4, 72]} />
              <meshBasicMaterial color={color} transparent opacity={0.045} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {/* marker beam at the region centre */}
            <mesh position={[0, y / 2, 0]}>
              <cylinderGeometry args={[0.8, 0.8, y, 6]} />
              <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
            </mesh>
            {showLabels && (
              <Html position={[0, y + 8, 0]} center zIndexRange={[10, 0]}>
                <div className="te-region-label" style={{ borderColor: color }}>
                  {REGION_NAMES[p.slug] ?? p.slug}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ---------------- cameras ---------------- */

const _v = new THREE.Vector3();
const _focus = new THREE.Vector3(0, 0, 0);

function FlyCamera() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const setFlySpeed = useExplorer((s) => s.setFlySpeed);
  const keys = useRef<Set<string>>(new Set());
  const look = useRef({ yaw: 0, pitch: -0.3 });
  const dragging = useRef(false);

  useEffect(() => {
    const cam = camera;
    cam.rotation.order = 'YXZ';
    cam.getWorldDirection(_v);
    look.current.pitch = Math.asin(THREE.MathUtils.clamp(_v.y, -1, 1));
    look.current.yaw = Math.atan2(-_v.x, -_v.z);

    const dom = gl.domElement;
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      keys.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging.current = true;
      dom.setPointerCapture(e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      dragging.current = false;
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      look.current.yaw -= e.movementX * 0.0026;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * 0.0026, -1.45, 1.45);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useExplorer.getState().flySpeed;
      setFlySpeed(THREE.MathUtils.clamp(s * (e.deltaY > 0 ? 0.85 : 1.18), 20, 1500));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      dom.removeEventListener('wheel', onWheel);
      keys.current.clear();
      // hand a sensible focus point back to the orbit controls
      cam.getWorldDirection(_v);
      _focus.copy(cam.position).addScaledVector(_v, 300);
      _focus.y = Math.max(_focus.y, -20);
    };
  }, [camera, gl, setFlySpeed]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const cam = camera;
    const { yaw, pitch } = look.current;
    cam.rotation.set(pitch, yaw, 0);

    const k = keys.current;
    const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 4 : 1;
    const speed = useExplorer.getState().flySpeed * boost * dt;
    const cp = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cp;
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * cp;
    // right = forward × up
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);

    if (k.has('KeyW') || k.has('ArrowUp')) { cam.position.x += fx * speed; cam.position.y += fy * speed; cam.position.z += fz * speed; }
    if (k.has('KeyS') || k.has('ArrowDown')) { cam.position.x -= fx * speed; cam.position.y -= fy * speed; cam.position.z -= fz * speed; }
    if (k.has('KeyA') || k.has('ArrowLeft')) { cam.position.x -= rx * speed; cam.position.z -= rz * speed; }
    if (k.has('KeyD') || k.has('ArrowRight')) { cam.position.x += rx * speed; cam.position.z += rz * speed; }
    if (k.has('KeyE')) cam.position.y += speed;
    if (k.has('KeyQ')) cam.position.y -= speed;
  });

  return null;
}

function Cameras() {
  const fly = useExplorer((s) => s.fly);
  const orbitRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    if (!fly && orbitRef.current) {
      orbitRef.current.target.copy(_focus);
      orbitRef.current.update();
    }
  }, [fly]);

  if (fly) return <FlyCamera />;
  return (
    <OrbitControls
      ref={orbitRef}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={30}
      maxDistance={5200}
      maxPolarAngle={Math.PI * 0.55}
    />
  );
}

/* ---------------- scene root ---------------- */

export function ExplorerScene() {
  const exag = useExplorer((s) => s.exag);
  const showRegions = useExplorer((s) => s.showRegions);
  const showRoutes = useExplorer((s) => s.showRoutes);
  const showGrid = useExplorer((s) => s.showGrid);
  const fly = useExplorer((s) => s.fly);
  const flySpeed = useExplorer((s) => s.flySpeed);

  return (
    <>
      <color attach="background" args={['#14101F']} />
      <fogExp2 attach="fog" args={['#14101F', 0.00022]} />

      <hemisphereLight args={['#FFF2DC', '#3A2F55', 0.85]} />
      <directionalLight position={[700, 900, 260]} intensity={1.5} color="#FFE3B3" />
      <directionalLight position={[-500, 420, -600]} intensity={0.35} color="#57C4B8" />

      <group scale={[1, exag, 1]}>
        <TerrainMesh />
        {showRoutes && (
          <>
            <RouteRibbon line={GLASSROAD_PATH} color="#FFB454" width={10} lift={3.4} />
            <RouteRibbon line={WINDSPINE_LINE} color="#57C4B8" width={7} lift={3.2} />
          </>
        )}
        {showRegions && <RegionMasks />}
      </group>

      {showGrid && (
        <Grid
          position={[0, -48, 0]}
          args={[WORLD_SIZE, WORLD_SIZE]}
          cellSize={60}
          sectionSize={300}
          cellColor="#3A2F55"
          sectionColor="#57C4B8"
          cellThickness={0.6}
          sectionThickness={1.2}
          fadeDistance={5200}
          fadeStrength={2}
          infiniteGrid
        />
      )}

      <Cameras />

      <Html position={[-WORLD_HALF + 30, 30, -WORLD_HALF + 30]} zIndexRange={[5, 0]}>
        <div className="te-corner-note">
          {fly ? (
            <>
              fly · drag look · WASD move · Q/E down/up · shift fast · scroll speed{' '}
              <b>{Math.round(flySpeed)} m/s</b> · F exits
            </>
          ) : (
            <>orbit · drag rotate · right-drag pan · scroll zoom · F to fly</>
          )}
          <span>x → east · z ↓ south</span>
        </div>
      </Html>
    </>
  );
}

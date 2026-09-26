/**
 * navmath — byte-for-byte mirrors of the game's HUD navigation math, plus a
 * pinhole stand-in for the chase camera used by CameraRig's HUD projection.
 *
 * Game sources mirrored here (keep in sync if the game changes):
 *   src/ui/HUD.tsx        — angDiff, compass window 0.9 rad, left = 50 + (off/0.9)*48
 *   src/game/CameraRig.tsx — chase cam dist/height/FOV, marker clamp 0.04–0.96 / 0.06–0.9,
 *                            waypoint projected at y + 3.5, hidden when NDC z > 1
 */

export const COMPASS_WINDOW = 0.9; // rad — ticks/diamond vanish past this
export const COMPASS_HALF_SPAN = 48; // percent of bar width either side of centre
export const MARKER_CLAMP_X: readonly [number, number] = [0.04, 0.96];
export const MARKER_CLAMP_Y: readonly [number, number] = [0.06, 0.9];

/** Cardinal ticks, exactly as HUD.tsx. */
export const COMPASS_POINTS: ReadonlyArray<[number, string]> = [
  [0, 'N'],
  [Math.PI / 2, 'E'],
  [Math.PI, 'S'],
  [-Math.PI / 2, 'W'],
];

/** Byte-identical to HUD.tsx angDiff. */
export function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Compass position for a bearing at a heading. Returns the CSS left% used by
 * the real HUD, or null when the game would hide the tick (|off| >= window).
 */
export function compassLeftPct(bearing: number, heading: number): number | null {
  const off = angDiff(bearing, heading);
  if (Math.abs(off) >= COMPASS_WINDOW) return null;
  return 50 + (off / COMPASS_WINDOW) * COMPASS_HALF_SPAN;
}

/** The one bearing the HUD derives for a target: atan2(dx, -dz), as HUD.tsx. */
export function bearingTo(px: number, pz: number, tx: number, tz: number): number {
  return Math.atan2(tx - px, -(tz - pz));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number, range: readonly [number, number]) => clamp(v, range[0], range[1]);

/** Chase-camera constants as functions of speed — CameraRig.tsx lines 31, 59. */
export function chaseCam(speed: number, boosting: boolean) {
  return {
    dist: 7.2 + Math.min(4.5, speed * 0.075),
    height: 2.6 + Math.min(1.2, speed * 0.02),
    fov: 60 + Math.min(13, speed * 0.24) * (boosting ? 1.25 : 1),
  };
}

export interface MarkerProjection {
  /** clamped CSS-space [0..1] position (what the HUD renders) */
  x: number;
  y: number;
  /** unclamped projection — can be far outside [0,1] */
  rawX: number;
  rawY: number;
  /** true when the target sits behind the camera (game hides the marker) */
  behind: boolean;
  /** ground-plane distance to the target */
  dist: number;
}

const v3 = (x: number, y: number, z: number) => ({ x, y, z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};
type Vec3 = { x: number; y: number; z: number };

/**
 * Pinhole stand-in for CameraRig's THREE projection. Same camera placement
 * (behind the bike along heading), same look-at, same +3.5m waypoint hoist,
 * same clamp, same behind rule (NDC z > 1 ⇒ camera-space depth ≤ 0).
 */
export function projectMarker(
  px: number, pz: number, heading: number,
  tx: number, tz: number,
  speed: number, aspect: number, boosting = false,
): MarkerProjection {
  const cam = chaseCam(speed, boosting);
  const fw = v3(Math.sin(heading), 0, Math.cos(heading));

  // camera placement — CameraRig.tsx lines 34 & 53 (bike rides at y≈0)
  const camPos = v3(px - fw.x * cam.dist, cam.height, pz - fw.z * cam.dist);
  const look = v3(px + fw.x * 7, 1.4 + speed * 0.012, pz + fw.z * 7);

  const fwd = norm(v3(look.x - camPos.x, look.y - camPos.y, look.z - camPos.z));
  // right = f × worldUp, up = right × f  (right-handed view basis)
  const right = norm(v3(-fwd.z, 0, fwd.x));
  const up = v3(
    right.y * fwd.z - right.z * fwd.y,
    right.z * fwd.x - right.x * fwd.z,
    right.x * fwd.y - right.y * fwd.x,
  );

  // target hoisted 3.5m — CameraRig.tsx line 68
  const toT = v3(tx - camPos.x, 3.5 - camPos.y, tz - camPos.z);
  const depth = dot(toT, fwd);
  const behind = depth <= 0.0001;

  const tanH = Math.tan(((cam.fov * Math.PI) / 180) / 2);
  const z = Math.max(0.0001, depth);
  const ndcX = dot(toT, right) / (z * tanH * aspect);
  const ndcY = dot(toT, up) / (z * tanH);
  const rawX = (ndcX + 1) / 2;
  const rawY = (1 - ndcY) / 2;

  return {
    x: clamp01(rawX, MARKER_CLAMP_X),
    y: clamp01(rawY, MARKER_CLAMP_Y),
    rawX,
    rawY,
    behind,
    dist: Math.hypot(tx - px, tz - pz),
  };
}

/**
 * Shape glyphs the game HUD relies on. `surface` scopes the accessibility rule
 * (shape + colour, never colour alone): shapes must be unique *within* a
 * surface, since surfaces are never read at once.
 */
export const MARKER_SHAPES = [
  { id: 'waypoint', surface: 'minimap', shape: 'diamond', glyph: '◆', note: 'objective / waypoint' },
  { id: 'convoy', surface: 'minimap', shape: 'square', glyph: '▪', note: 'escort convoy' },
  { id: 'chase', surface: 'minimap', shape: 'triangle', glyph: '▲', note: 'chase target' },
  { id: 'player', surface: 'minimap', shape: 'arrow', glyph: '➤', note: 'player (rotates)' },
  { id: 'storm', surface: 'minimap', shape: 'disc', glyph: '●', note: 'storm wall wedge' },
  { id: 'waypoint-oncompass', surface: 'compass', shape: 'diamond', glyph: '◆', note: 'waypoint on the pill' },
  { id: 'cardinals', surface: 'compass', shape: 'letter', glyph: 'N', note: 'N/E/S/W ticks' },
  { id: 'complete', surface: 'tracker', shape: 'square', glyph: '◻', note: 'objective complete / cargo' },
  { id: 'storm-warning', surface: 'tracker', shape: 'triangle', glyph: '▲', note: 'storm proximity' },
] as const;

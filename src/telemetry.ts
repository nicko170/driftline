/**
 * Mutable per-frame telemetry, written by the bike/camera loops and read by HUD
 * at a throttled rate — avoids zustand re-render churn at 60fps.
 */
export const telemetry = {
  x: 0, y: 0, z: 0,
  speed: 0,           // m/s ground speed
  heading: 0,         // radians, 0 = north (-z)
  boost: 1,           // 0..1
  boosting: false,
  grounded: true,
  drifting: false,
  shake: 0,           // decays; camera reads it
  impact: 0,          // impulse of last hard contact (for fragile cargo)
  /** NDC-projected active waypoint, written by the camera rig. */
  marker: { x: 0.5, y: 0.5, behind: false },
  /** Nearby interactable, written by the interaction system. */
  interact: null as null | { kind: 'board' | 'garage'; label: string },
  /** True when inside a capture radius but moving too fast (HUD hint). */
  slowHint: false,
  /** Escort objective state: distance to convoy, out-of-range timer 0..1. */
  escort: null as null | { dist: number; out: number },
  /** Chase target world pos (minimap + beam), if a chase is live. */
  chase: null as null | { x: number; z: number },
  /** Escort convoy world pos (minimap), if an escort is live. */
  convoy: null as null | { x: number; z: number },
  /** Storm wall state: centre + face distance from the player, if a storm is live. */
  storm: null as null | { x: number; z: number; r: number; dist: number },
  /** Scout scan-in-progress, 0..1. */
  scout: null as null | { progress: number },
  /** Canonical active-objective world position (moving targets follow NPCs).
   *  Written by MissionDirector; read by camera/HUD/minimap. */
  objective: null as null | { x: number; y: number; z: number },
};

export function addShake(amount: number): void {
  telemetry.shake = Math.min(1, telemetry.shake + amount);
}

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
};

export function addShake(amount: number): void {
  telemetry.shake = Math.min(1, telemetry.shake + amount);
}

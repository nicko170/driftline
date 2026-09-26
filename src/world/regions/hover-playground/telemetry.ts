/** Per-frame sandbox telemetry — written by the bike loop, read by HUD/camera. */
export const labTelemetry = {
  x: 0, y: 0, z: 0,
  yaw: 0,
  speed: 0,
  boost: 1,
  boosting: false,
  grounded: true,
  drifting: false,
  driftTime: 0,
  slipDeg: 0,
  surface: 'salt' as 'salt' | 'sand' | 'glass',
  shake: 0,
};

export function addLabShake(amount: number): void {
  labTelemetry.shake = Math.min(1, labTelemetry.shake + amount);
}

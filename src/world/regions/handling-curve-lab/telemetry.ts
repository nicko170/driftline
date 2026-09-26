/**
 * Lab telemetry — mutable per-frame state written by the bike physics tick
 * and read by the chase cam, HUD and the scope. Includes a fixed ring buffer
 * (~8 s at 60 fps) the strip-chart canvas consumes; zero allocation per frame.
 */
import type { SurfaceKind } from './params';

export const tele = {
  x: 0,
  y: 2,
  z: 0,
  yaw: 0,
  speed: 0,
  slipDeg: 0,
  boost: 1,
  boosting: false,
  drifting: false,
  driftTime: 0,
  /** 0..1 fill of the drift reward window (shipping: min(0.35, t·0.1)/0.35) */
  rewardLive: 0,
  /** most recent banked drift reward (boost units), + stamp for fade-out */
  lastReward: 0,
  lastKick: 0,
  rewardStamp: -10,
  grounded: true,
  surface: 'salt' as SurfaceKind,
  shake: 0,
};

export function addShake(amount: number): void {
  tele.shake = Math.min(1, tele.shake + amount);
}

/* ------------------------------ ring buffer ------------------------------ */

export const RING = 480; // samples; 8 s at 60 fps

export const ring = {
  head: 0,
  len: 0,
  speed: new Float32Array(RING), // m/s, capped ~70
  slip: new Float32Array(RING), // degrees, capped ~70
  boost: new Float32Array(RING), // 0..1
  drift: new Float32Array(RING), // 0/1
  reward: new Float32Array(RING), // 0..1 window fill
};

/** Push one sample — called once per rendered frame. */
export function pushSample(): void {
  const i = ring.head;
  ring.speed[i] = Math.min(70, tele.speed);
  ring.slip[i] = Math.min(70, tele.slipDeg);
  ring.boost[i] = tele.boost;
  ring.drift[i] = tele.drifting ? 1 : 0;
  ring.reward[i] = tele.drifting ? tele.rewardLive : 0;
  ring.head = (i + 1) % RING;
  if (ring.len < RING) ring.len++;
}

export function clearRing(): void {
  ring.head = 0;
  ring.len = 0;
}

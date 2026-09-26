/**
 * Ride-stats accumulator. The bike/physics loop writes deltas into `ride`
 * every step (no zustand churn); `flushRideStats()` merges them into the
 * persisted save and evaluates achievements. Flushed every ~2s from the
 * Bike frame loop, and on mission completion.
 */
import { useSaveStore, type RideStats } from '../state/store';
import { evaluateAchievements } from './achievements';

interface Pending {
  distanceM: number;
  topSpeedKmh: number;
  jumps: number;
  driftTimeS: number;
  bestDriftS: number;
  boostsUsed: number;
  stormsOutrun: number;
  missionsDone: number;
  airTimeS: number;
  biggestAirS: number;
  dirty: boolean;
}

export const ride: Pending = {
  distanceM: 0,
  topSpeedKmh: 0,
  jumps: 0,
  driftTimeS: 0,
  bestDriftS: 0,
  boostsUsed: 0,
  stormsOutrun: 0,
  missionsDone: 0,
  airTimeS: 0,
  biggestAirS: 0,
  dirty: false,
};

export function flushRideStats(): void {
  if (!ride.dirty) return;
  const patch: Partial<RideStats> = {};
  if (ride.distanceM > 0) patch.distanceM = ride.distanceM;
  if (ride.topSpeedKmh > 0) patch.topSpeedKmh = ride.topSpeedKmh;
  if (ride.jumps > 0) patch.jumps = ride.jumps;
  if (ride.driftTimeS > 0) patch.driftTimeS = ride.driftTimeS;
  if (ride.bestDriftS > 0) patch.bestDriftS = ride.bestDriftS;
  if (ride.boostsUsed > 0) patch.boostsUsed = ride.boostsUsed;
  if (ride.stormsOutrun > 0) patch.stormsOutrun = ride.stormsOutrun;
  if (ride.missionsDone > 0) patch.missionsDone = ride.missionsDone;
  if (ride.airTimeS > 0) patch.airTimeS = ride.airTimeS;
  if (ride.biggestAirS > 0) patch.biggestAirS = ride.biggestAirS;
  ride.distanceM = ride.jumps = ride.driftTimeS = ride.boostsUsed = 0;
  ride.stormsOutrun = ride.missionsDone = ride.airTimeS = 0;
  ride.topSpeedKmh = ride.bestDriftS = ride.biggestAirS = 0;
  ride.dirty = false;
  useSaveStore.getState().bumpStats(patch);
  evaluateAchievements();
}

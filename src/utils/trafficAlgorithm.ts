import { Lane, LaneId } from '../types/traffic';

export const BASE_GREEN_TIME = 30; // seconds
export const MAX_RED_TIME = 90; // seconds
export const EMPTY_SWITCH_TIME = 3; // seconds
export const MIN_GREEN_TIME = 10; // seconds
export const MAX_GREEN_TIME = 45; // seconds
export const YELLOW_TIME = 3; // seconds

/**
 * Calculate dynamic green time based on vehicle count and 24h history.
 * Borrows time from least-loaded lanes and gives to most-loaded.
 */
export function calculateGreenTimes(lanes: Lane[]): Record<LaneId, number> {
  const totalVehicles = lanes.reduce((sum, l) => sum + l.vehicleCount, 0);

  if (totalVehicles === 0) {
    const eq: Record<LaneId, number> = { N: BASE_GREEN_TIME, S: BASE_GREEN_TIME, E: BASE_GREEN_TIME, W: BASE_GREEN_TIME };
    return eq;
  }

  // Calculate 24h average for each lane (used to inform borrowing)
  const avg24h: Record<LaneId, number> = { N: 0, S: 0, E: 0, W: 0 };
  lanes.forEach(lane => {
    if (lane.history24h.length > 0) {
      avg24h[lane.id] = lane.history24h.reduce((s, h) => s + h.vehicleCount, 0) / lane.history24h.length;
    } else {
      avg24h[lane.id] = lane.vehicleCount;
    }
  });

  const totalCycleTime = BASE_GREEN_TIME * lanes.length;
  const result: Record<LaneId, number> = { N: 0, S: 0, E: 0, W: 0 };

  lanes.forEach(lane => {
    const liveWeight = lane.vehicleCount / totalVehicles;
    const totalAvg24 = Object.values(avg24h).reduce((a, b) => a + b, 0);
    const histWeight = totalAvg24 > 0 ? (avg24h[lane.id] / totalAvg24) : 0.25;
    const blendedWeight = 0.8 * liveWeight + 0.2 * histWeight;
    let greenTime = Math.round(blendedWeight * totalCycleTime);
    greenTime = Math.max(MIN_GREEN_TIME, Math.min(MAX_GREEN_TIME, greenTime));
    result[lane.id] = greenTime;
  });

  return result;
}

/**
 * Get the next lane in rotation order
 */
export function getNextLane(currentLaneId: LaneId, lanes: Lane[]): LaneId {
  const order: LaneId[] = ['N', 'E', 'S', 'W'];
  const currentIdx = order.indexOf(currentLaneId);
  for (let i = 1; i <= order.length; i++) {
    const nextId = order[(currentIdx + i) % order.length];
    const nextLane = lanes.find(l => l.id === nextId);
    if (nextLane) return nextId;
  }
  return order[(currentIdx + 1) % order.length];
}

/**
 * Format seconds to MM:SS - improved for timers
 */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Estimate vehicles that crossed during green phase
 */
export function estimateVehiclesCrossed(vehicleCount: number, greenTime: number): number {
  const rate = 0.5; // vehicles per second
  return Math.min(vehicleCount, Math.round(greenTime * rate));
}

/**
 * Calculate cumulative time saved per lane vs 30s baseline
 */
export function calcTimeSavedForLane(lane: Lane): number {
  return lane.timeSaved;
}

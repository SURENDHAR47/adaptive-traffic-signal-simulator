export type LaneId = 'N' | 'S' | 'E' | 'W';
export type SignalState = 'green' | 'red' | 'yellow';

export interface Lane {
  id: LaneId;
  label: string;
  vehicleCount: number;
  signalState: SignalState;
  greenTimeAllocated: number; // seconds
  timeRemaining: number; // seconds
  totalVehiclesCrossed: number;
  timeSaved: number; // seconds saved vs baseline 30s
  redTimeElapsed: number; // for max red constraint
  history24h: { timestamp: number; vehicleCount: number; crossed: number }[];
  emptyTimer: number; // seconds lane has been empty
}

export interface TrafficLog {
  timestamp: Date;
  laneId: LaneId;
  vehiclesCrossed: number;
  greenTime: number;
  vehicleCount: number;
}

export interface ESP32Config {
  ip: string;
  connected: boolean;
  lastPing: number;
}

export interface HourlyData {
  hour: string;
  N: number;
  S: number;
  E: number;
  W: number;
}

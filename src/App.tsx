import { useState, useEffect, useRef, useCallback } from 'react';
import { Lane, LaneId, TrafficLog, HourlyData, ESP32Config } from './types/traffic';
import {
  calculateGreenTimes,
  getNextLane,
  estimateVehiclesCrossed,
  BASE_GREEN_TIME,
  MAX_RED_TIME,
  EMPTY_SWITCH_TIME,
  YELLOW_TIME,
} from './utils/trafficAlgorithm';
import { sendSignalToESP32 } from './utils/esp32';
import { IntersectionView } from './components/IntersectionView';
import { LaneControlPanel } from './components/LaneControlPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { ESP32Panel } from './components/ESP32Panel';
import { Activity, Settings, Play, Pause, RotateCcw, Zap } from 'lucide-react';

const LANE_LABELS: Record<LaneId, string> = {
  N: 'North Lane',
  S: 'South Lane',
  E: 'East Lane',
  W: 'West Lane',
};

const INITIAL_LANES: Lane[] = (['N', 'E', 'S', 'W'] as LaneId[]).map(id => ({
  id,
  label: LANE_LABELS[id],
  vehicleCount: id === 'N' ? 15 : id === 'E' ? 8 : id === 'S' ? 20 : 5,
  signalState: id === 'N' ? 'green' : 'red',
  greenTimeAllocated: BASE_GREEN_TIME,
  timeRemaining: id === 'N' ? BASE_GREEN_TIME : BASE_GREEN_TIME,
  totalVehiclesCrossed: 0,
  timeSaved: 0,
  redTimeElapsed: 0,
  history24h: [],
  emptyTimer: 0,
}));

export default function App() {
  const [lanes, setLanes] = useState<Lane[]>(INITIAL_LANES);
  const [activeLane, setActiveLane] = useState<LaneId>('N');
  const [isRunning, setIsRunning] = useState(true);
  const [phase, setPhase] = useState<'green' | 'yellow'>('green');
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [cycleSeconds, setCycleSeconds] = useState(0);
  const [esp32Config, setEsp32Config] = useState<ESP32Config>({ ip: '192.168.1.100', connected: false, lastPing: 0 });
  const [showESP32, setShowESP32] = useState(false);
  const [totalCycles, setTotalCycles] = useState(0);
  const [systemTimeSaved, setSystemTimeSaved] = useState(0);
  const [debugMode, setDebugMode] = useState(false);

  const phaseRef = useRef(phase);
  const activeLaneRef = useRef(activeLane);
  const lanesRef = useRef(lanes);
  const esp32Ref = useRef(esp32Config);
  const hourlyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickStartRef = useRef<number>(performance.now());

  phaseRef.current = phase;
  activeLaneRef.current = activeLane;
  lanesRef.current = lanes;
  esp32Ref.current = esp32Config;

  // ─── Send to ESP32 whenever signals change ───────────────────────────────
  const sendESP32Update = useCallback((lanesSnapshot: Lane[]) => {
    if (!esp32Ref.current.connected) return;
    lanesSnapshot.forEach(lane => {
      sendSignalToESP32(esp32Ref.current.ip, {
        laneId: lane.id,
        state: lane.signalState,
        timeRemaining: lane.timeRemaining,
      });
    });
  }, []);

  // ─── Recalculate green times whenever vehicle counts change ──────────────
  const recalculateGreenTimes = useCallback((currentLanes: Lane[]): Lane[] => {
    const greenTimes = calculateGreenTimes(currentLanes);
    return currentLanes.map(l => ({
      ...l,
      greenTimeAllocated: greenTimes[l.id],
    }));
  }, []);

  // ─── Switch to next lane ─────────────────────────────────────────────────
  const switchToNextLane = useCallback((currentLanes: Lane[], currentActive: LaneId): { newLanes: Lane[]; newActive: LaneId } => {
    const nextId = getNextLane(currentActive, currentLanes);
    const greenTimes = calculateGreenTimes(currentLanes);

    // Log completion of current lane green phase
    const currentLane = currentLanes.find(l => l.id === currentActive)!;
    const crossed = estimateVehiclesCrossed(currentLane.vehicleCount, currentLane.greenTimeAllocated);
    const newLog: TrafficLog = {
      timestamp: new Date(),
      laneId: currentActive,
      vehiclesCrossed: crossed,
      greenTime: currentLane.greenTimeAllocated,
      vehicleCount: currentLane.vehicleCount,
    };
    setLogs(prev => [...prev.slice(-200), newLog]);
    setTotalCycles(c => c + 1);
    setSystemTimeSaved(s => s + (BASE_GREEN_TIME - currentLane.greenTimeAllocated));

    const updatedLanes = currentLanes.map(l => {
      if (l.id === currentActive) {
        // Was green, now red
        const vehiclesCrossed = estimateVehiclesCrossed(l.vehicleCount, l.greenTimeAllocated);
        const newCount = Math.max(0, l.vehicleCount - vehiclesCrossed);
        const timeSavedThis = BASE_GREEN_TIME - l.greenTimeAllocated;
        return {
          ...l,
          vehicleCount: newCount,
          signalState: 'red' as const,
          timeRemaining: greenTimes[nextId],
          totalVehiclesCrossed: l.totalVehiclesCrossed + vehiclesCrossed,
          timeSaved: l.timeSaved + timeSavedThis,
          redTimeElapsed: 0,
          emptyTimer: 0,
        };
      } else if (l.id === nextId) {
        // Now green
        return {
          ...l,
          signalState: 'green' as const,
          greenTimeAllocated: greenTimes[l.id],
          timeRemaining: greenTimes[l.id],
          redTimeElapsed: 0,
          emptyTimer: 0,
        };
      } else {
        // Stays red, update time remaining for display
        return {
          ...l,
          signalState: 'red' as const,
          timeRemaining: greenTimes[l.id],
        };
      }
    });

    return { newLanes: updatedLanes, newActive: nextId };
  }, []);

  // ─── Main tick ───────────────────────────────────────────────────────────
    const tick = useCallback(() => {
      console.log(`[TICK] phase=${phaseRef.current}, active=${activeLaneRef.current}, remaining=${lanesRef.current.find(l=>l.id===activeLaneRef.current)?.timeRemaining ?? 'N/A'}`);

      setCycleSeconds(s => s + 1);

      setLanes(prev => {
        const currentActive = activeLaneRef.current;
        const currentPhase = phaseRef.current;
        const activeLaneObj = prev.find(l => l.id === currentActive)!;

        let updated = prev.map(l => ({ ...l }));

        // Update red time elapsed for all non-active lanes
        updated = updated.map(l => {
          if (l.id !== currentActive && l.signalState === 'red') {
            return { ...l, redTimeElapsed: l.redTimeElapsed + 1 };
          }
          return l;
        });

        // Handle yellow phase
        if (currentPhase === 'yellow') {
          const yellowLane = updated.find(l => l.id === currentActive)!;
          const newYellowTime = yellowLane.timeRemaining - 1;

          if (newYellowTime <= 0) {
            // Yellow done → switch
            phaseRef.current = 'green';
            setPhase('green');
            const { newLanes, newActive } = switchToNextLane(updated, currentActive);

            activeLaneRef.current = newActive;
            setActiveLane(newActive);
            sendESP32Update(newLanes);
            return newLanes;
          } else {
            updated = updated.map(l => l.id === currentActive ? { ...l, timeRemaining: newYellowTime } : l);
            sendESP32Update(updated);
            return updated;
          }
        }

        // Green phase
        const newTimeRemaining = activeLaneObj.timeRemaining - 1;

        // Check empty lane skip (3 seconds empty)
        let emptyTimer = activeLaneObj.emptyTimer;
        if (lane.vehicleCount === 0) {
          emptyTimer += 1;
          console.log(`EMPTY TICK: ${activeLaneRef.current} emptyTimer=${emptyTimer}`);
        } else {
          emptyTimer = 0;
        }

        // Force switch conditions:
        // 1. Empty for 3 seconds
        // 2. Time ran out
        // 3. Max red for other lanes exceeded
        const overMaxRedLanes = updated.filter(l => l.id !== currentActive && l.signalState === 'red' && l.redTimeElapsed >= MAX_RED_TIME).map(l => ({id: l.id, redElapsed: l.redTimeElapsed}));

        const forceSwitch = emptyTimer >= EMPTY_SWITCH_TIME || newTimeRemaining <= 0;

        if (forceSwitch || overMaxRedLanes.length > 0) {
          const reason = newTimeRemaining <= 0 ? 'TIME_EXPIRED' : emptyTimer >= EMPTY_SWITCH_TIME ? 'EMPTY_SKIP' : 'MAX_RED_VIOLATION';

          // Start yellow transition
          phaseRef.current = 'yellow';
          setPhase('yellow');
          updated = updated.map(l => {
            if (l.id === currentActive) {
              return { ...l, signalState: 'yellow', timeRemaining: YELLOW_TIME, emptyTimer };
            }
            return l;
          });
          sendESP32Update(updated);
          return updated;
        }

        // Normal countdown
        updated = updated.map(l => {
          if (l.id === currentActive) {
            return { ...l, timeRemaining: newTimeRemaining, emptyTimer };
          }
          return l;
        });
        sendESP32Update(updated);
        return updated;
      });
    }, [switchToNextLane, sendESP32Update]);

  // ─── Precise Timer setup ──────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number;
    
    const preciseTick = (currentTime: DOMHighResTimeStamp) => {
      if (!isRunning) {
        if (rafId) cancelAnimationFrame(rafId);
        return;
      }

      // Precise 1-second intervals using performance.now()
      if (currentTime - tickStartRef.current >= 1000) {
        tickStartRef.current = currentTime - ((currentTime - tickStartRef.current) % 1000); // Snap to nearest second
        tick();

        if (debugMode) {
          const activeLaneData = lanesRef.current.find(l => l.id === activeLaneRef.current);
          console.log(`[Precise Tick] Phase: ${phaseRef.current}, Active: ${activeLaneRef.current}, Remaining: ${activeLaneData?.timeRemaining ?? 'N/A'}`);
        }
      }
      
      rafId = requestAnimationFrame(preciseTick);
    };

    rafId = requestAnimationFrame(preciseTick);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isRunning, tick, debugMode]);

  // ─── Hourly data collection (every 60s in demo, every 3600s real) ────────
  useEffect(() => {
    hourlyTimerRef.current = setInterval(() => {
      const hour = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const snapshot = lanesRef.current;
      setHourlyData(prev => {
        const entry: HourlyData = {
          hour,
          N: snapshot.find(l => l.id === 'N')?.vehicleCount || 0,
          S: snapshot.find(l => l.id === 'S')?.vehicleCount || 0,
          E: snapshot.find(l => l.id === 'E')?.vehicleCount || 0,
          W: snapshot.find(l => l.id === 'W')?.vehicleCount || 0,
        };
        const updated = [...prev, entry];
        // Keep last 24 hours worth
        return updated.slice(-24);
      });

      // Update 24h history per lane
      setLanes(prev => prev.map(l => ({
        ...l,
        history24h: [
          ...l.history24h.slice(-24),
          { timestamp: Date.now(), vehicleCount: l.vehicleCount, crossed: l.totalVehiclesCrossed },
        ],
      })));
    }, 60000); // every 60s for demo (represents 1 hour)

    return () => { if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current); };
  }, []);

  // ─── Recalculate green times on vehicle count change ─────────────────────
  const handleVehicleCountChange = useCallback((laneId: LaneId, count: number) => {
    setLanes(prev => {
      const updated = prev.map(l => l.id === laneId ? { ...l, vehicleCount: count } : l);
      return recalculateGreenTimes(updated).map(l => {
        // Update timeRemaining for active lane to reflect new allocation
        if (l.id === activeLaneRef.current && l.signalState === 'green') {
          return { ...l, greenTimeAllocated: l.greenTimeAllocated, timeRemaining: l.greenTimeAllocated };
        }
        return l;
      });
    });
  }, [recalculateGreenTimes]);

  // ─── Reset ───────────────────────────────────────────────────────────────
  const handleReset = () => {
    setLanes(INITIAL_LANES);
    setActiveLane('N');
    setPhase('green');
    setLogs([]);
    setHourlyData([]);
    setCycleSeconds(0);
    setTotalCycles(0);
    setSystemTimeSaved(0);
    activeLaneRef.current = 'N';
    phaseRef.current = 'green';
  };

  const totalVehicles = lanes.reduce((s, l) => s + l.vehicleCount, 0);
  const totalCrossed = lanes.reduce((s, l) => s + l.totalVehiclesCrossed, 0);
  const activeGreenTime = lanes.find(l => l.id === activeLane)?.greenTimeAllocated || BASE_GREEN_TIME;
  const efficiencyGain = totalCycles > 0 ? Math.round((systemTimeSaved / (totalCycles * BASE_GREEN_TIME)) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Top Header ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900 rounded-xl">
              <Activity size={22} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-white font-black text-xl tracking-tight">SmartSignal AI</h1>
              <p className="text-gray-500 text-xs">Adaptive Traffic Controller • 4-Lane Intersection</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* System stats */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-500 text-xs">Queue</div>
                <div className="text-yellow-400 font-bold">{totalVehicles}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">Crossed</div>
                <div className="text-green-400 font-bold">{totalCrossed}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">Cycles</div>
                <div className="text-blue-400 font-bold">{totalCycles}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">Efficiency</div>
                <div className={`font-bold ${efficiencyGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>{efficiencyGain >= 0 ? '+' : ''}{efficiencyGain}%</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">Active Lane</div>
                <div className="text-cyan-400 font-bold">{activeLane} • {activeGreenTime}s</div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRunning(r => !r)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${isRunning ? 'bg-yellow-700 hover:bg-yellow-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'}`}
              >
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-gray-700 hover:bg-gray-600 text-white transition-all"
              >
                <RotateCcw size={16} />
                Reset
              </button>
              <button
                onClick={() => setShowESP32(s => !s)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${showESP32 ? 'bg-cyan-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
              >
                <Settings size={16} />
                ESP32
              </button>
              <button
                onClick={() => setDebugMode(d => !d)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${debugMode ? 'bg-purple-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                title="Toggle timer debug logs in console"
              >
                <Zap size={14} />
                {debugMode ? 'DBG ON' : 'DBG'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-2">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-6 text-xs overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-gray-400">{isRunning ? 'SYSTEM ACTIVE' : 'PAUSED'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-yellow-400" />
            <span className="text-gray-400">Phase: <span className={`font-bold ${phase === 'green' ? 'text-green-400' : phase === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>{phase.toUpperCase()}</span></span>
          </div>
          <div className="text-gray-400">
            Algorithm: <span className="text-cyan-400 font-bold">Adaptive (80% live + 20% 24h hist)</span>
          </div>
          <div className="text-gray-400">
            Max Red: <span className="text-orange-400 font-bold">{MAX_RED_TIME}s</span>
          </div>
          <div className="text-gray-400">
            Empty Skip: <span className="text-blue-400 font-bold">{EMPTY_SWITCH_TIME}s</span>
          </div>
          <div className="text-gray-400">
            Time Saved: <span className="text-green-400 font-bold">{systemTimeSaved}s system-wide</span>
          </div>
          {esp32Config.connected && (
            <div className="flex items-center gap-1 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              ESP32 @ {esp32Config.ip}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-screen-2xl mx-auto px-4 py-4">
        {/* Algorithm info banner */}
        <div className="bg-gradient-to-r from-blue-950 via-purple-950 to-indigo-950 border border-blue-800 rounded-2xl p-3 mb-4 flex flex-wrap gap-4 items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <div>
              <div className="text-white font-bold">Adaptive Green Time Algorithm</div>
              <div className="text-gray-400">Dynamic allocation based on live vehicle density</div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {lanes.map(l => {
              const greenTimes = calculateGreenTimes(lanes);
              return (
                <div key={l.id} className="bg-gray-900 rounded-lg px-2 py-1">
                  <span className="text-gray-400">{l.label}: </span>
                  <span className="text-green-400 font-bold">{greenTimes[l.id]}s</span>
                  <span className="text-gray-600"> green</span>
                  {greenTimes[l.id] !== BASE_GREEN_TIME && (
                    <span className={`ml-1 font-bold ${greenTimes[l.id] > BASE_GREEN_TIME ? 'text-blue-400' : 'text-orange-400'}`}>
                      ({greenTimes[l.id] > BASE_GREEN_TIME ? '+' : ''}{greenTimes[l.id] - BASE_GREEN_TIME}s)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ESP32 Panel (collapsible) */}
        {showESP32 && (
          <div className="mb-4">
            <ESP32Panel
              config={esp32Config}
              onConfigChange={cfg => setEsp32Config(prev => ({ ...prev, ...cfg }))}
            />
          </div>
        )}

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-4">
          {/* Intersection View */}
          <div className="xl:col-span-3 bg-gray-900 rounded-2xl border border-gray-700 p-4 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3">
              <h2 className="text-white font-bold">🚦 Live Intersection</h2>
              <div className="flex gap-2 text-xs">
                {lanes.map(l => (
                  <div key={l.id} className={`px-2 py-1 rounded-lg font-bold ${l.signalState === 'green' ? 'bg-green-900 text-green-300' : l.signalState === 'yellow' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-950 text-red-400'}`}>
                    {l.id}: {l.signalState === 'green' ? '🟢' : l.signalState === 'yellow' ? '🟡' : '🔴'}
                  </div>
                ))}
              </div>
            </div>
            <IntersectionView lanes={lanes} activeLane={activeLane} cycleSeconds={cycleSeconds} />

            {/* Signal phase progress bars */}
            <div className="w-full mt-4 space-y-2">
              {lanes.map(l => {
                const isActive = l.id === activeLane;
                const pct = isActive ? (l.timeRemaining / l.greenTimeAllocated) * 100 : 0;
                const redPct = !isActive ? Math.min((l.redTimeElapsed / MAX_RED_TIME) * 100, 100) : 0;
                return (
                  <div key={l.id} className="flex items-center gap-2">
                    <div className="w-16 text-xs text-gray-400 font-bold">{l.label.split(' ')[0]}</div>
                    <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                      {isActive ? (
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${phase === 'green' ? 'bg-green-500' : 'bg-yellow-500'}`}
                          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                        />
                      ) : (
                        <div
                          className="h-full rounded-full transition-all duration-1000 bg-red-800"
                          style={{ width: `${redPct}%` }}
                        />
                      )}
                    </div>
                    <div className="w-10 text-xs text-right font-mono text-gray-400">
                      {isActive ? `${l.timeRemaining}s` : `${l.redTimeElapsed}s`}
                    </div>
                    {!isActive && l.redTimeElapsed > 70 && (
                      <span className="text-orange-400 text-xs animate-pulse">⚠️</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lane Control Panel */}
          <div className="xl:col-span-2 bg-gray-900 rounded-2xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold">🎛️ Lane Controls</h2>
              <div className="text-xs text-gray-500">Adjust vehicle queue per lane</div>
            </div>
            <LaneControlPanel
              lanes={lanes}
              onVehicleCountChange={handleVehicleCountChange}
              activeLane={activeLane}
            />

            {/* Time Saved Summary */}
            <div className="mt-3 bg-gray-800 rounded-xl p-3 border border-gray-700">
              <div className="text-gray-400 text-xs font-bold mb-2">⏱️ Time Saved vs 30s Baseline</div>
              <div className="space-y-1.5">
                {lanes.map(l => {
                  const saved = l.timeSaved;
                  const pct = Math.min(Math.abs(saved) / 30 * 100, 100);
                  return (
                    <div key={l.id} className="flex items-center gap-2">
                      <div className="w-12 text-xs text-gray-400">{l.id}</div>
                      <div className="flex-1 bg-gray-900 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${saved >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className={`w-14 text-xs text-right font-mono font-bold ${saved >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {saved >= 0 ? '+' : ''}{saved}s
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-xs">
                <span className="text-gray-400">System Total Saved</span>
                <span className={`font-bold ${systemTimeSaved >= 0 ? 'text-green-400' : 'text-red-400'}`}>{systemTimeSaved >= 0 ? '+' : ''}{systemTimeSaved}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Analytics Panel ── */}
        <AnalyticsPanel lanes={lanes} logs={logs} hourlyData={hourlyData} />

        {/* ── Recent Activity Log ── */}
        <div className="mt-4 bg-gray-900 rounded-2xl border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold">📋 Recent Activity Log</h2>
            <span className="text-gray-500 text-xs">{logs.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Time</th>
                  <th className="text-left py-2 pr-4">Lane</th>
                  <th className="text-right py-2 pr-4">Queue</th>
                  <th className="text-right py-2 pr-4">Crossed</th>
                  <th className="text-right py-2 pr-4">Green Time</th>
                  <th className="text-right py-2">vs Baseline</th>
                </tr>
              </thead>
              <tbody>
                {[...logs].reverse().slice(0, 10).map((log, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="py-1.5 pr-4 text-gray-400 font-mono">{log.timestamp.toLocaleTimeString()}</td>
                    <td className="py-1.5 pr-4">
                      <span className="px-2 py-0.5 rounded font-bold" style={{ background: { N: '#1e3a5f', S: '#2d1b69', E: '#451a03', W: '#500724' }[log.laneId], color: { N: '#60a5fa', S: '#a78bfa', E: '#fbbf24', W: '#f472b6' }[log.laneId] }}>
                        {LANE_LABELS[log.laneId]}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-right text-gray-300">{log.vehicleCount}</td>
                    <td className="py-1.5 pr-4 text-right text-green-400 font-bold">{log.vehiclesCrossed}</td>
                    <td className="py-1.5 pr-4 text-right text-blue-400 font-mono">{log.greenTime}s</td>
                    <td className={`py-1.5 text-right font-bold font-mono ${log.greenTime <= BASE_GREEN_TIME ? 'text-green-400' : 'text-red-400'}`}>
                      {log.greenTime <= BASE_GREEN_TIME ? '' : '+'}{log.greenTime - BASE_GREEN_TIME}s
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-600">No cycles completed yet...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-600">
        SmartSignal AI • Adaptive Traffic Controller • Algorithm: Proportional (80% live + 20% 24h avg) • Max Red: 90s • Empty Lane Skip: 3s • Yellow Phase: 3s
      </div>
    </div>
  );
}

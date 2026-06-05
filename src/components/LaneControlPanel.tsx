import React, { useState } from 'react';
import { Lane, LaneId } from '../types/traffic';
import { formatTime, BASE_GREEN_TIME, MAX_RED_TIME } from '../utils/trafficAlgorithm';
import { Car, Clock, TrendingUp, Timer, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  lanes: Lane[];
  onVehicleCountChange: (laneId: LaneId, count: number) => void;
  activeLane: LaneId;
}

const LANE_COLORS: Record<LaneId, { bg: string; border: string; text: string; badge: string; glow: string }> = {
  N: { bg: 'bg-blue-950', border: 'border-blue-500', text: 'text-blue-400', badge: 'bg-blue-600', glow: 'rgba(59,130,246,0.3)' },
  S: { bg: 'bg-purple-950', border: 'border-purple-500', text: 'text-purple-400', badge: 'bg-purple-600', glow: 'rgba(139,92,246,0.3)' },
  E: { bg: 'bg-amber-950', border: 'border-amber-500', text: 'text-amber-400', badge: 'bg-amber-600', glow: 'rgba(245,158,11,0.3)' },
  W: { bg: 'bg-pink-950', border: 'border-pink-500', text: 'text-pink-400', badge: 'bg-pink-600', glow: 'rgba(236,72,153,0.3)' },
};

const LANE_EMOJIS: Record<LaneId, string> = { N: '⬆️', S: '⬇️', E: '➡️', W: '⬅️' };
const PRESET_COUNTS = [0, 5, 10, 20, 35, 50];

export const LaneControlPanel: React.FC<Props> = ({ lanes, onVehicleCountChange, activeLane }) => {
  const [inputValues, setInputValues] = useState<Record<LaneId, string>>({ N: '', S: '', E: '', W: '' });

  const handleInputChange = (laneId: LaneId, val: string) => {
    setInputValues(prev => ({ ...prev, [laneId]: val }));
    const n = parseInt(val);
    if (!isNaN(n) && n >= 0 && n <= 99) {
      onVehicleCountChange(laneId, n);
    }
  };

  const handleInputBlur = (laneId: LaneId) => {
    setInputValues(prev => ({ ...prev, [laneId]: '' }));
  };

  const step = (laneId: LaneId, delta: number, current: number) => {
    const next = Math.max(0, Math.min(99, current + delta));
    onVehicleCountChange(laneId, next);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {lanes.map(lane => {
        const colors = LANE_COLORS[lane.id];
        const isActive = lane.id === activeLane;
        const isGreen = lane.signalState === 'green';
        const isYellow = lane.signalState === 'yellow';
        const timeSavedCum = lane.timeSaved;

        return (
          <div
            key={lane.id}
            className={`rounded-xl p-3 border-2 transition-all duration-300 ${colors.bg} ${isActive ? colors.border : 'border-gray-700'}`}
            style={isActive ? { boxShadow: `0 0 16px 2px ${colors.glow}` } : {}}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{LANE_EMOJIS[lane.id]}</span>
                <span className={`font-bold text-sm ${colors.text}`}>{lane.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {isActive && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold text-white animate-pulse ${isGreen ? 'bg-green-600' : isYellow ? 'bg-yellow-600' : 'bg-orange-600'}`}>
                    {isGreen ? '🟢 GREEN' : isYellow ? '🟡 YELLOW' : '🔄'}
                  </span>
                )}
                {!isActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-950 text-red-400">
                    🔴 RED
                  </span>
                )}
              </div>
            </div>

            {/* Enhanced Timer */}
            <div className="mb-2">
              {isActive ? (
                // Active lane: countdown remaining
                <div className="flex items-center gap-2">
                  <Clock size={11} className="text-gray-500" />
                  <div className={`font-mono text-xl font-black ${isGreen ? 'text-green-400' : isYellow ? 'text-yellow-400' : 'text-red-500'}`}>
                    {formatTime(lane.timeRemaining)}
                  </div>
                  <div className="text-gray-600 text-xs ml-auto">
                    alloc: <span className="text-gray-400 font-mono">{lane.greenTimeAllocated}s</span>
                  </div>
                </div>
              ) : (
                // Red lane: show red elapsed prominently
                <div className="flex items-center gap-2 text-red-400">
                  <Clock size={11} className="text-red-500" />
                  <div className="font-mono text-lg font-bold">
Red: <span className="text-xl">{formatTime(lane.redTimeElapsed)}</span> / {formatTime(MAX_RED_TIME)}
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle count control */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <Car size={11} className="text-gray-500" />
                  <span className="text-xs text-gray-400">Vehicle Queue</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Stepper */}
                  <button onClick={() => step(lane.id, -1, lane.vehicleCount)} className="w-5 h-5 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-gray-300">
                    <ChevronDown size={12} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={inputValues[lane.id] !== '' ? inputValues[lane.id] : lane.vehicleCount}
                    onChange={e => handleInputChange(lane.id, e.target.value)}
                    onBlur={() => handleInputBlur(lane.id)}
                    className={`w-12 text-center bg-gray-900 border border-gray-700 rounded text-sm font-bold font-mono focus:outline-none focus:border-current ${colors.text}`}
                  />
                  <button onClick={() => step(lane.id, 1, lane.vehicleCount)} className="w-5 h-5 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-gray-300">
                    <ChevronUp size={12} />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={99}
                value={lane.vehicleCount}
                onChange={e => onVehicleCountChange(lane.id, parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${isGreen ? '#22c55e' : isYellow ? '#eab308' : '#ef4444'} ${(lane.vehicleCount / 99) * 100}%, #374151 ${(lane.vehicleCount / 99) * 100}%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-700 mt-0.5">
                <span>0</span><span>25</span><span>50</span><span>75</span><span>99</span>
              </div>
            </div>

            {/* Preset quick-set buttons */}
            <div className="flex gap-1 mb-2">
              {PRESET_COUNTS.map(v => (
                <button
                  key={v}
                  onClick={() => onVehicleCountChange(lane.id, v)}
                  className={`flex-1 text-xs py-0.5 rounded font-bold transition-colors ${lane.vehicleCount === v ? colors.badge + ' text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-gray-900 bg-opacity-60 rounded-lg p-1.5 border border-gray-800">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingUp size={9} className="text-gray-600" />
                  <span className="text-xs text-gray-500">Total Crossed</span>
                </div>
                <div className={`text-base font-bold ${colors.text}`}>{lane.totalVehiclesCrossed}</div>
              </div>
              <div className="bg-gray-900 bg-opacity-60 rounded-lg p-1.5 border border-gray-800">
                <div className="flex items-center gap-1 mb-0.5">
                  <Timer size={9} className="text-gray-600" />
                  <span className="text-xs text-gray-500">Time Saved</span>
                </div>
                <div className={`text-base font-bold ${timeSavedCum >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {timeSavedCum >= 0 ? '+' : ''}{timeSavedCum}s
                </div>
              </div>
            </div>

            {/* Green time vs baseline visualization */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-0.5">
                <span>Green allocation vs 30s base</span>
                <span className={lane.greenTimeAllocated > BASE_GREEN_TIME ? 'text-blue-400' : lane.greenTimeAllocated < BASE_GREEN_TIME ? 'text-orange-400' : 'text-gray-400'}>
                  {lane.greenTimeAllocated > BASE_GREEN_TIME ? '▲ Extra' : lane.greenTimeAllocated < BASE_GREEN_TIME ? '▼ Less' : '= Equal'}
                </span>
              </div>
              <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min((lane.greenTimeAllocated / 90) * 100, 100)}%`,
                    background: lane.greenTimeAllocated > BASE_GREEN_TIME ? '#3b82f6' : lane.greenTimeAllocated < BASE_GREEN_TIME ? '#f97316' : '#22c55e'
                  }} />
                {/* Baseline marker at 30/90 = 33.3% */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-500" style={{ left: '33.3%' }} />
              </div>
            </div>

            {/* Empty lane indicator */}
            {lane.vehicleCount === 0 && lane.emptyTimer > 0 && isGreen && (
              <div className="mt-2 text-xs text-yellow-400 text-center bg-yellow-950 rounded-lg py-1 border border-yellow-900 animate-pulse">
                ⚡ Empty! Switching in {Math.max(0, 3 - Math.floor(lane.emptyTimer))}s...
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

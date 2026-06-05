import React from 'react';
import { Lane, LaneId } from '../types/traffic';
import { formatTime, MAX_RED_TIME } from '../utils/trafficAlgorithm';

interface Props {
  lanes: Lane[];
  activeLane: LaneId;
  cycleSeconds: number;
}

const LANE_COLORS: Record<LaneId, string> = {
  N: '#3B82F6',
  S: '#8B5CF6',
  E: '#F59E0B',
  W: '#EC4899',
};

const SignalLight: React.FC<{ state: 'green' | 'red' | 'yellow' }> = ({ state }) => (
  <div className="flex flex-col gap-[3px] bg-gray-950 rounded-md p-1.5 border border-gray-700 shadow-inner">
    <div className={`w-4 h-4 rounded-full transition-all duration-300 ${state === 'red' ? 'bg-red-500' : 'bg-red-950'}`}
      style={state === 'red' ? { boxShadow: '0 0 10px 3px rgba(239,68,68,0.8)' } : {}} />
    <div className={`w-4 h-4 rounded-full transition-all duration-300 ${state === 'yellow' ? 'bg-yellow-400' : 'bg-yellow-950'}`}
      style={state === 'yellow' ? { boxShadow: '0 0 10px 3px rgba(251,191,36,0.8)' } : {}} />
    <div className={`w-4 h-4 rounded-full transition-all duration-300 ${state === 'green' ? 'bg-green-400' : 'bg-green-950'}`}
      style={state === 'green' ? { boxShadow: '0 0 10px 3px rgba(74,222,128,0.8)' } : {}} />
  </div>
);

const Car: React.FC<{ direction: 'vertical' | 'horizontal'; color: string; moving?: boolean; idx: number }> = ({ direction, color, moving, idx }) => {
  const isVertical = direction === 'vertical';
  return (
    <div
      className={`relative flex items-center justify-center rounded-sm transition-all duration-700 ${moving ? 'opacity-0' : 'opacity-90'}`}
      style={{
        width: isVertical ? 12 : 18,
        height: isVertical ? 18 : 12,
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}88`,
        transitionDelay: `${idx * 150}ms`,
        transform: moving ? (isVertical ? 'translateY(-40px)' : 'translateX(40px)') : 'none',
      }}
    >
      {/* Windshield */}
      <div className="absolute bg-white opacity-40 rounded-sm"
        style={{ width: isVertical ? 7 : 11, height: isVertical ? 5 : 4, top: isVertical ? 2 : '50%', left: isVertical ? '50%' : 2, transform: isVertical ? 'translateX(-50%)' : 'translateY(-50%)' }} />
      {/* Tail lights */}
      <div className="absolute bg-red-500 rounded-sm opacity-80"
        style={{ width: isVertical ? 3 : 3, height: isVertical ? 2 : 3, bottom: isVertical ? 1 : 1, left: isVertical ? 1 : 'auto', right: isVertical ? 'auto' : 1 }} />
    </div>
  );
};

const LaneVehicles: React.FC<{ count: number; direction: 'vertical' | 'horizontal'; color: string; isGreen: boolean }> = ({
  count, direction, color, isGreen,
}) => {
  const shown = Math.min(count, 6);
  const arr = Array.from({ length: shown });
  const isVertical = direction === 'vertical';
  return (
    <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-1.5 items-center`}>
      {arr.map((_, i) => (
        <Car key={i} direction={direction} color={color} moving={isGreen && i < 2} idx={i} />
      ))}
      {count > 6 && (
        <div className="text-xs font-bold text-white px-1 rounded"
          style={{ textShadow: '0 0 6px black', backgroundColor: color + '44' }}>
          +{count - 6}
        </div>
      )}
    </div>
  );
};

interface LaneBadgeProps {
  lane: Lane;
  direction: 'top' | 'bottom' | 'left' | 'right';
}
const LaneBadge: React.FC<LaneBadgeProps> = ({ lane, direction }) => {
  const isGreen = lane.signalState === 'green';
  const isYellow = lane.signalState === 'yellow';
  const color = LANE_COLORS[lane.id];
  const isVertical = direction === 'top' || direction === 'bottom';

  return (
    <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} items-center gap-1.5`}>
      {(direction === 'top' || direction === 'left') && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 border"
            style={{ background: color + '18', borderColor: color + '55' }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-white text-xs font-bold">{lane.label.split(' ')[0].toUpperCase()}</span>
            <span className="text-gray-400 text-xs">•</span>
            <span className="text-gray-300 text-xs font-mono">{lane.vehicleCount} 🚗</span>
          </div>
          <div className="flex items-center gap-1.5">
            <SignalLight state={isYellow ? 'yellow' : isGreen ? 'green' : 'red'} />
            <div className={`font-mono text-base font-black px-2 py-0.5 rounded-lg border ${isGreen ? 'bg-green-950 text-green-300 border-green-800' : isYellow ? 'bg-yellow-950 text-yellow-300 border-yellow-800' : 'bg-red-950 text-red-400 border-red-900'}`}>
              {formatTime(lane.signalState === 'green' || lane.signalState === 'yellow' ? lane.timeRemaining : lane.redTimeElapsed)}
            </div>
          </div>
        </div>
      )}


      {isVertical && lane.vehicleCount > 0 && (
        <LaneVehicles count={lane.vehicleCount} direction="vertical" color={color} isGreen={isGreen} />
      )}
      {!isVertical && lane.vehicleCount > 0 && (
        <LaneVehicles count={lane.vehicleCount} direction="horizontal" color={color} isGreen={isGreen} />
      )}

      {(direction === 'bottom' || direction === 'right') && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <SignalLight state={isYellow ? 'yellow' : isGreen ? 'green' : 'red'} />
            <div className={`font-mono text-base font-black px-2 py-0.5 rounded-lg border ${isGreen ? 'bg-green-950 text-green-300 border-green-800' : isYellow ? 'bg-yellow-950 text-yellow-300 border-yellow-800' : 'bg-red-950 text-red-400 border-red-900'}`}>
              {formatTime(lane.signalState === 'green' || lane.signalState === 'yellow' ? lane.timeRemaining : lane.redTimeElapsed)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 border"
            style={{ background: color + '18', borderColor: color + '55' }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-white text-xs font-bold">{lane.label.split(' ')[0].toUpperCase()}</span>
            <span className="text-gray-400 text-xs">•</span>
            <span className="text-gray-300 text-xs font-mono">{lane.vehicleCount} 🚗</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const IntersectionView: React.FC<Props> = ({ lanes, activeLane, cycleSeconds }) => {
  const getLane = (id: LaneId) => lanes.find(l => l.id === id)!;

  const ROAD_W = 110;
  const BOX = 520;
  const CENTER = BOX / 2;

  return (
    <div className="relative select-none overflow-hidden rounded-2xl"
      style={{ width: BOX, height: BOX, background: 'radial-gradient(ellipse at center, #1a2433 0%, #0d1117 100%)' }}>

      {/* ── Grass/ground ── */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #14281a 0%, #0a1a0e 100%)' }} />

      {/* ── Road surface: horizontal ── */}
      <div className="absolute" style={{
        left: 0, right: 0,
        top: CENTER - ROAD_W / 2,
        height: ROAD_W,
        background: 'linear-gradient(180deg, #2a2a2a 0%, #222 50%, #2a2a2a 100%)',
        zIndex: 2,
      }} />

      {/* ── Road surface: vertical ── */}
      <div className="absolute" style={{
        top: 0, bottom: 0,
        left: CENTER - ROAD_W / 2,
        width: ROAD_W,
        background: 'linear-gradient(90deg, #2a2a2a 0%, #222 50%, #2a2a2a 100%)',
        zIndex: 2,
      }} />

      {/* ── Intersection box ── */}
      <div className="absolute" style={{
        left: CENTER - ROAD_W / 2, top: CENTER - ROAD_W / 2,
        width: ROAD_W, height: ROAD_W,
        background: '#1e1e1e',
        zIndex: 3,
        border: '1px solid #333',
      }} />

      {/* ── Curbs ── */}
      {[
        { left: 0, top: CENTER - ROAD_W / 2 - 3, right: 0, height: 3 },
        { left: 0, top: CENTER + ROAD_W / 2, right: 0, height: 3 },
        { top: 0, left: CENTER - ROAD_W / 2 - 3, bottom: 0, width: 3 },
        { top: 0, left: CENTER + ROAD_W / 2, bottom: 0, width: 3 },
      ].map((s, i) => (
        <div key={i} className="absolute" style={{ ...s, background: '#555', zIndex: 3 }} />
      ))}

      {/* ── Dashed center lines ── */}
      {/* Horizontal center */}
      <div className="absolute" style={{
        left: 0, right: 0, top: CENTER - 1, height: 2,
        background: 'repeating-linear-gradient(90deg, #f5c842 0px, #f5c842 24px, transparent 24px, transparent 48px)',
        zIndex: 4,
      }} />
      {/* Vertical center */}
      <div className="absolute" style={{
        top: 0, bottom: 0, left: CENTER - 1, width: 2,
        background: 'repeating-linear-gradient(180deg, #f5c842 0px, #f5c842 24px, transparent 24px, transparent 48px)',
        zIndex: 4,
      }} />

      {/* ── Lane edge lines ── */}
      {/* Horizontal road inner lines (lanes) */}
      <div className="absolute" style={{ left: 0, right: 0, top: CENTER - ROAD_W / 2 + 2, height: 2, background: '#555', zIndex: 4 }} />
      <div className="absolute" style={{ left: 0, right: 0, top: CENTER + ROAD_W / 2 - 4, height: 2, background: '#555', zIndex: 4 }} />
      {/* Vertical road inner lines */}
      <div className="absolute" style={{ top: 0, bottom: 0, left: CENTER - ROAD_W / 2 + 2, width: 2, background: '#555', zIndex: 4 }} />
      <div className="absolute" style={{ top: 0, bottom: 0, left: CENTER + ROAD_W / 2 - 4, width: 2, background: '#555', zIndex: 4 }} />

      {/* ── Crosswalks ── */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <React.Fragment key={i}>
          <div className="absolute" style={{ left: CENTER - ROAD_W / 2, width: 8, top: CENTER + ROAD_W / 2 + 4 + i * 10, height: 6, background: '#fff', opacity: 0.25, zIndex: 4 }} />
          <div className="absolute" style={{ left: CENTER + ROAD_W / 2 - 8, width: 8, top: CENTER + ROAD_W / 2 + 4 + i * 10, height: 6, background: '#fff', opacity: 0.25, zIndex: 4 }} />
          <div className="absolute" style={{ left: CENTER - ROAD_W / 2, width: 8, bottom: CENTER + ROAD_W / 2 + 4 + i * 10, height: 6, background: '#fff', opacity: 0.25, zIndex: 4 }} />
          <div className="absolute" style={{ top: CENTER - ROAD_W / 2, height: 8, left: CENTER + ROAD_W / 2 + 4 + i * 10, width: 6, background: '#fff', opacity: 0.25, zIndex: 4 }} />
          <div className="absolute" style={{ top: CENTER - ROAD_W / 2, height: 8, right: CENTER + ROAD_W / 2 + 4 + i * 10, width: 6, background: '#fff', opacity: 0.25, zIndex: 4 }} />
        </React.Fragment>
      ))}

      {/* ── Stop lines ── */}
      <div className="absolute" style={{ left: CENTER - ROAD_W / 2, right: CENTER + ROAD_W / 2, top: CENTER - ROAD_W / 2 - 5, height: 3, background: '#fff', opacity: 0.7, zIndex: 5 }} />
      <div className="absolute" style={{ left: CENTER - ROAD_W / 2, right: CENTER + ROAD_W / 2, bottom: CENTER - ROAD_W / 2 - 2, height: 3, background: '#fff', opacity: 0.7, zIndex: 5 }} />
      <div className="absolute" style={{ top: CENTER - ROAD_W / 2, bottom: CENTER + ROAD_W / 2 - BOX, left: CENTER - ROAD_W / 2 - 5, width: 3, background: '#fff', opacity: 0.7, zIndex: 5 }} />
      <div className="absolute" style={{ top: CENTER - ROAD_W / 2, bottom: CENTER + ROAD_W / 2 - BOX, right: CENTER - ROAD_W / 2 - 2, width: 3, background: '#fff', opacity: 0.7, zIndex: 5 }} />

      {/* ── Traffic arrows in road ── */}
      <div className="absolute text-gray-600 text-lg font-bold" style={{ top: CENTER + 4, left: CENTER - ROAD_W / 4 - 8, zIndex: 5 }}>↑</div>
      <div className="absolute text-gray-600 text-lg font-bold" style={{ top: CENTER + 4, left: CENTER + ROAD_W / 4 - 8, zIndex: 5 }}>↓</div>
      <div className="absolute text-gray-600 text-lg font-bold" style={{ top: CENTER - ROAD_W / 4 - 10, left: CENTER + 4, zIndex: 5 }}>→</div>
      <div className="absolute text-gray-600 text-lg font-bold" style={{ top: CENTER + ROAD_W / 4 - 10, left: CENTER + 4, zIndex: 5 }}>←</div>

      {/* ── Center cycle display ── */}
      <div className="absolute rounded-xl px-2 py-1 text-center"
        style={{ left: CENTER - 30, top: CENTER - 20, width: 60, zIndex: 10, background: 'rgba(0,0,0,0.7)', border: '1px solid #444' }}>
        <div className="text-gray-500 text-xs leading-none">CYCLE</div>
        <div className="text-white text-sm font-mono font-bold">{formatTime(cycleSeconds)}</div>
        <div className="text-gray-600 text-xs leading-none">→{activeLane === 'N' ? 'E' : activeLane === 'E' ? 'S' : activeLane === 'S' ? 'W' : 'N'}</div>
      </div>

      {/* ── NORTH Lane panel ── */}
      <div className="absolute flex flex-col items-center"
        style={{ top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <LaneBadge lane={getLane('N')} direction="top" />
      </div>

      {/* ── SOUTH Lane panel ── */}
      <div className="absolute flex flex-col-reverse items-center"
        style={{ bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <LaneBadge lane={getLane('S')} direction="bottom" />
      </div>

      {/* ── WEST Lane panel ── */}
      <div className="absolute flex flex-row items-center"
        style={{ left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
        <LaneBadge lane={getLane('W')} direction="left" />
      </div>

      {/* ── EAST Lane panel ── */}
      <div className="absolute flex flex-row-reverse items-center"
        style={{ right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
        <LaneBadge lane={getLane('E')} direction="right" />
      </div>

      {/* ── Active lane highlight ring ── */}
      {lanes.filter(l => l.signalState === 'green').map(l => {
        const positions: Record<LaneId, React.CSSProperties> = {
          N: { top: 0, left: CENTER - ROAD_W / 2, width: ROAD_W, height: CENTER - ROAD_W / 2, borderBottom: 'none', borderRadius: '0 0 0 0' },
          S: { bottom: 0, left: CENTER - ROAD_W / 2, width: ROAD_W, height: CENTER - ROAD_W / 2, borderTop: 'none' },
          E: { right: 0, top: CENTER - ROAD_W / 2, height: ROAD_W, width: CENTER - ROAD_W / 2, borderLeft: 'none' },
          W: { left: 0, top: CENTER - ROAD_W / 2, height: ROAD_W, width: CENTER - ROAD_W / 2, borderRight: 'none' },
        };
        return (
          <div key={l.id} className="absolute animate-pulse pointer-events-none"
            style={{ ...positions[l.id], zIndex: 2, border: '2px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' }} />
        );
      })}
    </div>
  );
};

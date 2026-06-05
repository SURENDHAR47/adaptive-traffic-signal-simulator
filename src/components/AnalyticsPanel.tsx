import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { Lane, TrafficLog, HourlyData } from '../types/traffic';
import { Download, BarChart2, TrendingUp, Activity, PieChart as PieIcon } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  lanes: Lane[];
  logs: TrafficLog[];
  hourlyData: HourlyData[];
}

const LANE_COLORS = {
  N: '#3B82F6',
  S: '#8B5CF6',
  E: '#F59E0B',
  W: '#EC4899',
};

type Tab = 'vehicles' | 'green-time' | 'heatmap' | 'distribution';

export const AnalyticsPanel: React.FC<Props> = ({ lanes, logs, hourlyData }) => {
  const [activeTab, setActiveTab] = useState<Tab>('vehicles');

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Lane Summary
    const summaryData = lanes.map(l => ({
      Lane: l.label,
      'Total Vehicles Crossed': l.totalVehiclesCrossed,
      'Current Vehicle Count': l.vehicleCount,
      'Total Time Saved (s)': l.timeSaved,
      'Allocated Green Time (s)': l.greenTimeAllocated,
      'Signal State': l.signalState,
    }));
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Lane Summary');

    // Sheet 2: Traffic Logs
    const logData = logs.map(l => ({
      Timestamp: l.timestamp.toLocaleString(),
      Lane: l.laneId,
      'Vehicles Crossed': l.vehiclesCrossed,
      'Vehicle Count at Time': l.vehicleCount,
      'Green Time (s)': l.greenTime,
    }));
    const ws2 = XLSX.utils.json_to_sheet(logData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Traffic Logs');

    // Sheet 3: Hourly Data
    if (hourlyData.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(hourlyData.map(h => ({
        Hour: h.hour,
        'North Vehicles': h.N,
        'South Vehicles': h.S,
        'East Vehicles': h.E,
        'West Vehicles': h.W,
        'Total': h.N + h.S + h.E + h.W,
      })));
      XLSX.utils.book_append_sheet(wb, ws3, 'Hourly Data');
    }

    XLSX.writeFile(wb, `traffic_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`);
  };

  // Vehicles crossed bar chart data
  const crossedData = lanes.map(l => ({
    lane: l.label,
    crossed: l.totalVehiclesCrossed,
    current: l.vehicleCount,
  }));

  // Green time allocation pie data
  const pieData = lanes.map(l => ({
    name: l.label,
    value: l.greenTimeAllocated,
  }));

  // Time saved data
  const timeSavedData = lanes.map(l => ({
    lane: l.label,
    saved: l.timeSaved,
  }));

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'vehicles', label: 'Vehicles', icon: <BarChart2 size={14} /> },
    { id: 'green-time', label: 'Green Time', icon: <Activity size={14} /> },
    { id: 'heatmap', label: 'Time Saved', icon: <TrendingUp size={14} /> },
    { id: 'distribution', label: 'Distribution', icon: <PieIcon size={14} /> },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs">
          <p className="text-gray-300 font-bold mb-1">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-lg">📊 Analytics Dashboard</h2>
          <p className="text-gray-500 text-xs">Live traffic intelligence & historical data</p>
        </div>
        <button
          onClick={downloadExcel}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg font-bold transition-colors"
        >
          <Download size={16} />
          Export Excel
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {lanes.map(lane => (
          <div key={lane.id} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LANE_COLORS[lane.id] }} />
              <span className="text-gray-400 text-xs">{lane.label}</span>
            </div>
            <div className="text-white text-xl font-bold">{lane.totalVehiclesCrossed}</div>
            <div className="text-gray-500 text-xs">vehicles crossed</div>
            <div className={`text-xs mt-1 font-bold ${lane.timeSaved >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {lane.timeSaved >= 0 ? '⬇️' : '⬆️'} {Math.abs(lane.timeSaved)}s {lane.timeSaved >= 0 ? 'saved' : 'extra wait'}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700" style={{ height: 280 }}>
        {activeTab === 'vehicles' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={crossedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="lane" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="crossed" name="Total Crossed" radius={[4, 4, 0, 0]}>
                {crossedData.map((_, i) => (
                  <Cell key={i} fill={Object.values(LANE_COLORS)[i]} />
                ))}
              </Bar>
              <Bar dataKey="current" name="Current Queue" fill="#6b7280" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'green-time' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData.length > 0 ? hourlyData : [{ hour: 'Now', N: lanes[0]?.vehicleCount || 0, S: lanes[1]?.vehicleCount || 0, E: lanes[2]?.vehicleCount || 0, W: lanes[3]?.vehicleCount || 0 }]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {(['N', 'S', 'E', 'W'] as const).map(id => (
                <Area key={id} type="monotone" dataKey={id} name={lanes.find(l => l.id === id)?.label || id} stroke={LANE_COLORS[id]} fill={LANE_COLORS[id]} fillOpacity={0.15} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'heatmap' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeSavedData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis dataKey="lane" type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="saved" name="Time Saved (s)" radius={[0, 4, 4, 0]}>
                {timeSavedData.map((entry, i) => (
                  <Cell key={i} fill={entry.saved >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'distribution' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }: any) => `${name ?? ''} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={Object.values(LANE_COLORS)[i]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hourly vehicle flow (24h) */}
      {hourlyData.length > 1 && (
        <div className="mt-4">
          <h3 className="text-gray-400 text-sm font-bold mb-2">📈 24-Hour Vehicle Flow</h3>
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700" style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                {(['N', 'S', 'E', 'W'] as const).map(id => (
                  <Line key={id} type="monotone" dataKey={id} stroke={LANE_COLORS[id]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

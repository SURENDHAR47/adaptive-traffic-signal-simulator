import React, { useState } from 'react';
import { ESP32Config } from '../types/traffic';
import { pingESP32, getESP32ArduinoCode } from '../utils/esp32';
import { Wifi, WifiOff, Cpu, Copy, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface Props {
  config: ESP32Config;
  onConfigChange: (cfg: Partial<ESP32Config>) => void;
}

export const ESP32Panel: React.FC<Props> = ({ config, onConfigChange }) => {
  const [showCode, setShowCode] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePing = async () => {
    setPinging(true);
    const ok = await pingESP32(config.ip);
    onConfigChange({ connected: ok, lastPing: Date.now() });
    setPinging(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getESP32ArduinoCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-gray-800 rounded-lg">
          <Cpu size={20} className="text-cyan-400" />
        </div>
        <div>
          <h3 className="text-white font-bold">ESP32-CAM Controller</h3>
          <p className="text-gray-500 text-xs">Physical traffic light hardware integration</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {config.connected ? (
            <div className="flex items-center gap-1 bg-green-900 text-green-400 px-2 py-1 rounded-lg text-xs font-bold">
              <Wifi size={12} />
              CONNECTED
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-red-900 text-red-400 px-2 py-1 rounded-lg text-xs font-bold">
              <WifiOff size={12} />
              OFFLINE
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="text-gray-400 text-xs mb-1 block">ESP32-CAM IP Address</label>
          <input
            type="text"
            value={config.ip}
            onChange={e => onConfigChange({ ip: e.target.value })}
            placeholder="192.168.1.100"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex flex-col justify-end">
          <button
            onClick={handlePing}
            disabled={pinging}
            className="flex items-center gap-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            <RefreshCw size={14} className={pinging ? 'animate-spin' : ''} />
            {pinging ? 'Pinging...' : 'Test'}
          </button>
        </div>
      </div>

      {config.lastPing > 0 && (
        <div className="text-xs text-gray-500 mb-3">
          Last ping: {new Date(config.lastPing).toLocaleTimeString()} —{' '}
          <span className={config.connected ? 'text-green-400' : 'text-red-400'}>
            {config.connected ? '✓ Reachable' : '✗ Unreachable'}
          </span>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 mb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-gray-500 mb-0.5">Signal Endpoint</div>
            <div className="text-cyan-400 font-mono">/signal?lane=N&state=green&time=30</div>
          </div>
          <div>
            <div className="text-gray-500 mb-0.5">Ping Endpoint</div>
            <div className="text-cyan-400 font-mono">/ping → PONG</div>
          </div>
          <div>
            <div className="text-gray-500 mb-0.5">Update Frequency</div>
            <div className="text-white font-mono">Every 1 second</div>
          </div>
          <div>
            <div className="text-gray-500 mb-0.5">Protocol</div>
            <div className="text-white font-mono">HTTP GET (no-cors)</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowCode(!showCode)}
        className="flex items-center gap-2 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm font-bold transition-colors border border-gray-700"
      >
        <Cpu size={14} />
        Arduino/ESP32 Firmware Code
        {showCode ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
      </button>

      {showCode && (
        <div className="mt-2 relative">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-xs text-white px-2 py-1 rounded font-bold"
          >
            <Copy size={10} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <pre className="bg-gray-950 rounded-xl p-3 text-xs text-green-400 font-mono overflow-auto max-h-64 border border-gray-700">
            {getESP32ArduinoCode()}
          </pre>
        </div>
      )}
    </div>
  );
};

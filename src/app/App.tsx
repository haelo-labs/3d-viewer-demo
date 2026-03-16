import { useState, useCallback } from 'react';
import { GearScene } from './components/GearScene';
import type { ModelInfo } from './components/GearScene';
import { ControlPanel } from './components/ControlPanel';
import { useGearState } from './hooks/useGearState';

export default function App() {
  const { state, updateState, applyPreset } = useGearState();

  const [stats, setStats] = useState({ vertices: 0, triangles: 0 });
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  const handleStatsUpdate = useCallback(
    (newStats: { vertices: number; triangles: number }) => {
      setStats(newStats);
    },
    []
  );

  const handleModelLoaded = useCallback((info: ModelInfo | null) => {
    setModelInfo(info);
  }, []);

  return (
    <div className="dark flex h-screen w-screen overflow-hidden" style={{ fontFamily: "'Geist Sans', system-ui, sans-serif" }}>
      {/* 3D Viewport */}
      <main className="relative flex-1 min-w-0" aria-label="3D gear viewport">
        <GearScene
          gearState={state}
          onStatsUpdate={handleStatsUpdate}
          onUpdate={updateState}
          onModelLoaded={handleModelLoaded}
        />
        {/* Viewport label */}
        <div className="pointer-events-none absolute bottom-4 left-4" aria-hidden="true">
          <p
            className="text-[10px] tracking-[0.3em] text-zinc-600"
            style={{ fontFamily: 'monospace' }}
          >
            VIEWPORT 01
          </p>
        </div>
      </main>

      {/* Control Panel — fixed 320px */}
      <div style={{ width: 320, minWidth: 320, maxWidth: 320 }}>
        <ControlPanel
          gearState={state}
          stats={stats}
          onUpdate={updateState}
          onApplyPreset={applyPreset}
          modelInfo={modelInfo}
        />
      </div>
    </div>
  );
}

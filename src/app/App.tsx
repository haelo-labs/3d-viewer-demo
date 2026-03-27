import { useState, useCallback, useRef } from 'react';
import { SpatialProvider } from 'exocor';
import { GearScene } from './components/GearScene';
import type { GearSceneHandle, ModelInfo, TransformMode } from './components/GearScene';
import { ControlPanel } from './components/ControlPanel';
import { useGearState } from './hooks/useGearState';
import { useViewerExocorTools } from './hooks/useViewerExocorTools';

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export default function App() {
  const { state, updateState, applyPreset } = useGearState();

  const [stats, setStats] = useState({ vertices: 0, triangles: 0 });
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isSelected, setIsSelected] = useState(false);
  const [transformMode, setTransformMode] = useState<TransformMode>('scale');
  const sceneRef = useRef<GearSceneHandle | null>(null);
  const hasModel = modelInfo !== null;

  const handleStatsUpdate = useCallback(
    (newStats: { vertices: number; triangles: number }) => {
      setStats(newStats);
    },
    []
  );

  const handleModelLoaded = useCallback((info: ModelInfo | null) => {
    setModelInfo(info);
    if (!info) {
      setIsSelected(false);
      setTransformMode('scale');
    }
  }, []);

  const selectLoadedModel = useCallback(async () => {
    if (!hasModel || !sceneRef.current?.selectLoadedModel()) {
      throw new Error(hasModel ? 'No loaded model is available to select.' : 'Load a model first.');
    }
  }, [hasModel]);

  const deselectLoadedModel = useCallback(async () => {
    sceneRef.current?.deselectModel();
  }, []);

  const setViewerTransformMode = useCallback(
    async (mode: TransformMode) => {
      if (!hasModel || !sceneRef.current?.setTransformMode(mode)) {
        throw new Error(hasModel ? 'No loaded model is available to transform.' : 'Load a model first.');
      }
    },
    [hasModel]
  );

  const applyMaterialPreset = useCallback(
    async (preset: 'steel' | 'copper' | 'carbon') => {
      if (!hasModel) {
        throw new Error('Load a model first.');
      }
      applyPreset(preset);
    },
    [applyPreset, hasModel]
  );

  const setMetalness = useCallback(
    async (value: number) => {
      if (!hasModel) {
        throw new Error('Load a model first.');
      }
      updateState({ metalness: clampUnitInterval(value) });
    },
    [hasModel, updateState]
  );

  const setRoughness = useCallback(
    async (value: number) => {
      if (!hasModel) {
        throw new Error('Load a model first.');
      }
      updateState({ roughness: clampUnitInterval(value) });
    },
    [hasModel, updateState]
  );

  const zoomIn = useCallback(async () => {
    if (!sceneRef.current?.zoomIn()) {
      throw new Error('Viewport zoom is unavailable.');
    }
  }, []);

  const zoomOut = useCallback(async () => {
    if (!sceneRef.current?.zoomOut()) {
      throw new Error('Viewport zoom is unavailable.');
    }
  }, []);

  const tools = useViewerExocorTools({
    hasModel,
    isSelected,
    transformMode,
    applyMaterialPreset,
    deselectLoadedModel,
    selectLoadedModel,
    setMetalness,
    setRoughness,
    setViewerTransformMode,
    zoomIn,
    zoomOut
  });

  return (
    <SpatialProvider tools={tools}>
      <div className="dark flex h-screen w-screen overflow-hidden" style={{ fontFamily: "'Geist Sans', system-ui, sans-serif" }}>
        <main className="relative flex-1 min-w-0" aria-label="3D gear viewport">
          <GearScene
            ref={sceneRef}
            gearState={state}
            onStatsUpdate={handleStatsUpdate}
            onUpdate={updateState}
            onModelLoaded={handleModelLoaded}
            onSelectionChange={setIsSelected}
            onTransformModeChange={setTransformMode}
          />
          <div className="pointer-events-none absolute bottom-4 left-4" aria-hidden="true">
            <p
              className="text-[10px] tracking-[0.3em] text-zinc-600"
              style={{ fontFamily: 'monospace' }}
            >
              VIEWPORT 01
            </p>
          </div>
        </main>

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
    </SpatialProvider>
  );
}

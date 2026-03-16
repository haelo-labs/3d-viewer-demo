import type { GearState } from '../hooks/useGearState';
import type { ModelInfo } from './GearScene';
import { gearPresets } from '../lib/gearPresets';
import { Upload } from 'lucide-react';

interface ControlPanelProps {
  gearState: GearState;
  stats: { vertices: number; triangles: number };
  onUpdate: (partial: Partial<GearState>) => void;
  onApplyPreset: (preset: 'steel' | 'copper' | 'carbon') => void;
  modelInfo?: ModelInfo | null;
}

export function ControlPanel({
  gearState,
  stats,
  onUpdate,
  onApplyPreset,
  modelInfo,
}: ControlPanelProps) {
  const isImported = !!modelInfo;

  return (
    <aside
      aria-label="Model configuration panel"
      className="flex h-full w-full flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4"
    >
      {/* Header */}
      <header className="mx-[0px] mt-[0px] mb-[8px]">
        <p className="text-xs text-zinc-400 tracking-wider" style={{ fontFamily: 'monospace' }}>
          {isImported ? modelInfo.format : 'HAELO'}
        </p>
        <h1
          id="panel-title"
          className="mt-1 text-white tracking-widest"
          style={{ fontFamily: 'monospace', fontSize: '1.25rem' }}
        >
          {isImported ? 'IMPORTED MODEL' : '3D VIEWER'}
        </h1>
        {isImported ? (
          <div className="mt-2 flex items-center gap-2">
            <span
              role="status"
              aria-label="Imported model loaded"
              className="inline-flex items-center rounded-md border border-blue-700 bg-blue-900/50 px-2.5 py-0.5 text-xs text-blue-400"
            >
              <Upload size={10} className="mr-1" aria-hidden="true" />
              IMPORTED
            </span>
          </div>
        ) : (
          <span
            role="status"
            aria-label="Viewer status: Ready"
            className="mt-2 inline-flex items-center rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-0.5 text-xs text-zinc-400"
          >
            READY
          </span>
        )}
        {isImported && (
          <p
            className="mt-2 text-xs text-zinc-500 truncate"
            title={modelInfo.name}
            style={{ fontFamily: 'monospace' }}
          >
            {modelInfo.name}
          </p>
        )}
      </header>

      {/* Import Model Section */}
      <section aria-labelledby="import-heading" className="rounded-lg border border-zinc-800 bg-zinc-900/50 mt-4">
        <div className="p-[16px]">
          <h2 id="import-heading" className="text-xs tracking-wider text-zinc-400" style={{ fontFamily: 'monospace' }}>
            IMPORT MODEL
          </h2>
        </div>
        <div className="px-4 pb-4">
          <p className="mb-3 text-[11px] text-zinc-500" style={{ fontFamily: 'monospace' }}>
            Drag &amp; drop onto viewport or browse.
          </p>
          <p className="mb-2 text-[10px] text-zinc-600" style={{ fontFamily: 'monospace' }}>
            GLB / GLTF / STL / OBJ / FBX / PLY
          </p>
          {isImported && modelInfo.originalMaterials && (
            <p className="mt-2 text-[10px] text-zinc-500 italic" style={{ fontFamily: 'monospace' }}>
              Original materials preserved. Metalness &amp; roughness sliders update existing PBR materials.
            </p>
          )}
        </div>
      </section>

      {/* Parameters Section — only when a model is loaded */}
      {isImported && (
        <section aria-labelledby="parameters-heading" className="rounded-lg border border-zinc-800 bg-zinc-900/50 mt-4">
          <div className="p-[16px]">
            <h2 id="parameters-heading" className="text-xs tracking-wider text-zinc-400" style={{ fontFamily: 'monospace' }}>
              PARAMETERS
            </h2>
          </div>
          <div className="space-y-4 px-4 pb-4">
            {/* Metalness */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-metalness" className="text-xs text-zinc-400">Metalness</label>
                <output htmlFor="slider-metalness" className="text-xs text-zinc-500" style={{ fontFamily: 'monospace' }}>
                  {gearState.metalness.toFixed(2)}
                </output>
              </div>
              <input
                id="slider-metalness"
                type="range"
                value={gearState.metalness}
                min={0}
                max={1}
                step={0.05}
                onChange={(e) => onUpdate({ metalness: Math.round(parseFloat(e.target.value) * 100) / 100 })}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={gearState.metalness}
                aria-valuetext={`${(gearState.metalness * 100).toFixed(0)}% metalness`}
                className="range-slider w-full"
              />
            </div>

            {/* Roughness */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-roughness" className="text-xs text-zinc-400">Roughness</label>
                <output htmlFor="slider-roughness" className="text-xs text-zinc-500" style={{ fontFamily: 'monospace' }}>
                  {gearState.roughness.toFixed(2)}
                </output>
              </div>
              <input
                id="slider-roughness"
                type="range"
                value={gearState.roughness}
                min={0}
                max={1}
                step={0.05}
                onChange={(e) => onUpdate({ roughness: Math.round(parseFloat(e.target.value) * 100) / 100 })}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={gearState.roughness}
                aria-valuetext={`${(gearState.roughness * 100).toFixed(0)}% roughness`}
                className="range-slider w-full"
              />
            </div>
          </div>
        </section>
      )}

      {/* Material Presets — only when a model is loaded */}
      {isImported && (
        <section aria-labelledby="presets-heading" className="rounded-lg border border-zinc-800 bg-zinc-900/50 mt-4">
          <div className="p-[16px]">
            <h2 id="presets-heading" className="text-xs tracking-wider text-zinc-400" style={{ fontFamily: 'monospace' }}>
              MATERIAL PRESET
            </h2>
          </div>
          <div className="px-4 pb-4">
            <div role="group" aria-label="Material preset selection" className="grid grid-cols-3 gap-2">
              {(Object.entries(gearPresets) as [keyof typeof gearPresets, typeof gearPresets['steel']][]).map(
                ([key, preset]) => {
                  const isActive = gearState.selectedPreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onApplyPreset(key)}
                      aria-pressed={isActive}
                      aria-label={`${preset.name} material preset`}
                      className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-zinc-900 ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="mr-1 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: preset.color }}
                      />
                      {preset.name}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </section>
      )}

      {/* Diagnostics */}
      <section aria-labelledby="diagnostics-heading" className="rounded-lg border border-zinc-800 bg-zinc-900/50 mt-4">
        <div className="p-[16px]">
          <h2 id="diagnostics-heading" className="text-xs tracking-wider text-zinc-400" style={{ fontFamily: 'monospace' }}>
            DIAGNOSTICS
          </h2>
        </div>
        <div className="px-4 pb-4">
          <dl className="space-y-2 text-xs" style={{ fontFamily: 'monospace' }}>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Vertices</dt>
              <dd className="text-zinc-300">{stats.vertices.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Triangles</dt>
              <dd className="text-zinc-300">{stats.triangles.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Render mode</dt>
              <dd className="text-zinc-300">Solid</dd>
            </div>
            {isImported && (
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Source</dt>
                <dd className="text-zinc-300">{modelInfo.format}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* Footer branding */}
      <footer className="mt-auto pt-4">
        <p className="text-center text-[10px] tracking-[0.2em] text-zinc-600" style={{ fontFamily: 'monospace' }}>
          HAELO 3D VIEWER v1.0
        </p>
      </footer>
    </aside>
  );
}

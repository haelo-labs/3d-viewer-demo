import { useMemo } from 'react';
import type { ExocorToolDefinition } from 'exocor';
import type { TransformMode } from '../components/GearScene';

type ViewerToolOptions = {
  hasModel: boolean;
  isSelected: boolean;
  transformMode: TransformMode;
  applyMaterialPreset: (preset: 'steel' | 'copper' | 'carbon') => Promise<void>;
  deselectLoadedModel: () => Promise<void>;
  selectLoadedModel: () => Promise<void>;
  setMetalness: (value: number) => Promise<void>;
  setRoughness: (value: number) => Promise<void>;
  setViewerTransformMode: (mode: TransformMode) => Promise<void>;
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
};

function normalizePreset(value: unknown): 'steel' | 'copper' | 'carbon' {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'steel' || normalized === 'copper' || normalized === 'carbon') {
    return normalized;
  }

  throw new Error(`Unsupported material preset "${String(value)}".`);
}

function normalizeTransformMode(value: unknown): TransformMode {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'translate' || normalized === 'scale') {
    return normalized;
  }

  throw new Error(`Unsupported transform mode "${String(value)}".`);
}

function normalizeSliderValue(name: string, value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected "${name}" to be a number between 0 and 1.`);
  }

  if (parsed < 0 || parsed > 1) {
    throw new Error(`Expected "${name}" to be between 0 and 1.`);
  }

  return Math.round(parsed * 100) / 100;
}

export function useViewerExocorTools({
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
}: ViewerToolOptions): ExocorToolDefinition[] {
  return useMemo<ExocorToolDefinition[]>(
    () => [
      {
        id: 'zoomIn',
        description: 'Zoom in on the 3D viewport camera',
        safety: 'read',
        handler: async () => {
          await zoomIn();
        }
      },
      {
        id: 'zoomOut',
        description: 'Zoom out on the 3D viewport camera',
        safety: 'read',
        handler: async () => {
          await zoomOut();
        }
      },
      {
        id: 'selectLoadedModel',
        description: hasModel ? 'Select the loaded model in the viewport' : 'Select the loaded model after a file is imported',
        safety: 'read',
        handler: async () => {
          await selectLoadedModel();
        }
      },
      {
        id: 'deselectLoadedModel',
        description: isSelected ? 'Deselect the current model' : 'Deselect the current model if one is selected',
        safety: 'read',
        handler: async () => {
          await deselectLoadedModel();
        }
      },
      {
        id: 'setTransformMode',
        description: `Set the viewer transform mode${hasModel ? ` (current: ${transformMode})` : ''}`,
        safety: 'write',
        parameters: [
          {
            name: 'mode',
            description: 'Viewer transform mode',
            type: 'enum',
            required: true,
            options: ['translate', 'scale']
          }
        ],
        handler: async ({ mode }) => {
          await setViewerTransformMode(normalizeTransformMode(mode));
        }
      },
      {
        id: 'applyMaterialPreset',
        description: 'Apply a material preset to the loaded model',
        safety: 'write',
        parameters: [
          {
            name: 'preset',
            description: 'Named material preset to apply',
            type: 'enum',
            required: true,
            options: ['steel', 'copper', 'carbon']
          }
        ],
        handler: async ({ preset }) => {
          await applyMaterialPreset(normalizePreset(preset));
        }
      },
      {
        id: 'setMetalness',
        description: 'Set model metalness',
        safety: 'write',
        parameters: [
          {
            name: 'value',
            description: 'Metalness value between 0 and 1',
            type: 'number',
            required: true
          }
        ],
        handler: async ({ value }) => {
          await setMetalness(normalizeSliderValue('value', value));
        }
      },
      {
        id: 'setRoughness',
        description: 'Set model roughness',
        safety: 'write',
        parameters: [
          {
            name: 'value',
            description: 'Roughness value between 0 and 1',
            type: 'number',
            required: true
          }
        ],
        handler: async ({ value }) => {
          await setRoughness(normalizeSliderValue('value', value));
        }
      }
    ],
    [
      applyMaterialPreset,
      deselectLoadedModel,
      hasModel,
      isSelected,
      selectLoadedModel,
      setMetalness,
      setRoughness,
      setViewerTransformMode,
      transformMode,
      zoomIn,
      zoomOut
    ]
  );
}

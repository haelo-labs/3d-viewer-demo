import { useState, useCallback } from 'react';
import { gearPresets } from '../lib/gearPresets';

export interface GearState {
  teeth: number;      // tooth count (12-24)
  metalness: number;
  roughness: number;
  color: string;
  width: number;      // overall diameter
  height: number;     // body thickness
  selectedPreset: 'steel' | 'copper' | 'carbon';
}

const initialState: GearState = {
  teeth: 16,
  metalness: 1.0,
  roughness: 0.6,
  color: '#7a7a7a',
  width: 2.0,
  height: 0.3,
  selectedPreset: 'steel',
};

export function useGearState() {
  const [state, setState] = useState<GearState>(initialState);

  const updateState = useCallback((partial: Partial<GearState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const applyPreset = useCallback((preset: 'steel' | 'copper' | 'carbon') => {
    const p = gearPresets[preset];
    setState((prev) => ({
      ...prev,
      color: p.color,
      metalness: p.metalness,
      roughness: p.roughness,
      selectedPreset: preset,
    }));
  }, []);

  return {
    state,
    updateState,
    applyPreset,
  };
}
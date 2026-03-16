export interface GearPreset {
  name: string;
  color: string;
  metalness: number;
  roughness: number;
}

export const gearPresets: Record<'steel' | 'copper' | 'carbon', GearPreset> = {
  steel: {
    name: 'Steel',
    color: '#7a7a7a',
    metalness: 0.95,
    roughness: 0.15,
  },
  copper: {
    name: 'Copper',
    color: '#b87333',
    metalness: 0.9,
    roughness: 0.25,
  },
  carbon: {
    name: 'Carbon',
    color: '#1a1a1a',
    metalness: 0.3,
    roughness: 0.8,
  },
};

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SincePreset } from '../../lib/sincePresets';

interface LabelsViewStore {
  since: SincePreset;
  onlyMine: boolean;
  update: (changes: Partial<Omit<LabelsViewStore, 'update'>>) => void;
}

export const useLabelsViewStore = create<LabelsViewStore>()(
  persist((set) => ({ since: 'anyTime', onlyMine: false, update: (changes) => set(changes) }), { name: 'labels-view' }),
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ShelvesViewStore {
  onlyMine: boolean;
  setOnlyMine: (onlyMine: boolean) => void;
}

export const useShelvesViewStore = create<ShelvesViewStore>()(
  persist((set) => ({ onlyMine: true, setOnlyMine: (onlyMine) => set({ onlyMine }) }), { name: 'shelves-view' }),
);

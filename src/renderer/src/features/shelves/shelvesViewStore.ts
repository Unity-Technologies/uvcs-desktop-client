import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ShelvesViewStore {
  onlyMine: boolean;
  /** The filter's text, for this session only: the list in Changes hands its own over ("All shelves"). */
  search: string;
  setOnlyMine: (onlyMine: boolean) => void;
  setSearch: (search: string) => void;
}

export const useShelvesViewStore = create<ShelvesViewStore>()(
  persist(
    (set) => ({ onlyMine: true, search: '', setOnlyMine: (onlyMine) => set({ onlyMine }), setSearch: (search) => set({ search }) }),
    { name: 'shelves-view', partialize: ({ onlyMine }) => ({ onlyMine }) },
  ),
);

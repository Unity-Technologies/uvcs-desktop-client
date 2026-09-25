import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Every list/details view shares one width, so the details panel stays put when moving between views. */
export const DETAILS_WIDTH = { initial: 400, min: 300, max: 720 };

interface DetailsWidthStore {
  width: number;
  setWidth: (width: number) => void;
}

export const useDetailsWidthStore = create<DetailsWidthStore>()(
  persist(
    (set) => ({
      width: DETAILS_WIDTH.initial,
      setWidth: (width) => set({ width }),
    }),
    { name: 'details-width' },
  ),
);

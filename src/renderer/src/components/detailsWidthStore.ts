import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DetailsWidthLimits {
  initial: number;
  min: number;
  max: number;
  /** What the other pane keeps at least as the window narrows, when more than `min`. */
  restMin?: number;
}

export const DETAILS_WIDTH: DetailsWidthLimits = { initial: 400, min: 300, max: 720 };

interface DetailsWidthState {
  /** Each view's details width, by the view's key: what its details show differs (a branch's meta, a file's diff). */
  widths: Record<string, number>;
}

interface DetailsWidthStore extends DetailsWidthState {
  setWidth: (key: string, width: number) => void;
}

/** A view's details width: the one it was left at, within its limits, else its default. */
export function detailsWidthOf(state: DetailsWidthState, key: string, limits: DetailsWidthLimits): number {
  const width = state.widths[key] ?? limits.initial;
  return Math.min(Math.max(width, limits.min), limits.max);
}

export const useDetailsWidthStore = create<DetailsWidthStore>()(
  persist(
    (set) => ({
      widths: {},
      setWidth: (key, width) => set((state) => ({ widths: { ...state.widths, [key]: width } })),
    }),
    // Version 0 kept one width for every view; each view starts from its default instead.
    { name: 'details-width', version: 1, migrate: () => ({ widths: {} }) },
  ),
);

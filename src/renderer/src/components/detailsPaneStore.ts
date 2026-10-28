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

interface DetailsPaneState {
  /** Each view's details width, by the view's key: what its details show differs (a branch's meta, a file's diff). */
  widths: Record<string, number>;
  /** The views whose details were hidden, by the view's key: hiding one view's leaves the others' as they were. */
  hidden: Record<string, boolean>;
}

interface DetailsPaneStore extends DetailsPaneState {
  setWidth: (key: string, width: number) => void;
  /** Hides a view's details, or shows them again. */
  toggleHidden: (key: string) => void;
}

/** A view's details width: the one it was left at, within its limits, else its default. */
export function detailsWidthOf(state: Pick<DetailsPaneState, 'widths'>, key: string, limits: DetailsWidthLimits): number {
  const width = state.widths[key] ?? limits.initial;
  return Math.min(Math.max(width, limits.min), limits.max);
}

/** Whether a view's details are hidden: shown until the user hides them. */
export function detailsHidden(state: Pick<DetailsPaneState, 'hidden'>, key: string): boolean {
  return state.hidden[key] ?? false;
}

/** The views' hidden details with one view's hidden or shown again. */
export function withDetailsToggled(hidden: Record<string, boolean>, key: string): Record<string, boolean> {
  const { [key]: wasHidden, ...others } = hidden;
  return wasHidden ? others : { ...others, [key]: true };
}

export const useDetailsPaneStore = create<DetailsPaneStore>()(
  persist(
    (set) => ({
      widths: {},
      hidden: {},
      setWidth: (key, width) => set((state) => ({ widths: { ...state.widths, [key]: width } })),
      toggleHidden: (key) => set((state) => ({ hidden: withDetailsToggled(state.hidden, key) })),
    }),
    // Version 0 kept one width for every view; each view starts from its default instead.
    { name: 'details-width', version: 1, migrate: () => ({ widths: {}, hidden: {} }) },
  ),
);

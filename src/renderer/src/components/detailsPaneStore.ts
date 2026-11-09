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
  /**
   * The views showing now without their details, as they started (a review with nothing in its Comments panel): not
   * the user's choice, so never kept, and the next one starts as the user left them (`startHidden`). Showing them
   * again is the user's choice (`toggledDetails`).
   */
  startedHidden?: Record<string, boolean>;
}

interface DetailsPaneStore extends DetailsPaneState {
  setWidth: (key: string, width: number) => void;
  /** Hides a view's details, or shows them again. */
  toggleHidden: (key: string) => void;
  /** Shows a view's details, for what only they show: the lines a link names. */
  showDetails: (key: string) => void;
  /** Starts a view without its details, until it's left (`forgetStarted`) or they're shown. */
  startHidden: (key: string) => void;
  /** Forgets how a view started, as it's left. */
  forgetStarted: (key: string) => void;
}

/** A view's details width: the one it was left at, within its limits, else its default. */
export function detailsWidthOf(state: Pick<DetailsPaneState, 'widths'>, key: string, limits: DetailsWidthLimits): number {
  const width = state.widths[key] ?? limits.initial;
  return Math.min(Math.max(width, limits.min), limits.max);
}

/** Whether a view's details are hidden: shown until the user hides them. */
export function detailsHidden(state: Pick<DetailsPaneState, 'hidden' | 'startedHidden'>, key: string): boolean {
  return (state.startedHidden?.[key] ?? false) || (state.hidden[key] ?? false);
}

/** A view's details shown or hidden by the user: shown, when it started without them; else as they were, the other way. */
export function toggledDetails(state: Pick<DetailsPaneState, 'hidden' | 'startedHidden'>, key: string): Pick<Required<DetailsPaneState>, 'hidden' | 'startedHidden'> {
  const { [key]: started, ...othersStarted } = state.startedHidden ?? {};
  return started ? { hidden: withDetailsShown(state.hidden, key), startedHidden: othersStarted } : { hidden: withDetailsToggled(state.hidden, key), startedHidden: othersStarted };
}

/** The views' hidden details with one view's hidden or shown again. */
export function withDetailsToggled(hidden: Record<string, boolean>, key: string): Record<string, boolean> {
  const { [key]: wasHidden, ...others } = hidden;
  return wasHidden ? others : { ...others, [key]: true };
}

/** The views' hidden details with one view's shown. */
export function withDetailsShown(hidden: Record<string, boolean>, key: string): Record<string, boolean> {
  return hidden[key] ? withDetailsToggled(hidden, key) : hidden;
}

function withoutKey(record: Record<string, boolean> | undefined, key: string): Record<string, boolean> {
  const { [key]: _gone, ...others } = record ?? {};
  return others;
}

export const useDetailsPaneStore = create<DetailsPaneStore>()(
  persist(
    (set) => ({
      widths: {},
      hidden: {},
      setWidth: (key, width) => set((state) => ({ widths: { ...state.widths, [key]: width } })),
      startedHidden: {},
      toggleHidden: (key) => set((state) => toggledDetails(state, key)),
      showDetails: (key) => set((state) => ({ hidden: withDetailsShown(state.hidden, key), startedHidden: withoutKey(state.startedHidden, key) })),
      startHidden: (key) => set((state) => ({ startedHidden: { ...state.startedHidden, [key]: true } })),
      forgetStarted: (key) => set((state) => ({ startedHidden: withoutKey(state.startedHidden, key) })),
    }),
    // Version 0 kept one width for every view; each view starts from its default instead. Named for the widths it held
    // first: renamed, the widths remembered would be lost.
    // How a view started isn't the user's choice: never kept (`partialize`).
    { name: 'details-width', version: 1, migrate: () => ({ widths: {}, hidden: {} }), partialize: ({ widths, hidden }) => ({ widths, hidden }) },
  ),
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_COMPARISON_METHOD, type ComparisonMethod } from './comparisonMethod';
import type { Representation } from './diffPresentation';
import type { AnchorMode } from './image/composedFrame';
import type { ImageDiffMode } from './image/imageDiffModes';

export type DiffLayout = 'split' | 'unified';

interface DiffPreferences {
  layout: DiffLayout;
  collapseUnchanged: boolean;
  wrapLines: boolean;
  /** Which differences between two texts count, like the official Desktop client's comparison method; for every text diff. */
  comparisonMethod: ComparisonMethod;
  imageMode: ImageDiffMode;
  /** Text or rendered, for files that are both (SVG), by lowercase extension; rendered unless picked otherwise. */
  representations: Record<string, Representation>;
  /** How two differently-sized images line up. A workflow preference: a QA pass sets it once. */
  imageAnchor: AnchorMode;
  /** Pixel drift the differences mode ignores (compression noise, anti-aliasing). */
  imageTolerance: number;
  setLayout: (layout: DiffLayout) => void;
  setCollapseUnchanged: (collapse: boolean) => void;
  setWrapLines: (wrap: boolean) => void;
  setComparisonMethod: (method: ComparisonMethod) => void;
  setImageMode: (mode: ImageDiffMode) => void;
  setRepresentation: (extension: string, representation: Representation) => void;
  setImageAnchor: (anchor: AnchorMode) => void;
  setImageTolerance: (tolerance: number) => void;
}

export const useDiffPreferences = create<DiffPreferences>()(
  persist(
    (set) => ({
      layout: 'split',
      collapseUnchanged: true,
      wrapLines: false,
      comparisonMethod: DEFAULT_COMPARISON_METHOD,
      imageMode: 'sideBySide',
      representations: {},
      imageAnchor: 'center',
      imageTolerance: 0,
      setLayout: (layout) => set({ layout }),
      setCollapseUnchanged: (collapseUnchanged) => set({ collapseUnchanged }),
      setWrapLines: (wrapLines) => set({ wrapLines }),
      setComparisonMethod: (comparisonMethod) => set({ comparisonMethod }),
      setImageMode: (imageMode) => set({ imageMode }),
      setRepresentation: (extension, representation) =>
        set((state) => ({ representations: { ...state.representations, [extension]: representation } })),
      setImageAnchor: (imageAnchor) => set({ imageAnchor }),
      setImageTolerance: (imageTolerance) => set({ imageTolerance }),
    }),
    { name: 'diff-preferences' },
  ),
);

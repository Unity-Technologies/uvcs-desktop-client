import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_COMPARISON_METHOD, type ComparisonMethod } from './comparisonMethod';
import type { Representation } from './diffPresentation';
import type { AnchorMode } from './image/composedFrame';
import type { ImageDiffMode } from './image/imageDiffModes';
import type { ModelDiffMode } from './model/modelDiffModes';
import type { DrawMode } from './model/modelRenderer';
import { surfaceFromColorBySlot, type SurfaceLook } from './model/surfaceLook';

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
  /** How two models are compared; apart from images', as a team may read textures one way and models another. */
  modelMode: ModelDiffMode;
  /** Unity's Scene view draw modes: shaded, wireframe, or both. */
  modelDrawMode: DrawMode;
  /** Clay, each material slot in its color, or the materials as Unity shows them (`SurfaceLook`). */
  modelSurface: SurfaceLook;
  /** Each version's skeleton drawn over it. */
  modelShowBones: boolean;
  /** The "What changed" panel open; folded by default, so the model has the stage, its count and risks still shown. */
  modelChangesOpen: boolean;
  /** How far a vertex may move and still count as unchanged, as a share of the model's size: one setting fits a bolt and a building. */
  modelToleranceShare: number;
  setLayout: (layout: DiffLayout) => void;
  setCollapseUnchanged: (collapse: boolean) => void;
  setWrapLines: (wrap: boolean) => void;
  setComparisonMethod: (method: ComparisonMethod) => void;
  setImageMode: (mode: ImageDiffMode) => void;
  setRepresentation: (extension: string, representation: Representation) => void;
  setImageAnchor: (anchor: AnchorMode) => void;
  setImageTolerance: (tolerance: number) => void;
  setModelMode: (mode: ModelDiffMode) => void;
  setModelDrawMode: (drawMode: DrawMode) => void;
  setModelSurface: (surface: SurfaceLook) => void;
  setModelToleranceShare: (share: number) => void;
  setModelShowBones: (show: boolean) => void;
  setModelChangesOpen: (open: boolean) => void;
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
      modelMode: 'sideBySide',
      modelDrawMode: 'shaded',
      modelSurface: 'clay',
      modelToleranceShare: 0.001,
      modelShowBones: false,
      modelChangesOpen: false,
      setLayout: (layout) => set({ layout }),
      setCollapseUnchanged: (collapseUnchanged) => set({ collapseUnchanged }),
      setWrapLines: (wrapLines) => set({ wrapLines }),
      setComparisonMethod: (comparisonMethod) => set({ comparisonMethod }),
      setImageMode: (imageMode) => set({ imageMode }),
      setRepresentation: (extension, representation) =>
        set((state) => ({ representations: { ...state.representations, [extension]: representation } })),
      setImageAnchor: (imageAnchor) => set({ imageAnchor }),
      setImageTolerance: (imageTolerance) => set({ imageTolerance }),
      setModelMode: (modelMode) => set({ modelMode }),
      setModelDrawMode: (modelDrawMode) => set({ modelDrawMode }),
      setModelSurface: (modelSurface) => set({ modelSurface }),
      setModelToleranceShare: (modelToleranceShare) => set({ modelToleranceShare }),
      setModelShowBones: (modelShowBones) => set({ modelShowBones }),
      setModelChangesOpen: (modelChangesOpen) => set({ modelChangesOpen }),
    }),
    { name: 'diff-preferences', version: 1, migrate: migrateDiffPreferences },
  ),
);

/** Version 0 kept slot colors as `modelColorBySlot`: version 1 keeps the surface look, one choice of three. */
export function migrateDiffPreferences(persisted: unknown, version: number): DiffPreferences {
  const { modelColorBySlot, ...rest } = (persisted ?? {}) as Partial<DiffPreferences> & { modelColorBySlot?: unknown };
  return (version < 1 ? { ...rest, modelSurface: surfaceFromColorBySlot(modelColorBySlot) } : rest) as DiffPreferences;
}

// How many rows of pills (or notes in their place) the stage shows at its top centre, so the floating "What changed"
// panel starts below them instead of under them (`ModelChangesPanel`'s `pillRows`).

import type { ModelDiffMode } from './modelDiffModes';
import type { DiffsCompares } from './surfaceLook';

interface StageTop {
  /** The mode shown; null for a version alone. */
  mode: ModelDiffMode | null;
  diffsCompares: DiffsCompares;
  /** The shape's changed regions, stepped through on a row of their own. */
  regionCount: number;
  /** Both versions' textures are loaded (`texturesSettled`): until then Diffs by look says it is loading them. */
  looksLoaded: boolean;
}

export function stagePillRows({ mode, diffsCompares, regionCount, looksLoaded }: StageTop): 0 | 1 | 2 {
  if (mode === 'onion') return 1;
  if (mode !== 'differences') return 0;
  if (diffsCompares === 'look') return looksLoaded ? 0 : 1;
  return regionCount > 0 ? 2 : 1;
}

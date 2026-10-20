// Why a texture a model's materials use doesn't show, in plain words for the info strip's tooltip. Its slot shows its
// material's color meanwhile (or clay): a missing texture never fails the model or the other textures.

import { imageProblemWords, type ImageProblem } from './imageProblems';

export type TextureProblem =
  /** Its file doesn't decode (`ImageProblem`). */
  | ImageProblem
  /** No file of its name where Unity looks, where the version is (`AssetsPoint`). */
  | 'missing'
  /** A `.psb` in a project without the 2D PSD Importer package: Unity doesn't import it. */
  | 'psbNotImported'
  /** Past the most textures one model shows (`MAX_TEXTURE_FILES`). */
  | 'overBudget';

type ModelProblem = Exclude<TextureProblem, ImageProblem>;

const WORDS: Record<ModelProblem, string> = {
  missing: 'not found where Unity looks',
  psbNotImported: "this project doesn't import PSB files",
  overBudget: 'past the 64 textures a model shows',
};

export function textureProblemWords(problem: TextureProblem): string {
  return isModelProblem(problem) ? WORDS[problem] : imageProblemWords(problem);
}

function isModelProblem(problem: TextureProblem): problem is ModelProblem {
  return problem in WORDS;
}

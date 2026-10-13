// Why a texture a model's materials use doesn't show, in plain words for the info strip's tooltip. Its slot shows its
// material's color meanwhile (or clay): a missing texture never fails the model or the other textures.

export type TextureProblem =
  /** No file of its name where Unity looks, in the workspace on disk. */
  | 'missing'
  /** DDS, KTX and the like: GPU formats, and the rare ones. */
  | 'unsupportedFormat'
  /** Past what the viewer reads or decodes (`MAX_TEXTURE_SIDE`, `MAX_TEXTURE_PIXELS`, the read's size cap). */
  | 'tooLarge'
  /** A Photoshop file whose composite image is blank: saved without "Maximize Compatibility". */
  | 'psdWithoutComposite'
  /** A Photoshop file in CMYK, Lab, indexed, bitmap or 32 bits per channel. */
  | 'psdColorMode'
  /** A `.psb` in a project without the 2D PSD Importer package: Unity doesn't import it. */
  | 'psbNotImported'
  /** Past the most textures one model shows (`MAX_TEXTURE_FILES`). */
  | 'overBudget'
  /** Bytes that don't decode, or a read that failed. */
  | 'unreadable';

const WORDS: Record<TextureProblem, string> = {
  missing: 'not in the workspace',
  unsupportedFormat: "this format isn't shown",
  tooLarge: 'too large to show',
  psdWithoutComposite: "can't read this PSD: save it with Maximize Compatibility",
  psdColorMode: "can't read this PSD: save it as 8 or 16-bit RGB",
  psbNotImported: "this project doesn't import PSB files",
  overBudget: 'past the 64 textures a model shows',
  unreadable: "couldn't read it",
};

export function textureProblemWords(problem: TextureProblem): string {
  return WORDS[problem];
}

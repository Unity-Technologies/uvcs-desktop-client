// Why an image file's bytes don't decode, in plain words: whatever shows the image says so in its own place (a
// texture's in the model diff's info strip tooltip).

export type ImageProblem =
  /** DDS, KTX and the like: GPU formats, and the rare ones. */
  | 'unsupportedFormat'
  /** Past what is decoded (`MAX_TEXTURE_SIDE`, `MAX_TEXTURE_PIXELS`, the read's size cap). */
  | 'tooLarge'
  /** A Photoshop file whose composite image is blank: saved without "Maximize Compatibility". */
  | 'psdWithoutComposite'
  /** A Photoshop file in CMYK, Lab, indexed, bitmap or 32 bits per channel. */
  | 'psdColorMode'
  /** Bytes that don't decode, or a read that failed. */
  | 'unreadable';

const WORDS: Record<ImageProblem, string> = {
  unsupportedFormat: "this format isn't shown",
  tooLarge: 'too large to show',
  psdWithoutComposite: "can't read this PSD: save it with Maximize Compatibility",
  psdColorMode: "can't read this PSD: save it as 8 or 16-bit RGB",
  unreadable: "couldn't read it",
};

export function imageProblemWords(problem: ImageProblem): string {
  return WORDS[problem];
}

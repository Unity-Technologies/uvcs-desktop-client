import type { FileContent } from '@shared/domain/content';

/** How a pair of file versions is shown. */
export type DiffPresentation =
  | { kind: 'tooLarge'; content: 'text' | 'image' }
  /** Text on both sides. `empty`: both are 0 bytes (e.g. an added empty file). */
  | { kind: 'text'; empty: boolean; identical: boolean }
  /** `comparable`: both sides are images; otherwise one side is missing (added or deleted). */
  | { kind: 'image'; comparable: boolean }
  | { kind: 'binary' };

/** How a file that is text and an image at once (SVG) is shown: as its text or rendered. */
export type Representation = 'text' | 'image';

/** Both versions read as text and render as images (or one is missing): the user picks how to see them. */
export function hasTwoRepresentations(left: FileContent, right: FileContent): boolean {
  if (left.isBinary || right.isBinary || !(left.imageDataUrl || right.imageDataUrl)) return false;
  return [left, right].every((side) => side.imageDataUrl || side.size === 0);
}

/** `representation` only matters to files that have both (`hasTwoRepresentations`); others show as what they are. */
export function diffPresentation(left: FileContent, right: FileContent, representation: Representation = 'text'): DiffPresentation {
  const tooLarge = left.tooLarge ?? right.tooLarge;
  if (tooLarge) return { kind: 'tooLarge', content: tooLarge };
  if (representation === 'image' && hasTwoRepresentations(left, right)) return imagePresentation(left, right);
  if (!left.isBinary && !right.isBinary) {
    return { kind: 'text', empty: left.size === 0 && right.size === 0, identical: left.text === right.text };
  }
  if (left.imageDataUrl || right.imageDataUrl) return imagePresentation(left, right);
  return { kind: 'binary' };
}

/**
 * Whether a text diff shows lines, so the header's ways of viewing them (comparison method, collapse, wrap,
 * Split/Unified) have something to act on: not an empty or unchanged file that can't be typed into, which shows a
 * note instead.
 */
export function showsLines(presentation: DiffPresentation, editable: boolean): boolean {
  return presentation.kind === 'text' && (editable || !(presentation.empty || presentation.identical));
}

function imagePresentation(left: FileContent, right: FileContent): DiffPresentation {
  return { kind: 'image', comparable: Boolean(left.imageDataUrl && right.imageDataUrl) };
}

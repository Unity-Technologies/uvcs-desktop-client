import type { FileContent } from '@shared/domain/content';

/** How a pair of file versions is shown. */
export type DiffPresentation =
  | { kind: 'tooLarge'; content: 'text' | 'image' | 'model' }
  /** Text on both sides. `empty`: both are 0 bytes (e.g. an added empty file). */
  | { kind: 'text'; empty: boolean; identical: boolean }
  /** `comparable`: both sides are images; otherwise one side is missing (added or deleted). */
  | { kind: 'image'; comparable: boolean }
  /** `comparable`: both sides are 3D models; otherwise one side is missing (added or deleted). */
  | { kind: 'model'; comparable: boolean }
  | { kind: 'binary' };

/** How a file that is text and rendered at once (SVG, OBJ, ASCII FBX) is shown: as its text or rendered. */
export type Representation = 'text' | RenderedRepresentation;
type RenderedRepresentation = 'image' | 'model';

/** What a pair of versions renders as besides text: an image (SVG) or a 3D model (OBJ, ASCII FBX); null if neither. */
export function renderedRepresentation(left: FileContent, right: FileContent): RenderedRepresentation | null {
  if (left.model || right.model) return 'model';
  if (left.image || right.image) return 'image';
  return null;
}

/** Both versions read as text and render (or one is missing): the user picks how to see them. */
export function hasTwoRepresentations(left: FileContent, right: FileContent): boolean {
  const rendered = renderedRepresentation(left, right);
  if (left.isBinary || right.isBinary || !rendered) return false;
  return [left, right].every((side) => rendersAs(side, rendered) || side.size === 0);
}

/** `representation` only matters to files that have both (`hasTwoRepresentations`); others show as what they are. */
export function diffPresentation(left: FileContent, right: FileContent, representation: Representation = 'text'): DiffPresentation {
  const tooLarge = left.tooLarge ?? right.tooLarge;
  if (tooLarge) return { kind: 'tooLarge', content: tooLarge };
  const rendered = renderedRepresentation(left, right);
  if (rendered && representation !== 'text' && hasTwoRepresentations(left, right)) return renderedPresentation(left, right, rendered);
  if (!left.isBinary && !right.isBinary) {
    return { kind: 'text', empty: left.size === 0 && right.size === 0, identical: left.text === right.text };
  }
  if (rendered) return renderedPresentation(left, right, rendered);
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

function rendersAs(content: FileContent, rendered: RenderedRepresentation): boolean {
  return Boolean(rendered === 'model' ? content.model : content.image);
}

function renderedPresentation(left: FileContent, right: FileContent, rendered: RenderedRepresentation): DiffPresentation {
  return { kind: rendered, comparable: rendersAs(left, rendered) && rendersAs(right, rendered) };
}

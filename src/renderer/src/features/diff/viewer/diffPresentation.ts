import type { FileContent } from '@shared/domain/content';

/** How a pair of file versions is shown. */
export type DiffPresentation =
  | { kind: 'tooLarge'; content: 'text' | 'image' }
  /** Text on both sides. `empty`: both are 0 bytes (e.g. an added empty file). */
  | { kind: 'text'; empty: boolean; identical: boolean }
  /** `comparable`: both sides are images; otherwise one side is missing (added or deleted). */
  | { kind: 'image'; comparable: boolean }
  | { kind: 'binary' };

export function diffPresentation(left: FileContent, right: FileContent): DiffPresentation {
  const tooLarge = left.tooLarge ?? right.tooLarge;
  if (tooLarge) return { kind: 'tooLarge', content: tooLarge };
  if (!left.isBinary && !right.isBinary) {
    return { kind: 'text', empty: left.size === 0 && right.size === 0, identical: left.text === right.text };
  }
  if (left.imageDataUrl || right.imageDataUrl) return { kind: 'image', comparable: Boolean(left.imageDataUrl && right.imageDataUrl) };
  return { kind: 'binary' };
}

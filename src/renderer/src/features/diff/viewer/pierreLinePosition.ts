import type { Virtualizer } from '@pierre/diffs';
import type { ChangedLine } from './changeBlocks';

/**
 * Where a line of a diff that renders only the lines in view sits in the scrolling element, rendered or not: Pierre
 * (1.5.1) lays the diff out from line heights it knows or estimates (`VirtualizedFileDiff.getLinePosition`, from the
 * file's top, `top`), and the viewer's virtualizer holds that diff by its `diffs-container` (`observers`, private).
 * `pierreLinePosition.test.ts` fails when an update moves what this reaches.
 */
export function pierreLinePosition(virtualizer: Virtualizer, fileContainer: Element, { side, lineNumber }: ChangedLine): number | undefined {
  const diff = (virtualizer as unknown as VirtualizerInternals).observers.get(fileContainer);
  const position = diff?.getLinePosition?.(lineNumber, side);
  return position && diff?.top !== undefined ? diff.top + position.top : undefined;
}

/** The virtualizer's members this reaches. */
export interface VirtualizerInternals {
  observers: Map<Element, { top?: number; getLinePosition?: (lineNumber: number, side: ChangedLine['side']) => { top: number; height: number } | undefined }>;
}

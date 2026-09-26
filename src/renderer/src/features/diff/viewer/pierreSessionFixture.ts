import { DiffHunksRenderer, FileDiff, type FileDiffMetadata } from '@pierre/diffs';
import { shownText } from '../../../lib/lineBreaks';
import type { ComparisonMethod } from './comparisonMethod';
import { lineDiff, lineDiffOptions } from './lineDiff';
import { installPierreLineComparison } from './pierreLineComparison';

/** A change block of a diff: where it starts in the original (0-based) and how many lines it removes and adds. */
export interface Change {
  at: number;
  removed: number;
  added: number;
}

export function changesOf(diff: FileDiffMetadata): Change[] {
  return diff.hunks.flatMap((hunk) => hunk.hunkContent.flatMap((part) => (part.type === 'change' ? [{ at: part.deletionLineIndex, removed: part.deletions, added: part.additions }] : [])));
}

/**
 * For tests: Pierre's renderer as its `FileDiff` makes it, in the edit session of a diff typed into, as the viewer has
 * it (`lineDiff` of `original` and `modified`, rendered) before the first keystroke.
 */
export async function typedIntoPierre(original: string, modified: string, method: ComparisonMethod, current = modified) {
  installPierreLineComparison();
  const parseDiffOptions = lineDiffOptions(original, current, method);
  const component = new FileDiff({ parseDiffOptions, theme: 'github-light' }) as unknown as { getHunksRendererOptions(options: unknown): object; options: unknown };
  const renderer = new DiffHunksRenderer(component.getHunksRendererOptions(component.options));
  const diff = { ...lineDiff(original, modified, method, 'file.ts').meta };
  renderer.beginEditSession(diff);
  await renderer.asyncRender(diff);
  renderer.renderDiff(diff);
  return {
    diff,
    /** Types over line `index` (0-based) so it reads `text`, as the editor reports a keystroke within a line. */
    type(index: number, text: string): void {
      renderer.updateRenderCache(new Map([[index, [[0, '', text]]]]), 'light');
    },
    /** The editor's text is now `text` (lone CRs shown as LFs), as it reports an edit that moves lines. */
    replace(text: string): void {
      const lines = shownText(text).match(/[^\n]*\n|[^\n]+$/g) ?? [];
      renderer.applyDocumentChange({ lineCount: lines.length, getLineText: (line: number) => lines[line] ?? '' } as never);
    },
  };
}

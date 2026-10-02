import { FileDiff, type DiffHunksRenderer, type FileDiffMetadata } from '@pierre/diffs';
import { shownText } from '../../../lib/lineBreaks';
import type { ComparisonMethod } from './comparisonMethod';
import { lineDiff, lineDiffOptions } from './lineDiff';
import { installPierreLineComparison } from './pierreLineComparison';
import { renderedWordMarks, type WordMarks } from './renderedWordMarks';
import { shownDiff, type DiffSides } from './shownDiff';

/** A change block of a diff: where it starts in the original (0-based) and how many lines it removes and adds. */
export interface Change {
  at: number;
  removed: number;
  added: number;
}

/** The diff's change blocks. A diff from an empty file starts its one change at -1 or 0 depending on who worked it out. */
export function changesOf(diff: FileDiffMetadata): Change[] {
  return diff.hunks.flatMap((hunk) => hunk.hunkContent.flatMap((part) => (part.type === 'change' ? [{ at: Math.max(0, part.deletionLineIndex), removed: part.deletions, added: part.additions }] : [])));
}

/**
 * The changes Pierre's diff shows as lines of the file. It keeps the editor's empty last line (after a final line
 * break, or the one line of an empty text) as an added line when the last change removes more lines than it adds; the
 * viewer shows that line as an unchanged empty one (`caretLineCss`).
 */
export function fileChangesOf(diff: FileDiffMetadata): Change[] {
  const lines = diff.additionLines;
  const caretLine = lines.at(-1) === '' ? lines.length : -1;
  return diff.hunks.flatMap((hunk) =>
    hunk.hunkContent.flatMap((part) => {
      if (part.type !== 'change') return [];
      const added = part.additionLineIndex + part.additions === caretLine ? part.additions - 1 : part.additions;
      return added === 0 && part.deletions === 0 ? [] : [{ at: Math.max(0, part.deletionLineIndex), removed: part.deletions, added }];
    }),
  );
}

/** How many rows (gutter, content) each column of a rendered diff has. */
type Rows = Record<'deletions' | 'additions' | 'unified', number[]>;

const BOTH_SIDES: DiffSides = { original: true, modified: true };

/**
 * For tests: Pierre's renderer as its `FileDiff` makes it, in the edit session of a diff typed into, as the viewer has
 * it (`lineDiff` of `original` and `modified`, shown by `shownDiff` and rendered) before the first keystroke.
 */
export async function typedIntoPierre(original: string, modified: string, method: ComparisonMethod, current = modified, sides = BOTH_SIDES) {
  installPierreLineComparison();
  const parseDiffOptions = lineDiffOptions(original, current, method);
  const component = new FileDiff({ parseDiffOptions, theme: 'github-light', lineDiffType: 'word' });
  // Its own renderer, made as Pierre makes it (`getHunksRendererOptions`, which `installPierreLineComparison` patches).
  const renderer = (component as unknown as { hunksRenderer: DiffHunksRenderer }).hunksRenderer;
  const diff = shownDiff(lineDiff(original, modified, method, 'file.ts').meta, sides, original, modified, true);
  renderer.beginEditSession(diff);
  await renderer.asyncRender(diff);
  const rowsNow = (): Rows => {
    const result = renderer.renderDiff(diff)!;
    const count = (column: 'deletions' | 'additions' | 'unified') => (renderer.renderCodeAST(column, result) ?? []).map((part) => (part as { children?: unknown[] }).children?.length ?? 0);
    return { deletions: count('deletions'), additions: count('additions'), unified: count('unified') };
  };
  // The rows on screen: rendered whole at first, and whenever the renderer asks for it or the lines move.
  let onScreen = rowsNow();
  const keystroke = (dirtyLines: Map<number, [number, string, string][]>): boolean => {
    const whole = renderer.updateRenderCache(dirtyLines, 'light');
    if (whole) onScreen = rowsNow();
    return whole;
  };
  return {
    diff,
    /** The component the renderer is part of, as the editor attaches to it; it has no page to render into. */
    component,
    /** Types over line `index` (0-based) so it reads `text`, as the editor reports a keystroke within a line. Whether
     * the renderer asks for the diff to be rendered whole. */
    type(index: number, text: string): boolean {
      return keystroke(new Map([[index, [[0, '', text]]]]));
    },
    /**
     * Types over line `index` as the editor reports it when it re-tokenizes from there: `lines` from it on. Whether
     * the renderer asks for the diff to be rendered whole.
     */
    retokenize(index: number, lines: string[]): boolean {
      return keystroke(new Map(lines.map((text, offset) => [index + offset, [[0, '', text]]])));
    },
    /**
     * The editor's text is now `text` (lone CRs shown as LFs), as it reports an edit that moves lines: its lines, each
     * with its line break, and an empty last one after a final line break (where the caret goes), as its document has.
     */
    replace(text: string): void {
      const lines = `${shownText(text)}\0`.split(/(?<=\n)/).map((line) => line.replace('\0', ''));
      renderer.applyDocumentChange({ lineCount: lines.length, getLineText: (line: number) => lines[line] ?? '' } as never);
      onScreen = rowsNow();
    },
    /**
     * Whether the rows on screen are still the diff's: after a keystroke within a line that isn't rendered whole,
     * Pierre recolors the rows it has in place, and only while there are as many as the diff has now
     * (`refreshSplitDiffView`); otherwise they keep the colors they had.
     */
    rowsInStep(): boolean {
      return JSON.stringify(onScreen) === JSON.stringify(rowsNow());
    },
    /** The words the rows mark as changed, rendered now (from what the renderer keeps, or anew once it keeps nothing). */
    wordMarks(): WordMarks {
      return renderedWordMarks(renderer, renderer.renderDiff(diff)!);
    },
  };
}

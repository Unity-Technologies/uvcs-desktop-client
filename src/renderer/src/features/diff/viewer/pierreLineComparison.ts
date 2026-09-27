import { DiffHunksRenderer, FileDiff, parseDiffFromFile, type DiffHunksRendererOptions, type FileDiffMetadata, type FileDiffOptions } from '@pierre/diffs';
import { looseLineKey, type LineDiffOptions } from './lineDiff';

/**
 * Makes the diff Pierre works out while a file is typed into compare lines like the one it was given (`lineDiff`), in
 * `parseDiffOptions`, and show it right. Pierre (1.5.1) re-diffs every keystroke in the `DiffHunksRenderer` of its
 * `FileDiff`, and:
 *
 * 1. `FileDiff` never hands its renderer `parseDiffOptions` (`getDiffHunksRendererOptions` leaves them out), so typing
 *    re-diffed under Recognize all whatever the comparison method: spaces typed under Ignore whitespaces showed as a
 *    change until the file was saved and diffed anew.
 * 2. A keystroke that keeps the line count keeps the diff's change blocks as they were when the line's text, before and
 *    after, is the text of no original line (`canRetainCanonicalBlocks`). Only `diff`'s own `ignoreWhitespace` and
 *    `stripTrailingCr` turn that shortcut off, not a comparator: a changed line typed back to its original with other
 *    indentation stayed a change. The renderer re-diffs from the whole text when a typed line equals an original line
 *    by the comparison but not in text (`looseLineKey`).
 * 3. Text typed back to the original's shows no change (`parseSessionChangeBlocks` returns none when `findDivergenceCore`
 *    finds the texts the same), though a comparator can tell lines of the same text apart: lone CRs against LFs
 *    under Recognize all showed nothing changed until the file was saved. The renderer re-diffs the whole text then.
 *    Upstream, `editSessionHunks.ts` would take that shortcut only when lines compare as their text, as
 *    `canRetainCanonicalBlocks` does; this goes once it does.
 * 4. A keystroke the editor re-tokenizes to the end of a text ending with a line break hands the renderer the editor's
 *    empty last line too, which the diff has no row for. The editor appends one, the refresh after the keystroke only
 *    updates rows while there are as many as the diff has, and the rows stay as they were: the last line lost its
 *    change color and its number showed over the empty line's. The renderer re-renders the diff whole then, as it does
 *    when a keystroke changes the diff's regions (upstream, the editor's `#rerender` wouldn't append rows past the
 *    diff's lines without a line count change).
 *
 * All reach into Pierre's internals; `pierreLineComparison.test.ts` fails when an update moves them.
 */
export function installPierreLineComparison(): void {
  if (installed) return;
  installed = true;

  const fileDiff = FileDiff.prototype as unknown as { getHunksRendererOptions(options: FileDiffOptions<unknown, unknown> | undefined): DiffHunksRendererOptions };
  const hunksRendererOptions = fileDiff.getHunksRendererOptions;
  fileDiff.getHunksRendererOptions = function (this: unknown, options) {
    return { ...hunksRendererOptions.call(this, options), parseDiffOptions: options?.parseDiffOptions };
  };

  const renderer = DiffHunksRenderer.prototype as unknown as SessionRenderer;
  const applySessionDocumentChange = renderer.applySessionDocumentChange;
  renderer.applySessionDocumentChange = function (this: SessionRenderer, diff, previousAdditionLines) {
    applySessionDocumentChange.call(this, diff, previousAdditionLines);
    rediffSameText(this, diff);
  };

  const updateRenderCache = renderer.updateRenderCache;
  renderer.updateRenderCache = function (this: SessionRenderer, dirtyLines, themeType, lineCountChangeInFlight) {
    const key = looseLineKey(this.options.parseDiffOptions as LineDiffOptions | undefined);
    const session = this.editSessionActive && !lineCountChangeInFlight ? this.renderCache?.diff : undefined;
    const diff = key ? session : undefined;
    const before = diff && [...dirtyLines.keys()].map((line): [number, string | undefined] => [line, diff.additionLines[line]]);
    const regionsChanged = updateRenderCache.call(this, dirtyLines, themeType, lineCountChangeInFlight);
    if (!session || session.isPartial) return regionsChanged;
    if (!regionsChanged && diff && key && before && typedBackLoosely(diff, key, before)) {
      const previousLines = diff.additionLines.slice();
      for (const [line, previous] of before) if (previous !== undefined) previousLines[line] = previous;
      this.applySessionDocumentChange(diff, previousLines);
      return true;
    }
    const rediffed = rediffSameText(this, session);
    return regionsChanged || rediffed || [...dirtyLines.keys()].some((line) => line >= session.additionLines.length);
  };
}

/** Whether a keystroke typed a line to or from one equal to an original line by the comparison but not in text. */
function typedBackLoosely(diff: FileDiffMetadata, key: (line: string) => string | null, before: [number, string | undefined][]): boolean {
  const original = originalLines(diff.deletionLines, key);
  const loose = (line: string | undefined): boolean => {
    if (line === undefined || original.texts.has(line)) return false;
    const compared = key(line);
    return compared !== null && original.keys.has(compared);
  };
  return before.some(([line, previous]) => previous !== diff.additionLines[line] && (loose(previous) || loose(diff.additionLines[line])));
}

/**
 * When the session's text is the original's, yet its comparator tells some line from itself and the diff shows no
 * change, re-diffs the whole text under it. Whether the diff changed.
 */
function rediffSameText(renderer: SessionRenderer, diff: FileDiffMetadata): boolean {
  const options = renderer.options.parseDiffOptions;
  const comparator = (options as { comparator?: (left: string, right: string) => boolean } | undefined)?.comparator;
  if (!comparator || !renderer.editSessionActive || diff.isPartial) return false;
  const { deletionLines, additionLines } = diff;
  // The editor's text ending with a line break has an empty last line the diff's lines don't.
  const count = additionLines.length > 1 && additionLines.at(-1) === '' ? additionLines.length - 1 : additionLines.length;
  if (count !== deletionLines.length || diff.hunks.some((hunk) => hunk.hunkContent.some((part) => part.type === 'change'))) return false;
  if (deletionLines.some((line, index) => line !== additionLines[index]) || deletionLines.every((line) => comparator(line, line))) return false;
  const text = deletionLines.join('');
  const { hunks, splitLineCount, unifiedLineCount } = parseDiffFromFile(
    { name: diff.prevName ?? diff.name, contents: text },
    { name: diff.name, contents: text, lang: diff.lang },
    options,
  );
  renderer.applyRecomputePreservingSessionType(diff, { hunks, splitLineCount, unifiedLineCount });
  return true;
}

let installed = false;

/** The renderer's members this reaches: `updateRenderCache` is public, the rest private. */
interface SessionRenderer {
  options: DiffHunksRendererOptions;
  editSessionActive: boolean;
  renderCache: { diff: FileDiffMetadata } | undefined;
  updateRenderCache(dirtyLines: Map<number, unknown>, themeType: 'dark' | 'light', lineCountChangeInFlight?: boolean): boolean;
  applySessionDocumentChange(diff: FileDiffMetadata, previousAdditionLines: readonly string[]): void;
  applyRecomputePreservingSessionType(diff: FileDiffMetadata, update: Partial<FileDiffMetadata>): void;
}

const ORIGINAL_LINES = new WeakMap<string[], { key: (line: string) => string | null; texts: Set<string>; keys: Set<string> }>();

/** The original's lines and what of them the comparison compares; the original doesn't change while typing. */
function originalLines(lines: string[], key: (line: string) => string | null): { texts: Set<string>; keys: Set<string> } {
  const known = ORIGINAL_LINES.get(lines);
  if (known?.key === key) return known;
  const keys = new Set<string>();
  for (const line of lines) {
    const compared = key(line);
    if (compared !== null) keys.add(compared);
  }
  const computed = { key, texts: new Set(lines), keys };
  ORIGINAL_LINES.set(lines, computed);
  return computed;
}

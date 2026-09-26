import { DiffHunksRenderer, FileDiff, type DiffHunksRendererOptions, type FileDiffMetadata, type FileDiffOptions } from '@pierre/diffs';
import { looseLineKey, type LineDiffOptions } from './lineDiff';

/**
 * Makes the diff Pierre works out while a file is typed into compare lines like the one it was given (`lineDiff`), in
 * `parseDiffOptions`. Pierre (1.5.1) re-diffs every keystroke in the `DiffHunksRenderer` of its `FileDiff`, and:
 *
 * 1. `FileDiff` never hands its renderer `parseDiffOptions` (`getDiffHunksRendererOptions` leaves them out), so typing
 *    re-diffed under Recognize all whatever the comparison method: spaces typed under Ignore whitespaces showed as a
 *    change until the file was saved and diffed anew.
 * 2. A keystroke that keeps the line count keeps the diff's change blocks as they were when the line's text, before and
 *    after, is the text of no original line (`canRetainCanonicalBlocks`). Only `diff`'s own `ignoreWhitespace` and
 *    `stripTrailingCr` turn that shortcut off, not a comparator: a changed line typed back to its original with other
 *    indentation stayed a change. The renderer re-diffs from the whole text when a typed line equals an original line
 *    by the comparison but not in text (`looseLineKey`).
 *
 * Both reach into Pierre's internals; `pierreLineComparison.test.ts` fails when an update moves them.
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
  const updateRenderCache = renderer.updateRenderCache;
  renderer.updateRenderCache = function (this: SessionRenderer, dirtyLines, themeType, lineCountChangeInFlight) {
    const key = looseLineKey(this.options.parseDiffOptions as LineDiffOptions | undefined);
    const diff = key && this.editSessionActive && !lineCountChangeInFlight ? this.renderCache?.diff : undefined;
    const before = diff && [...dirtyLines.keys()].map((line): [number, string | undefined] => [line, diff.additionLines[line]]);
    const regionsChanged = updateRenderCache.call(this, dirtyLines, themeType, lineCountChangeInFlight);
    if (regionsChanged || !diff || !key || !before || diff.isPartial) return regionsChanged;
    const original = originalLines(diff.deletionLines, key);
    const loose = (line: string | undefined): boolean => {
      if (line === undefined || original.texts.has(line)) return false;
      const compared = key(line);
      return compared !== null && original.keys.has(compared);
    };
    if (!before.some(([line, previous]) => previous !== diff.additionLines[line] && (loose(previous) || loose(diff.additionLines[line])))) return false;
    const previousLines = diff.additionLines.slice();
    for (const [line, previous] of before) if (previous !== undefined) previousLines[line] = previous;
    this.applySessionDocumentChange(diff, previousLines);
    return true;
  };
}

let installed = false;

/** The renderer's members this reaches: `updateRenderCache` is public, the rest private. */
interface SessionRenderer {
  options: DiffHunksRendererOptions;
  editSessionActive: boolean;
  renderCache: { diff: FileDiffMetadata } | undefined;
  updateRenderCache(dirtyLines: Map<number, unknown>, themeType: 'dark' | 'light', lineCountChangeInFlight?: boolean): boolean;
  applySessionDocumentChange(diff: FileDiffMetadata, previousAdditionLines: readonly string[]): void;
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

import type { DiffPresentation } from './diffPresentation';
import { hasLineChanges, type LineDiff } from './lineDiff';

/**
 * What the viewer shows under its header for a pair of versions:
 *
 * - `editable`: a workspace file typed into, as a diff or whole (`typedIntoWhole`), under the notes about it.
 * - `emptyFile`, `noContentChanges`: a read-only text with nothing to compare says so.
 * - `onlyIgnoredChanges`: different texts the comparison method shows as equal (only their line endings changed),
 *   with the way to see them.
 * - `textDiff`: the read-only diff.
 * - `tooLarge`, `image`, `model`, `binary`: what a text diff can't show.
 * - `purged`: both versions' content was purged from the server.
 */
export type DiffBody = 'editable' | 'emptyFile' | 'noContentChanges' | 'onlyIgnoredChanges' | 'textDiff' | 'tooLarge' | 'image' | 'model' | 'binary' | 'purged';

/** `savedDiff`: the diff of the texts as read, under the comparison method (`lineDiff`); null for what isn't text. */
export function diffBodyOf(presentation: DiffPresentation, editable: boolean, savedDiff: LineDiff | null): DiffBody {
  if (presentation.kind !== 'text') return presentation.kind;
  if (editable) return 'editable';
  if (presentation.empty) return 'emptyFile';
  if (presentation.identical) return 'noContentChanges';
  return savedDiff !== null && !hasLineChanges(savedDiff) ? 'onlyIgnoredChanges' : 'textDiff';
}

/**
 * Whether the diff may have changes to step through (`useChangeNavigation`), which may come a render after it draws: a
 * read-only text diff, or a file typed into as a diff, where the view steps through changes at all. Anything else
 * (nothing to compare, only ignored changes, an image, a model, a `.meta` shown as its model, a binary) never will, so
 * its arrows go on to the files at once rather than waiting for steps (`noStepsComing`).
 */
export function stepsCanCome(body: DiffBody | 'metaModel', { wholeFile, stepsThroughChanges }: { wholeFile: boolean; stepsThroughChanges: boolean }): boolean {
  if (!stepsThroughChanges) return false;
  return body === 'textDiff' || (body === 'editable' && !wholeFile);
}

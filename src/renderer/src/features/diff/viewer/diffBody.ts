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
 * - `tooLarge`, `image`, `binary`: what a text diff can't show.
 */
export type DiffBody = 'editable' | 'emptyFile' | 'noContentChanges' | 'onlyIgnoredChanges' | 'textDiff' | 'tooLarge' | 'image' | 'binary';

/** `savedDiff`: the diff of the texts as read, under the comparison method (`lineDiff`); null for what isn't text. */
export function diffBodyOf(presentation: DiffPresentation, editable: boolean, savedDiff: LineDiff | null): DiffBody {
  if (presentation.kind !== 'text') return presentation.kind;
  if (editable) return 'editable';
  if (presentation.empty) return 'emptyFile';
  if (presentation.identical) return 'noContentChanges';
  return savedDiff !== null && !hasLineChanges(savedDiff) ? 'onlyIgnoredChanges' : 'textDiff';
}

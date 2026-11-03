import type { DiffEntry } from '@shared/domain/diff';
import { pairUnityMetas, type MetaPairs } from '../../lib/unityMetaPairs';

/** The entries of a diff with each Unity `.meta` joined to its asset (`pairUnityMetas`) when both were added, changed, deleted or moved. */
export function pairDiffMetas(entries: readonly DiffEntry[]): MetaPairs<DiffEntry> {
  return pairUnityMetas(entries, (entry) => entry.path, (entry) => entry.status);
}

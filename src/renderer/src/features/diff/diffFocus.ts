import type { DiffEntry } from '@shared/domain/diff';
import { assetOfMeta, type MetaPairs } from '../../lib/unityMetaPairs';

/**
 * The file a diff opens on: the one asked for, found by its path or, for a move, by the path it had before;
 * the first file when it isn't in the list (or none was asked for).
 */
export function entryToFocus(entries: readonly DiffEntry[], focusPath?: string): DiffEntry | undefined {
  if (focusPath === undefined) return entries[0];
  return entries.find((entry) => entry.path === focusPath) ?? entries.find((entry) => entry.oldPath === focusPath) ?? entries[0];
}

/** The row a diff opens on, and the asset whose `.meta` it shows instead (`diffedItem`), if any. */
export interface PairedFocus {
  entry: DiffEntry | undefined;
  metaShownFor: string | null;
}

/**
 * The row a diff whose Unity `.meta`s joined their assets (`pairDiffMetas`) opens on: a `.meta` that joined its asset
 * opens on the asset's row, showing the meta; anything else as `entryToFocus` finds it.
 */
export function pairedFocus(pairs: MetaPairs<DiffEntry>, focusPath?: string): PairedFocus {
  const assetPath = focusPath === undefined ? null : assetOfMeta(focusPath);
  const asset = assetPath === null ? undefined : pairs.shown.find((entry) => entry.path === assetPath && pairs.metaOf(entry)?.path === focusPath);
  if (asset) return { entry: asset, metaShownFor: asset.path };
  return { entry: entryToFocus(pairs.shown, focusPath), metaShownFor: null };
}

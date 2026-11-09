import { pairUnityMetas, type MetaPairs } from '../../lib/unityMetaPairs';
import type { MergeItem } from './mergeItems';

/**
 * The merge's items with each Unity `.meta` change joined to its asset's (`pairUnityMetas`) when the merge changes both
 * the same way. Conflicts, of files and of directories, keep their own rows, the asset's and the meta's alike: each is
 * a decision with its own panel, which a joined row would hide.
 */
export function pairMergeMetas(items: readonly MergeItem[]): MetaPairs<MergeItem> {
  // A conflict gets a kind no other item shares, so it pairs with none.
  const kindOf = (item: MergeItem) => (item.kind === 'change' ? item.change.kind : `${item.kind}:${item.key}`);
  return pairUnityMetas(items, (item) => item.path, kindOf);
}

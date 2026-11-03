import type { DiffEntry } from '@shared/domain/diff';
import { assetOfMeta, pairUnityMetas, type MetaPairs } from '../../lib/unityMetaPairs';

/**
 * The files an update brings with each Unity `.meta` joined to its asset (`pairUnityMetas`) when the update changes both
 * the same way. A `.meta` that collides with local changes (`collidesWithLocal`) keeps its own row, where its conflict
 * is seen and settled; an asset that collides still takes a clean `.meta` along.
 */
export function pairIncomingMetas(files: readonly DiffEntry[], collides: (file: DiffEntry) => boolean): MetaPairs<DiffEntry> {
  // A colliding meta gets a kind no asset shares, so it pairs with none.
  const kindOf = (file: DiffEntry) => (assetOfMeta(file.path) !== null && collides(file) ? `collides:${file.path}` : file.status);
  return pairUnityMetas(files, (file) => file.path, kindOf);
}

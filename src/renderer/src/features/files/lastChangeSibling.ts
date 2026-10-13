import type { TreeItem } from '@shared/domain/explorer';
import type { SiblingFinder } from '../diff/viewer/model/modelSiblings';

/** Finds the files a model's last change needs beside it. Not written yet: its test comes first. */
export function lastChangeSibling(_model: TreeItem, _listings: ReadonlyMap<string, TreeItem[]>): SiblingFinder {
  return () => null;
}

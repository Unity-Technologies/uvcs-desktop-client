// Where the Files view's last change of a model (`RevisionChanges`) finds the files it needs beside it: a glTF's `.bin`,
// its `.meta`. The tree's own listings hold each sibling's revision, the one before it and the changeset that made it,
// so no `cm` command is added, and a sibling under an xlink is read in its own repository, as its revision says.

import type { TreeItem } from '@shared/domain/explorer';
import { revisionIn } from '@shared/domain/revision';
import { siblingPath, workspaceSibling, type SiblingFinder } from '../diff/viewer/model/modelSiblings';

/**
 * The model's revision against the one before, each side with its sibling as the change left it: changed in the same
 * changeset (or shelve), its revision and the one before; untouched by it, its one revision on both sides. A sibling
 * changed since no longer goes with the model's revision, and one not listed (private, in a folder not opened) can't be
 * placed: none, and the viewer says what the model needs. A workspace file finds the file beside it on disk.
 */
export function lastChangeSibling(model: TreeItem, listings: ReadonlyMap<string, TreeItem[]>): SiblingFinder {
  return (side, source, path, fileName) => {
    if (source.kind !== 'revision') return workspaceSibling(side, source, path, fileName);
    const sibling = listedSibling(model, listings, fileName);
    if (!sibling || sibling.isPrivate || sibling.repository !== model.repository) return null;
    const changedWith = sibling.changeset === model.changeset && sibling.shelveId === model.shelveId;
    if (!changedWith && !changedBefore(sibling, model)) return null;
    const revisionId = side === 'original' && changedWith ? sibling.parentRevisionId : sibling.revisionId;
    const revision = revisionIn(sibling.repository, revisionId);
    return revision ? { kind: 'revision', revision, fileName: sibling.path } : null;
  };
}

/** The sibling's item, from the listing of its folder (the tree's paths always use `/`, the root is `''`). */
function listedSibling(model: TreeItem, listings: ReadonlyMap<string, TreeItem[]>, fileName: string): TreeItem | undefined {
  const path = siblingPath(model.path, fileName);
  if (path === null) return undefined;
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return listings.get(folder)?.find((item) => item.path === path);
}

/**
 * Whether the sibling's revision was made before the model's: in an earlier changeset (a repository numbers them in
 * order), or in any changeset when the model's is a shelve's (a workspace on a shelve lists what it left alone as
 * checked in).
 */
function changedBefore(sibling: TreeItem, model: TreeItem): boolean {
  if (sibling.changeset === null) return false;
  return model.changeset === null ? model.shelveId !== undefined : sibling.changeset < model.changeset;
}

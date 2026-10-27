import { existsSync } from 'node:fs';
import { copyFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { ContentSource } from '@shared/domain/content';
import { workspacePlace, type Place } from '@shared/domain/place';
import { listsTree, spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { cmPlace, workspaceOf } from '../cm/cmPlace';
import type { CmError } from '../cm/CmError';
import { isNotInTreeError } from '../cm/missingItem';
import { isPurgedRevisionError } from '../cm/purgedRevision';
import { removedItemSpec } from '../cm/removedItemSpec';
import { readTreeItem, TREE_ITEM_FORMAT } from '../cm/treeItems';
import type { WorkspaceCopies } from './WorkspaceCopies';
import { toAbsolutePath } from './workspacePaths';

/**
 * A version of a file, as it is and whatever it holds, saved to `target`. Review snapshots are read elsewhere. A
 * repository's versions are read in the place's repository (`cmPlace`); a workspace's files only in a workspace.
 */
export async function saveContent(cm: CmClient, place: Place, source: Exclude<ContentSource, { kind: 'reviewSnapshot' }>, target: string): Promise<void> {
  switch (source.kind) {
    case 'empty':
      return writeFile(target, '');
    case 'workspaceFile':
      return copyFile(toAbsolutePath(workspaceOf(place, 'A workspace file'), source.path), target);
    case 'workspaceBase':
      return saveLoadedRevision(cm, workspaceOf(place, 'The loaded revision of a file'), source.path, target);
    case 'revision':
      return saveRevision(cm, place, spec.revision(source.revision), target);
    case 'repositoryPath':
      return source.repository === undefined ? saveRepositoryPath(cm, place, source.path, source.at, target) : saveFromTree(cm, place, source.path, source.at, target);
    case 'spec':
      return saveRevision(cm, place, source.spec, target);
  }
}

/**
 * A version saved for another app (Open, Save as, a merge tool): a revision a workspace holds unchanged is copied
 * from its disk (`WorkspaceCopies`), anything else saved as `saveContent` reads it.
 */
export async function saveVersion(cm: CmClient, copies: Pick<WorkspaceCopies, 'read'>, place: Place, source: Exclude<ContentSource, { kind: 'reviewSnapshot' }>, target: string): Promise<void> {
  if (source.kind === 'revision' && place.kind === 'workspace') {
    const onDisk = await copies.read(place.workspacePath, { path: source.fileName, revision: source.revision, hash: null, size: -1 });
    if (onDisk) return writeFile(target, onDisk);
  }
  await saveContent(cm, place, source, target).catch((error: unknown) => {
    // `cm`'s line names the temp file it was to write, which tells the user nothing.
    throw isPurgedRevisionError(error, target) ? (error as CmError).withMessage(PURGED_VERSION_MESSAGE) : error;
  });
}

/** Why a version whose content a purge removed can't be opened or saved. */
export const PURGED_VERSION_MESSAGE = 'This version was purged from the server: its content is no longer available.';

async function saveLoadedRevision(cm: CmClient, workspacePath: string, path: string, target: string): Promise<void> {
  const absolutePath = toAbsolutePath(workspacePath, path);
  const inWorkspace = workspacePlace(workspacePath);
  const byPath = () => saveRevision(cm, inWorkspace, absolutePath, target);
  const throughFolder = () => saveRemovedItemRevision(cm, workspacePath, absolutePath, target);
  // A file gone from disk was most likely removed: its folder first, so no `cm cat` fails (in red, in the command log).
  if (existsSync(absolutePath)) await withFallback(byPath, throughFolder);
  else await withFallback(throughFolder, byPath);
}

/** `cm rm` takes the item out of the workspace tree, so its path stops resolving: it is found through its folder. */
async function saveRemovedItemRevision(cm: CmClient, workspacePath: string, absolutePath: string, target: string): Promise<void> {
  const xml = await cm.query(['fileinfo', dirname(absolutePath), absolutePath, '--xml'], { cwd: workspacePath });
  const removed = removedItemSpec(xml, basename(absolutePath));
  // Nothing loaded (an added file, or one the branch deleted): its loaded version is empty.
  await (removed ? saveRevision(cm, workspacePlace(workspacePath), removed, target) : writeFile(target, ''));
}

/** Runs `first`, then `fallback` if it fails; when both fail, `first`'s error is the one reported. */
async function withFallback(first: () => Promise<void>, fallback: () => Promise<void>): Promise<void> {
  try {
    await first();
  } catch (error) {
    await fallback().catch(() => {
      throw error;
    });
  }
}

/**
 * `serverpath:` reads the path in the repository's own tree, where an xlink is a leaf: nothing under one is found.
 * Then, for a path not known to be under an xlink (a merge's change, a model's sibling), the tree at the point
 * (`saveFromTree`), only once `serverpath:` found nothing; the tree not having the path is the failure then, telling
 * the file is absent (`isNotInTreeError`), which `serverpath:`'s doesn't. A shelve or a label has no such tree: its
 * paths are read as they are.
 */
async function saveRepositoryPath(cm: CmClient, place: Place, path: string, at: string, target: string): Promise<void> {
  try {
    await saveRevision(cm, place, spec.serverPathAt(path, at), target);
  } catch (error) {
    if (!listsTree(at)) throw error;
    await saveFromTree(cm, place, path, at, target).catch((treeError: unknown) => {
      throw isNotInTreeError(treeError) ? treeError : error;
    });
  }
}

/**
 * The tree at a changeset or a branch's head, which `cm ls` walks through xlinks (nested ones too), names the path's
 * revision in the xlinked repository. A path missing there fails as `cm ls` does ("Can't resolve the selector for the
 * item"). A shelve's or a label's tree can't be listed and its `serverpath:` doesn't reach through an xlink: nothing
 * is asked.
 */
async function saveFromTree(cm: CmClient, place: Place, path: string, at: string, target: string): Promise<void> {
  if (!listsTree(at)) throw new Error(`${path} is under an xlink, which ${at} can't be read through`);
  const where = cmPlace(place);
  const listed = await cm.queryRecords(['ls', path, `--tree=${where.spec(at)}`, TREE_ITEM_FORMAT], readTreeItem, where.options);
  const item = listed.find((candidate) => `/${candidate.path}` === path);
  if (!item || item.revisionId < 0) throw new Error(`${path} isn't in the tree at ${at}`);
  await saveRevision(cm, place, spec.revision(item), target);
}

/** `cm cat` of a spec, naming the place's repository where no workspace tells `cm` which (`CmPlace.spec`). */
async function saveRevision(cm: CmClient, place: Place, revisionSpec: string, target: string): Promise<void> {
  const where = cmPlace(place);
  await cm.query(['cat', where.spec(revisionSpec), `--file=${target}`], where.options);
}

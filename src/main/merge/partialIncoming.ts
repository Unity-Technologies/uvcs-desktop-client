// The reads behind what the branch head brings a partial workspace (`compareWithHead`): the items it has loaded, the
// same folders on the head, and its local changes. Two listings and a status, whatever the head's distance: a partial
// workspace isn't at a changeset, so there is no changeset range to diff.

import type { PartialIncomingItem } from '@shared/domain/incoming';
import type { CmClient } from '../cm/CmClient';
import { fitsCommandLine } from '../cm/commandLineLimit';
import { notInTreePaths } from '../cm/missingItem';
import { readPendingChanges } from '../workspace/readPendingChanges';
import { compareWithHead, foldersWithNewItems, HEAD_TREE_FORMAT, isInsideAny, LOADED_TREE_FORMAT, readHeadItem, readLoadedTreeItem, type HeadItem, type LoadedTreeItem } from './partialComparison';

/** What updating the partial workspace on `branch` to its head would change in the folders it loaded. */
export async function readPartialIncomingItems(cm: CmClient, workspacePath: string, branch: string): Promise<PartialIncomingItem[]> {
  const [loaded, { changes }] = await Promise.all([
    // `ls -R` lists every loaded item, as many as the workspace holds: read as it arrives.
    cm.queryRecords(['ls', '-R', LOADED_TREE_FORMAT], readLoadedTreeItem, { cwd: workspacePath }),
    readPendingChanges(cm, workspacePath, ['--controlledchanged', '--changed']),
  ]);
  const head = await readHeadOfFolders(cm, workspacePath, loadedFolders(loaded), branch);
  const existedWhenLoaded = await readItemsWhenLoaded(cm, workspacePath, foldersWithNewItems(loaded, head));
  return compareWithHead(loaded, head, new Set(changes.map((change) => change.path)), existedWhenLoaded);
}

/**
 * The ids of the items `folders` held at the changesets the workspace loaded them at: one listing per changeset, and
 * none when no loaded folder seems to get something new. An item among them existed already, though the workspace
 * left it out.
 */
async function readItemsWhenLoaded(cm: CmClient, workspacePath: string, folders: readonly LoadedTreeItem[]): Promise<Set<number>> {
  const byChangeset = new Map<number, string[]>();
  for (const folder of folders) {
    if (folder.changeset === null) continue;
    byChangeset.set(folder.changeset, [...(byChangeset.get(folder.changeset) ?? []), serverPath(folder.path)]);
  }
  const ids = new Set<number>();
  for (const [changeset, paths] of byChangeset) {
    for (const args of treeListingArgs(paths.sort(), `cs:${changeset}`)) {
      for (const item of await listHead(cm, workspacePath, args)) ids.add(item.itemId);
    }
  }
  return ids;
}

/**
 * The loaded folders, the ones `cm partial update` brings new items into. An xlink and what it holds belong to another
 * repository, so they aren't listed.
 */
export function loadedFolders(loaded: readonly LoadedTreeItem[]): LoadedTreeItem[] {
  const xlinks = new Set(loaded.filter((item) => item.xlink).map((item) => item.path));
  return loaded.filter((item) => item.isDirectory && !item.xlink && !isInsideAny(item.path, xlinks));
}

/** A workspace path ('' the root, `Code`) as the server path `cm ls --tree` takes ('/', `/Code`). */
function serverPath(path: string): string {
  return `/${path}`;
}

/**
 * The server paths still to list: the loaded folders the listings so far found somewhere they weren't listed, because
 * the head moved them (or the folder they went along with), sorted.
 */
export function movedFolderPaths(folders: readonly LoadedTreeItem[], head: readonly HeadItem[], listed: ReadonlySet<string>): string[] {
  const headById = new Map(head.map((item) => [item.itemId, item]));
  const paths = folders.flatMap((folder) => {
    const onHead = headById.get(folder.itemId);
    return onHead && !listed.has(serverPath(onHead.path)) ? [serverPath(onHead.path)] : [];
  });
  return [...new Set(paths)].sort();
}

/**
 * The `cm ls` commands that list `folders` and their children in `tree` (`br:/main` its head, `cs:5` a changeset): as
 * few as fit a command line (`fitsCommandLine`), each one listing a batch of folders in order.
 */
export function treeListingArgs(folders: readonly string[], tree: string): string[][] {
  const listing = (batch: readonly string[]) => ['ls', ...batch, `--tree=${tree}`, HEAD_TREE_FORMAT];
  const batches: string[][] = [];
  let batch: string[] = [];
  for (const folder of folders) {
    if (batch.length > 0 && !fitsCommandLine(listing([...batch, folder]))) {
      batches.push(batch);
      batch = [];
    }
    batch.push(folder);
  }
  if (batch.length > 0) batches.push(batch);
  return batches.map(listing);
}

/**
 * The loaded folders and their children on the head. A folder the head moved fails to list where it was loaded, but
 * shows up in its parent's listing under its new path: it's listed there in a next pass, one per level moved, so what
 * changed inside it is read too. A folder moved out of every listed folder isn't found, and reads as removed.
 */
async function readHeadOfFolders(cm: CmClient, workspacePath: string, folders: readonly LoadedTreeItem[], branch: string): Promise<HeadItem[]> {
  const head: HeadItem[] = [];
  const listed = new Set<string>();
  let toList = folders.map((folder) => serverPath(folder.path)).sort();
  while (toList.length > 0) {
    for (const args of treeListingArgs(toList, `br:${branch}`)) head.push(...(await listHead(cm, workspacePath, args)));
    for (const path of toList) listed.add(path);
    toList = movedFolderPaths(folders, head, listed);
  }
  return head;
}

/**
 * One listing of the head. A loaded folder the head no longer has (removed, or moved out of the folders listed) fails
 * the whole command, though `cm` lists the rest all the same: list again without the folders it names, which then read
 * as removed. A failure that names none of them is a real one.
 */
async function listHead(cm: CmClient, workspacePath: string, args: string[]): Promise<HeadItem[]> {
  try {
    return await cm.queryRecords(args, readHeadItem, { cwd: workspacePath });
  } catch (error) {
    const missing = new Set(notInTreePaths(error).filter((path) => args.includes(path)));
    if (missing.size === 0) throw error;
    const remaining = args.filter((arg) => !missing.has(arg));
    return remaining.some((arg) => arg.startsWith('/')) ? listHead(cm, workspacePath, remaining) : [];
  }
}

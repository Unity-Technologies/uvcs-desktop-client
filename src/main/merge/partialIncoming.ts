// The reads behind what the branch head brings a partial workspace (`compareWithHead`): the items it has loaded, the
// same folders on the head, and its local changes. Two listings and a status, whatever the head's distance: a partial
// workspace isn't at a changeset, so there is no changeset range to diff.

import type { PartialIncomingItem } from '@shared/domain/incoming';
import type { CmClient } from '../cm/CmClient';
import { fitsCommandLine } from '../cm/commandLineLimit';
import { notInTreePaths } from '../cm/missingItem';
import { readPendingChanges } from '../workspace/readPendingChanges';
import { compareWithHead, HEAD_TREE_FORMAT, LOADED_TREE_FORMAT, readHeadItem, readLoadedTreeItem, type HeadItem, type LoadedTreeItem } from './partialComparison';

/** What updating the partial workspace on `branch` to its head would change in the folders it loaded. */
export async function readPartialIncomingItems(cm: CmClient, workspacePath: string, branch: string): Promise<PartialIncomingItem[]> {
  const [loaded, { changes }] = await Promise.all([
    // `ls -R` lists every loaded item, as many as the workspace holds: read as it arrives.
    cm.queryRecords(['ls', '-R', LOADED_TREE_FORMAT], readLoadedTreeItem, { cwd: workspacePath }),
    readPendingChanges(cm, workspacePath, ['--controlledchanged', '--changed']),
  ]);
  const head = await readHeadOfFolders(cm, workspacePath, loadedFolders(loaded), branch);
  return compareWithHead(loaded, head, new Set(changes.map((change) => change.path)));
}

/**
 * The loaded folders as the head's server paths ('/' the root, `/Code`), sorted: the folders `cm partial update`
 * brings new items into. An xlink and what it holds belong to another repository, so they aren't listed.
 */
export function loadedFolders(loaded: readonly LoadedTreeItem[]): string[] {
  const xlinks = loaded.filter((item) => item.xlink).map((item) => item.path);
  return loaded
    .filter((item) => item.isDirectory && !item.xlink && !xlinks.some((xlink) => item.path.startsWith(`${xlink}/`)))
    .map((item) => `/${item.path}`)
    .sort();
}

/**
 * The `cm ls` commands that list `folders` and their children on the head of `branch`: as few as fit a command line
 * (`fitsCommandLine`), each one listing a batch of folders in order.
 */
export function headListingArgs(folders: readonly string[], branch: string): string[][] {
  const listing = (batch: readonly string[]) => ['ls', ...batch, `--tree=br:${branch}`, HEAD_TREE_FORMAT];
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

async function readHeadOfFolders(cm: CmClient, workspacePath: string, folders: readonly string[], branch: string): Promise<HeadItem[]> {
  const head: HeadItem[] = [];
  for (const args of headListingArgs(folders, branch)) head.push(...(await listHead(cm, workspacePath, args)));
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

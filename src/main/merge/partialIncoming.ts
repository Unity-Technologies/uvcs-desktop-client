// The reads behind what the branch head brings a partial workspace (`compareWithHead`): the items it has loaded, the
// same folders on the head, and its local changes; then, for the folders the head changed that hold items the
// workspace doesn't have, what they held when loaded. A partial workspace isn't at a changeset, so there is no
// changeset range to diff. A folder inside an xlink was loaded at a changeset of the xlinked repository, so what it
// held is read there (`cs:N@repository`).

import type { PartialIncomingItem } from '@shared/domain/incoming';
import type { CmClient } from '../cm/CmClient';
import { fitsCommandLine } from '../cm/commandLineLimit';
import { notInTreePaths } from '../cm/missingItem';
import { readPendingChanges } from '../workspace/readPendingChanges';
import {
  byScopedKey,
  changedFoldersWithUnloadedItems,
  compareWithHead,
  enclosingXlink,
  HEAD_TREE_FORMAT,
  LOADED_TREE_FORMAT,
  parentOf,
  readHeadItem,
  readLoadedTreeItem,
  repositorySpec,
  xlinksOf,
  type HeadItem,
  type LoadedTreeItem,
} from './partialComparison';

/** What updating the partial workspace on `branch` to its head would change in the folders it loaded. */
export async function readPartialIncomingItems(cm: CmClient, workspacePath: string, branch: string): Promise<PartialIncomingItem[]> {
  const [loaded, { changes }] = await Promise.all([
    // `ls -R` lists every loaded item, as many as the workspace holds: read as it arrives.
    cm.queryRecords(['ls', '-R', LOADED_TREE_FORMAT], readLoadedTreeItem, { cwd: workspacePath }),
    readPendingChanges(cm, workspacePath, ['--controlledchanged', '--changed']),
  ]);
  const head = await readHeadOfFolders(cm, workspacePath, loadedFolders(loaded), branch);
  const childrenWhenLoaded = await readChildrenWhenLoaded(cm, workspacePath, loaded, changedFoldersWithUnloadedItems(loaded, head));
  return compareWithHead(loaded, head, new Set(changes.map((change) => change.path)), childrenWhenLoaded);
}

/** Where a loaded folder is listed as it was loaded. */
export interface LoadedListing {
  /** The tree it was loaded from: `cs:5`, or `cs:27890@pnunit@acme@cloud` inside an xlink. */
  tree: string;
  /** Its server path in that tree. */
  serverPath: string;
  /** The workspace path of the xlink it lies under; '' outside any. */
  xlinkPath: string;
  /** The server path the xlink shows at its workspace path: '/' outside any xlink. */
  xlinkTargetPath: string;
}

/** Where `folder`, loaded at `changeset`, is listed as it was loaded: in its own repository, at its path there. */
export function loadedListingOf(folder: Pick<LoadedTreeItem, 'path'>, changeset: number, xlinks: ReturnType<typeof xlinksOf>): LoadedListing {
  const xlink = enclosingXlink(folder.path, xlinks);
  if (!xlink) return { tree: `cs:${changeset}`, serverPath: serverPath(folder.path), xlinkPath: '', xlinkTargetPath: '/' };
  const below = folder.path === xlink.path ? '' : folder.path.slice(xlink.path.length + 1);
  return {
    tree: `cs:${changeset}@${repositorySpec(xlink.target)}`,
    serverPath: joinServerPath(xlink.target.path, below),
    xlinkPath: xlink.path,
    xlinkTargetPath: xlink.target.path,
  };
}

/**
 * A path a loaded listing printed, as the workspace path it is at. `readHeadItem` reads it relative to the root of
 * its repository ('' the root, `test/carnagetest`), as the xlink's target path is taken here too.
 */
export function workspacePathOf(path: string, { xlinkPath, xlinkTargetPath }: LoadedListing): string {
  const target = xlinkTargetPath.replace(/^\/+|\/+$/g, '');
  const below = path === target ? '' : target === '' ? path : path.slice(target.length + 1);
  if (xlinkPath === '') return below;
  return below === '' ? xlinkPath : `${xlinkPath}/${below}`;
}

/**
 * What `folders` held at the changesets the workspace loaded them at, keyed by their workspace path, with the paths
 * as the workspace has them: one listing per tree (a changeset of a repository). A folder that doesn't list gets no
 * entry, and keeps the item-id rule (`compareWithHead`).
 */
async function readChildrenWhenLoaded(
  cm: CmClient,
  workspacePath: string,
  loaded: readonly LoadedTreeItem[],
  folders: readonly LoadedTreeItem[],
): Promise<Map<string, HeadItem[]>> {
  const xlinks = xlinksOf(loaded);
  const byTree = new Map<string, { listing: LoadedListing; serverPaths: Set<string>; requested: Set<string> }>();
  for (const folder of folders) {
    if (folder.changeset === null) continue;
    const listing = loadedListingOf(folder, folder.changeset, xlinks);
    // Two xlinks of one repository at one changeset show it at different paths: listed apart, to read each back.
    const key = `${listing.xlinkPath}|${listing.tree}`;
    const group = byTree.get(key) ?? { listing, serverPaths: new Set<string>(), requested: new Set<string>() };
    group.serverPaths.add(listing.serverPath);
    group.requested.add(folder.path);
    byTree.set(key, group);
  }
  const children = new Map<string, HeadItem[]>();
  for (const { listing, serverPaths, requested } of byTree.values()) {
    const rows: HeadItem[] = [];
    for (const args of treeListingArgs([...serverPaths].sort(), listing.tree)) rows.push(...(await listHead(cm, workspacePath, args)));
    const inWorkspace = rows.map((row) => ({ ...row, path: workspacePathOf(row.path, listing) }));
    for (const row of inWorkspace) if (row.isDirectory && requested.has(row.path) && !children.has(row.path)) children.set(row.path, []);
    // A requested folder is printed as its own row and, when its parent is requested too, as one of its children:
    // every row lands once in its parent's children, so a parent keeps the subfolders it held.
    const placed = new Set<string>();
    for (const row of inWorkspace) {
      const parent = parentOf(row.path);
      if (parent === row.path || placed.has(row.path)) continue;
      const siblings = children.get(parent);
      if (siblings === undefined) continue;
      siblings.push(row);
      placed.add(row.path);
    }
  }
  return children;
}

/**
 * The loaded folders, the ones `cm partial update` brings new items into: xlinks and the folders inside them too,
 * which the head lists through the workspace's branch at their workspace paths.
 */
export function loadedFolders(loaded: readonly LoadedTreeItem[]): LoadedTreeItem[] {
  return loaded.filter((item) => item.isDirectory);
}

/** A workspace path ('' the root, `Code`) as the server path `cm ls --tree` takes ('/', `/Code`). */
function serverPath(path: string): string {
  return `/${path}`;
}

/** The server path of `below` (relative to it; '' for itself) inside the server path `folder` ('/', `/src`). */
function joinServerPath(folder: string, below: string): string {
  if (below === '') return folder;
  return folder.endsWith('/') ? `${folder}${below}` : `${folder}/${below}`;
}

/**
 * The server paths still to list: the loaded folders the listings so far found somewhere they weren't listed, because
 * the head moved them (or the folder they went along with), sorted. A folder is matched by its id within its scope
 * (`byScopedKey`): an xlink lists another repository's item ids, so it is never where a folder of the workspace went.
 */
export function movedFolderPaths(folders: readonly LoadedTreeItem[], head: readonly HeadItem[], listed: ReadonlySet<string>): string[] {
  const headByKey = byScopedKey(head);
  const paths = [...byScopedKey(folders).keys()].flatMap((key) => {
    const onHead = headByKey.get(key);
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
 * How many loaded folders are listed on the head one by one. `cm ls` with `--tree` resolves each path it's given on
 * the server apart, a round of its own each: on a large repository, about 0.3 s a folder, 0.45 s inside an xlink. The
 * whole tree (`readHeadOfWholeTree`) costs what the repository holds instead: 4.5 s for 80,000 items, about what 15
 * folders cost one by one. Past this many folders, the head is that one listing. The limit sits above that crossover
 * because the whole tree grows with the repository and the folders don't: a repository many times larger pays more
 * for the whole tree, while a workspace past this many folders already waits seconds one by one.
 */
export const MOST_FOLDERS_LISTED_ONE_BY_ONE = 20;

/**
 * The loaded folders and their children on the head. A folder the head moved fails to list where it was loaded, but
 * shows up in its parent's listing under its new path: it's listed there in a next pass, one per level moved, so what
 * changed inside it is read too. A folder moved out of every listed folder isn't found, and reads as removed.
 */
async function readHeadOfFolders(cm: CmClient, workspacePath: string, folders: readonly LoadedTreeItem[], branch: string): Promise<HeadItem[]> {
  const head: HeadItem[] = [];
  const listed = new Set<string>();
  let toList = folders.map((folder) => serverPath(folder.path)).sort();
  if (toList.length > MOST_FOLDERS_LISTED_ONE_BY_ONE) {
    head.push(...(await readHeadOfWholeTree(cm, workspacePath, toList, branch)));
    for (const path of toList) listed.add(path);
    toList = movedFolderPaths(folders, head, listed);
  }
  while (toList.length > 0) {
    for (const args of treeListingArgs(toList, `br:${branch}`)) head.push(...(await listHead(cm, workspacePath, args)));
    for (const path of toList) listed.add(path);
    toList = movedFolderPaths(folders, head, listed);
  }
  return head;
}

/**
 * The `folders` (server paths) and their children on the head, from one listing of its whole tree, xlinks followed:
 * each row is kept only when it's one of them or lies right inside one, so what is kept weighs what listing them one
 * by one would. It takes seconds on a big repository, so it runs in a process of its own (`executeRecords`).
 */
async function readHeadOfWholeTree(cm: CmClient, workspacePath: string, folders: readonly string[], branch: string): Promise<HeadItem[]> {
  const isListed = isInFolders(folders);
  return cm.executeRecords(
    ['ls', '/', '-R', `--tree=br:${branch}`, HEAD_TREE_FORMAT],
    (fields) => {
      const item = readHeadItem(fields);
      return item && isListed(item.path) ? item : undefined;
    },
    { cwd: workspacePath },
  );
}

/**
 * Whether a path of the head (a workspace path, `Assets/Ship.cs`, or '' for the root) is one of the `folders` (server
 * paths, `/Assets`) or lies right inside one: what listing those folders one by one would print.
 */
export function isInFolders(folders: readonly string[]): (path: string) => boolean {
  const listed = new Set(folders);
  return (path) => listed.has(serverPath(path)) || listed.has(serverPath(parentOf(path)));
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

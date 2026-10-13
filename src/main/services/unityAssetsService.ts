// Finds what a model's materials name as Unity finds it, where the version of the model shown is
// (docs/features/model-diff.md, "Materials"): on the workspace's disk for a version there (pending changes, a workspace
// file), in the repository's tree at its point for any other (`RepositoryAssetTree`: `cm ls --tree`, once per point),
// so a version's textures are the ones that go with it, never the disk's of another revision. Nothing outside the
// workspace. A file found is read with `read`: the disk's, or its revision (`RevisionDownloads`).

import type { Stats } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { posix } from 'node:path';
import type { UnityAssetsApi } from '@shared/api/unityAssets';
import { listsTree } from '@shared/domain/specs';
import {
  MAX_CHANGED_ASSETS,
  MAX_STORED_PATHS,
  MAX_UNITY_ASSET_LOOKUPS,
  MAX_UNITY_ASSET_PATH_LENGTH,
  type AssetsPoint,
  type FoundFile,
  type GuidMisses,
  type TextureLookup,
  type UnityAssetsAnswer,
  type UnityAssetsRequest,
} from '@shared/domain/unityAssets';
import type { RevisionRef } from '@shared/domain/revision';
import type { CmClient } from '../cm/CmClient';
import { isNotInTreeError } from '../cm/missingItem';
import { parseTreeListing, treeListingArgs } from '../cm/treeListing';
import { MAX_MODEL_BYTES } from '../files/fileContent';
import { workspaceFileOf } from '../files/workspacePaths';
import { diskProjectFiles } from '../unity/diskProjectFiles';
import { ProjectAssetIndex, type ProjectFiles } from '../unity/ProjectAssetIndex';
import { RepositoryAssetTree, TreeListingError, type AssetTreeView } from '../unity/RepositoryAssetTree';
import type { RevisionDownloads } from '../unity/RevisionDownloads';
import { preferredMatches, searchedFolders, textureCandidates } from '../unity/textureSearch';
import { listsPsdImporter, loadsPackagesFromOutside, packageListsOf } from '../unity/unityPackages';
import { unityProjectFound, type UnityProject } from '../unity/unityProject';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';

interface UnityAssetsContext {
  watchers: Pick<WorkspaceWatchers, 'listen' | 'coverageOf'>;
  cm: Pick<CmClient, 'query' | 'execute'>;
  downloads: Pick<RevisionDownloads, 'read'>;
  platform?: NodeJS.Platform;
  /** The disk as the project indexes read it; tests count the reads. */
  filesOf?: (workspacePath: string) => ProjectFiles;
  /** How a file found is checked on disk; tests pass one that refuses. */
  statOf?: (path: string) => Promise<FileStats>;
  /** The time, which a branch head's tree is kept for (`BRANCH_TREE_LIFE_MS`). */
  now?: () => number;
}

type FileStats = Pick<Stats, 'size' | 'mtimeMs'> & { isFile(): boolean };

/** The points whose trees are kept, the latest used: both sides of a few diffs. */
const KEPT_TREES = 8;
/**
 * How long a branch head's tree is kept: a changeset's never changes, a branch's moves as people check in. Long enough
 * for the lookups of the diff on screen, both sides and both rounds, to share one listing.
 */
export const BRANCH_TREE_LIFE_MS = 60_000;

/** A point's tree, when it was listed first, and the project indexes read over it (by project and model folder). */
interface KeptTree {
  tree: RepositoryAssetTree;
  since: number;
  indexes: Map<string, ProjectAssetIndex>;
}

export function createUnityAssetsService({ watchers, cm, downloads, platform = process.platform, filesOf = diskProjectFiles, statOf = stat, now = Date.now }: UnityAssetsContext): UnityAssetsApi {
  /** Each project's index by workspace, kept while the watcher sees every change of the workspace. */
  const indexes = new Map<string, Map<string, ProjectAssetIndex>>();
  /** The repository's trees by workspace and point, the latest used last. */
  const trees = new Map<string, KeptTree>();
  watchers.listen({
    changed: (workspacePath, change) => {
      for (const index of indexes.get(workspacePath)?.values() ?? []) index.noteChange(change);
    },
    unwatched: (workspacePath) => void indexes.delete(workspacePath),
  });

  /** Finds under way on each index: a fresh read starts only when none is. */
  const findsUnderWay = new Map<ProjectAssetIndex, number>();

  /**
   * The project's index on disk, kept per project. Where the workspace's watcher doesn't see every change (what it doesn't
   * see would leave the index wrong for the session), the project's folders are read afresh (`clear`) by a find that
   * starts when no other is under way: finds at once (both versions of a diff) share one fresh read, as a clear would
   * overtake the other's. Its package cache, which no watcher sees anyway and which checks itself
   * (`packageCacheUnchanged`), is kept. Released with `doneWith`.
   */
  function diskIndexOf(workspacePath: string, project: UnityProject): ProjectAssetIndex {
    const ofWorkspace = indexes.get(workspacePath) ?? new Map<string, ProjectAssetIndex>();
    indexes.set(workspacePath, ofWorkspace);
    const index = ofWorkspace.get(project.root) ?? new ProjectAssetIndex(project, filesOf(workspacePath), platform);
    ofWorkspace.set(project.root, index);
    const readsAfresh = watchers.coverageOf(workspacePath) !== 'full';
    const underWay = findsUnderWay.get(index) ?? 0;
    if (readsAfresh && underWay === 0) index.clear();
    findsUnderWay.set(index, underWay + 1);
    return index;
  }

  function doneWith(index: ProjectAssetIndex): void {
    const underWay = (findsUnderWay.get(index) ?? 1) - 1;
    if (underWay === 0) findsUnderWay.delete(index);
    else findsUnderWay.set(index, underWay);
  }

  /** The point's tree, listed once while kept: a branch head's for `BRANCH_TREE_LIFE_MS`. */
  function treeAt(workspacePath: string, point: Extract<AssetsPoint, { kind: 'repository' }>): KeptTree {
    const key = JSON.stringify([workspacePath, point]);
    const kept = trees.get(key);
    trees.delete(key);
    if (kept && (point.at.startsWith('cs:') || now() - kept.since < BRANCH_TREE_LIFE_MS)) return trees.set(key, kept), kept;
    const source = {
      // The model's folder is quick to list; a whole project may take a while, in a process of its own.
      list: (folder: string, scope: 'near' | 'wide') => {
        const args = treeListingArgs(folder, point.at);
        const listed = scope === 'near' ? cm.query(args, { cwd: workspacePath }) : cm.execute(args, { cwd: workspacePath });
        return listed.then(parseTreeListing, (error: unknown) => (isNotInTreeError(error) ? null : Promise.reject(error)));
      },
      read: (file: Parameters<RevisionDownloads['read']>[1], mayDownload: () => boolean) => downloads.read(workspacePath, file, mayDownload),
    };
    const fresh = { tree: new RepositoryAssetTree(source, point.before, platform), since: now(), indexes: new Map<string, ProjectAssetIndex>() };
    trees.set(key, fresh);
    for (const oldest of trees.keys()) {
      if (trees.size <= KEPT_TREES) break;
      trees.delete(oldest);
    }
    return fresh;
  }

  async function find(workspacePath: string, request: UnityAssetsRequest): Promise<UnityAssetsAnswer> {
    refuseUnlikely(request);
    const modelPath = workspacePathOf(request.modelPath);
    if (modelPath === null) throw new Error(`${request.modelPath} is outside the workspace`);
    // The project is found as the disk has it (by its `ProjectSettings`), else by its folders' names: a project's
    // place doesn't change from one version of a model to the next.
    const project = await unityProjectFound(modelPath, (root) => isFolder(workspacePath, root === '' ? 'ProjectSettings' : `${root}/ProjectSettings`));
    if (request.point.kind === 'repository') return findInTree(workspacePath, request, modelPath, project, request.point);
    const index = project && diskIndexOf(workspacePath, project);
    try {
      return await findIn(workspacePath, request, modelPath, project, index, (path) => foundFile(workspacePath, path, statOf));
    } finally {
      if (index) doneWith(index);
    }
  }

  /** At a point of the repository: the model's folder listed first, the project's only when a lookup reaches past it. */
  function findInTree(workspacePath: string, request: UnityAssetsRequest, modelPath: string, project: UnityProject | null, point: Extract<AssetsPoint, { kind: 'repository' }>): Promise<UnityAssetsAnswer> {
    const kept = treeAt(workspacePath, point);
    const near = folderOf(modelPath);
    const library = project && { folder: project.root === '' ? 'Library' : `${project.root}/Library`, files: filesOf(workspacePath) };
    const view: AssetTreeView = kept.tree.view(near, project ? project.root : near, library);
    let index: ProjectAssetIndex | null = null;
    if (project) {
      const key = `${project.root}\0${near}`;
      index = kept.indexes.get(key) ?? new ProjectAssetIndex(project, view.files, platform);
      kept.indexes.set(key, index);
    }
    return findIn(workspacePath, request, modelPath, project, index, (path) => view.file(path));
  }

  async function findIn(
    workspacePath: string,
    request: UnityAssetsRequest,
    modelPath: string,
    project: UnityProject | null,
    index: ProjectAssetIndex | null,
    fileAt: (path: string) => Promise<FoundFile | null>,
  ): Promise<UnityAssetsAnswer> {
    const modelFolder = folderOf(modelPath);
    // Outside a project, or in one without a `Library`, a GUID not found isn't known missing (`pathOfGuid`); nor in one
    // that loads a package from a folder outside it, which isn't read. The project's packages are read on disk: they
    // are how this machine's Unity imports the project.
    let guidMisses: GuidMisses = index ? 'known' : 'noProject';
    const [manifest] = project ? packageListsOf(project.root) : [];
    const outsidePackages = manifest !== undefined && loadsPackagesFromOutside(await readText(workspacePath, manifest));
    // A file the disk refused (an antivirus holding it, too many open) is no answer: the find says it was unread. A tree
    // that couldn't be listed fails the find.
    const found = async (path: string | null): Promise<FoundFile | null> => {
      if (path === null) return null;
      return fileAt(path).catch((error: unknown) => {
        if (error instanceof TreeListingError) throw error;
        guidMisses = 'unread';
        return null;
      });
    };
    const byGuid = async (guid: string): Promise<FoundFile | null> => {
      const path = index ? await index.pathOfGuid(guid, modelFolder) : null;
      if (path === null && outsidePackages && guidMisses === 'known') guidMisses = 'outsidePackage';
      if (path === null || typeof path === 'string') return found(path);
      if (guidMisses === 'known') guidMisses = path.notKnown;
      return null;
    };

    const findTexture = async (lookup: TextureLookup): Promise<FoundFile | null> => {
      const remapped = lookup.remapGuid ? await byGuid(lookup.remapGuid) : null;
      if (remapped) return remapped;
      for (const candidate of textureCandidates({ modelPath, project, name: lookup.name, storedPaths: lookup.storedPaths, workspacePath, platform })) {
        const file = await found(candidate);
        if (file) return file;
      }
      if (!request.searchTexturesGlobally || !index) return null;
      const folders = searchedFolders({ modelPath, project });
      for (const match of preferredMatches(await index.pathsNamed(lookup.name, folders), folders)) {
        const file = await found(match);
        if (file) return file;
      }
      return null;
    };

    // One after another: a lookup reads the project's index as far as it needs, and the next starts from there.
    const textures: (FoundFile | null)[] = [];
    for (const lookup of request.textures) textures.push(await findTexture(lookup));
    const guids: (FoundFile | null)[] = [];
    for (const guid of request.guids) guids.push(await byGuid(guid));
    const paths = await Promise.all(request.paths.map((path) => found(workspacePathOf(path))));
    const importsPsb = project !== null && (await Promise.all(packageListsOf(project.root).map((list) => readText(workspacePath, list)))).some(listsPsdImporter);
    return { textures, guids, paths, importsPsb, guidMisses };
  }

  /** A file found's bytes: the disk's, or its revision's (`RevisionDownloads`); null for a disk file no longer there. */
  async function read(workspacePath: string, file: FoundFile): Promise<Uint8Array | null> {
    const path = workspacePathOf(file.path);
    if (path === null || file.path.length > MAX_UNITY_ASSET_PATH_LENGTH) throw new Error(`${file.path} is outside the workspace`);
    let bytes: Buffer | null;
    if (file.stored === 'disk') {
      bytes = await readDiskFile(workspaceFileOf(workspacePath, path));
    } else {
      refuseUnlikelyRevision(file.revision);
      bytes = await downloads.read(workspacePath, { path, revision: file.revision, hash: file.hash, size: file.size });
    }
    // A plain Uint8Array: IPC copies it as binary.
    return bytes && new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  return { find, read };
}

/** A disk file's bytes, refused unread past `MAX_MODEL_BYTES`; null when it isn't there. */
async function readDiskFile(absolutePath: string): Promise<Buffer | null> {
  const size = await stat(absolutePath).then(
    (stats) => stats.size,
    (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' || error.code === 'ENOTDIR' ? null : Promise.reject(error)),
  );
  if (size === null) return null;
  if (size > MAX_MODEL_BYTES) throw new Error(`${absolutePath} is too large to read`);
  return readFile(absolutePath);
}

/**
 * A revision as `cm cat <spec>;<file>` can name it: a whole id, and a repository (`name@server`) holding no `;`, which
 * would end the spec, nor a quote or a line break, which a command can't carry.
 */
function refuseUnlikelyRevision({ revisionId, repository }: RevisionRef): void {
  if (!Number.isSafeInteger(revisionId) || revisionId < 0 || !/^[^;"\r\n]+@[^;"\r\n]+$/.test(repository) || repository.length > MAX_UNITY_ASSET_PATH_LENGTH) throw new Error('Not a revision');
}

/** A changeset or a branch head, whose tree `cm ls --tree` lists, as one shell argument can carry it. */
function refuseUnlikelyPoint(point: AssetsPoint): void {
  if (point.kind === 'workspace') return;
  if (!listsTree(point.at) || /[;"\r\n]/.test(point.at) || point.at.length > MAX_UNITY_ASSET_PATH_LENGTH) throw new Error(`${point.at} can't be listed`);
  if (point.before?.kind === 'changeset' && (!Number.isSafeInteger(point.before.changeset) || point.before.changeset < 0)) throw new Error('Not a changeset');
  if (point.before?.kind === 'changes') {
    if (point.before.changes.length > MAX_CHANGED_ASSETS) throw new Error('Too many changes for one diff');
    for (const change of point.before.changes) {
      if (change.path.length > MAX_UNITY_ASSET_PATH_LENGTH || workspacePathOf(change.path) === null) throw new Error(`${change.path} is outside the workspace`);
      if (change.revision) refuseUnlikelyRevision(change.revision);
    }
  }
}

function folderOf(path: string): string {
  const folder = posix.dirname(path);
  return folder === '.' ? '' : folder;
}

/** Refuses what no model asks for: the renderer is not trusted, and each lookup reads the disk. */
function refuseUnlikely(request: UnityAssetsRequest): void {
  if ([request.textures, request.guids, request.paths].some((list) => list.length > MAX_UNITY_ASSET_LOOKUPS)) throw new Error('Too many lookups for one model');
  if (request.textures.some((lookup) => lookup.storedPaths.length > MAX_STORED_PATHS)) throw new Error('Too many stored paths for one texture');
  refuseUnlikelyPoint(request.point);
  const strings = [request.modelPath, ...request.paths, ...request.guids, ...request.textures.flatMap((lookup) => [lookup.name, ...lookup.storedPaths, lookup.remapGuid ?? ''])];
  if (strings.some((text) => text.length > MAX_UNITY_ASSET_PATH_LENGTH)) throw new Error('A name or path too long for a model to name');
}

/** A workspace-relative path, `/`-separated and normalized; null for one leading out of the workspace. */
function workspacePathOf(path: string): string | null {
  const normalized = posix.normalize(path.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) return null;
  return normalized === '.' ? '' : normalized;
}

/**
 * The file at a workspace-relative path, with its size and when it was written; null when it isn't a file there
 * (`ENOENT`, `ENOTDIR`, as `diskProjectFiles` takes them). Any other failure rejects: it tells nothing.
 */
async function foundFile(workspacePath: string, path: string, statOf: (path: string) => Promise<FileStats>): Promise<FoundFile | null> {
  try {
    const stats = await statOf(workspaceFileOf(workspacePath, path));
    return stats.isFile() ? { path, size: stats.size, stored: 'disk', modified: stats.mtimeMs } : null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw error;
  }
}

/** Whether a workspace-relative path is a folder on disk. */
async function isFolder(workspacePath: string, path: string): Promise<boolean> {
  return stat(workspaceFileOf(workspacePath, path)).then(
    (stats) => stats.isDirectory(),
    () => false,
  );
}

/** A small file's text in the workspace; null when it isn't there. */
async function readText(workspacePath: string, path: string): Promise<string | null> {
  return readFile(workspaceFileOf(workspacePath, path), 'utf8').catch(() => null);
}

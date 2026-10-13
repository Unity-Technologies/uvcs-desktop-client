// Finds what a model's materials name in the workspace on disk, as Unity finds it (docs/features/model-diff.md,
// "Materials"): no `cm` command, nothing from the server, nothing outside the workspace. The materials and textures a
// model shows are the workspace's as they are now, whichever version of the model is shown.

import { readFile, stat } from 'node:fs/promises';
import { posix } from 'node:path';
import type { UnityAssetsApi } from '@shared/api/unityAssets';
import { MAX_STORED_PATHS, MAX_UNITY_ASSET_LOOKUPS, MAX_UNITY_ASSET_PATH_LENGTH, type FoundFile, type TextureLookup, type UnityAssetsRequest } from '@shared/domain/unityAssets';
import { workspaceFileOf } from '../files/workspacePaths';
import { diskProjectFiles } from '../unity/diskProjectFiles';
import { ProjectAssetIndex, type ProjectFiles } from '../unity/ProjectAssetIndex';
import { preferredMatches, searchedFolders, textureCandidates } from '../unity/textureSearch';
import { listsPsdImporter, packageListsOf } from '../unity/unityPackages';
import { unityProjectFound, type UnityProject } from '../unity/unityProject';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';

interface UnityAssetsContext {
  watchers: Pick<WorkspaceWatchers, 'listen' | 'coverageOf'>;
  platform?: NodeJS.Platform;
  /** The disk as the project indexes read it; tests count the reads. */
  filesOf?: (workspacePath: string) => ProjectFiles;
}

export function createUnityAssetsService({ watchers, platform = process.platform, filesOf = diskProjectFiles }: UnityAssetsContext): UnityAssetsApi {
  /** Each project's index by workspace, kept while the watcher sees every change of the workspace. */
  const indexes = new Map<string, Map<string, ProjectAssetIndex>>();
  watchers.listen({
    changed: (workspacePath, change) => {
      for (const index of indexes.get(workspacePath)?.values() ?? []) index.noteChange(change);
    },
    unwatched: (workspacePath) => void indexes.delete(workspacePath),
  });

  /**
   * The project's index: kept while the workspace's watcher sees every change (what it doesn't see would leave the
   * index wrong for the session); otherwise one for this find alone.
   */
  function indexOf(workspacePath: string, project: UnityProject): ProjectAssetIndex {
    if (watchers.coverageOf(workspacePath) !== 'full') {
      indexes.delete(workspacePath);
      return new ProjectAssetIndex(project, filesOf(workspacePath), platform, false);
    }
    const ofWorkspace = indexes.get(workspacePath) ?? new Map<string, ProjectAssetIndex>();
    indexes.set(workspacePath, ofWorkspace);
    const index = ofWorkspace.get(project.root) ?? new ProjectAssetIndex(project, filesOf(workspacePath), platform);
    ofWorkspace.set(project.root, index);
    return index;
  }

  async function find(workspacePath: string, request: UnityAssetsRequest) {
    refuseUnlikely(request);
    const modelPath = workspacePathOf(request.modelPath);
    if (modelPath === null) throw new Error(`${request.modelPath} is outside the workspace`);
    const project = await unityProjectFound(modelPath, (root) => isFolder(workspacePath, root === '' ? 'ProjectSettings' : `${root}/ProjectSettings`));
    const index = project && indexOf(workspacePath, project);
    const modelFolder = posix.dirname(modelPath) === '.' ? '' : posix.dirname(modelPath);
    const found = (path: string | null): Promise<FoundFile | null> => (path === null ? Promise.resolve(null) : foundFile(workspacePath, path));
    // Outside a project, or in one without a `Library`, a GUID not found isn't known missing (`pathOfGuid`).
    let guidMissesKnown = index !== null;
    const byGuid = async (guid: string): Promise<FoundFile | null> => {
      const path = index ? await index.pathOfGuid(guid, modelFolder) : null;
      if (path === undefined) guidMissesKnown = false;
      return found(path ?? null);
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
    return { textures, guids, paths, importsPsb, guidMissesKnown };
  }

  return { find };
}

/** Refuses what no model asks for: the renderer is not trusted, and each lookup reads the disk. */
function refuseUnlikely(request: UnityAssetsRequest): void {
  if ([request.textures, request.guids, request.paths].some((list) => list.length > MAX_UNITY_ASSET_LOOKUPS)) throw new Error('Too many lookups for one model');
  if (request.textures.some((lookup) => lookup.storedPaths.length > MAX_STORED_PATHS)) throw new Error('Too many stored paths for one texture');
  const strings = [request.modelPath, ...request.paths, ...request.guids, ...request.textures.flatMap((lookup) => [lookup.name, ...lookup.storedPaths, lookup.remapGuid ?? ''])];
  if (strings.some((text) => text.length > MAX_UNITY_ASSET_PATH_LENGTH)) throw new Error('A name or path too long for a model to name');
}

/** A workspace-relative path, `/`-separated and normalized; null for one leading out of the workspace. */
function workspacePathOf(path: string): string | null {
  const normalized = posix.normalize(path.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) return null;
  return normalized === '.' ? '' : normalized;
}

/** The file at a workspace-relative path, with its size and when it was written; null when it isn't a file there. */
async function foundFile(workspacePath: string, path: string): Promise<FoundFile | null> {
  try {
    const stats = await stat(workspaceFileOf(workspacePath, path));
    return stats.isFile() ? { path, size: stats.size, modified: stats.mtimeMs } : null;
  } catch {
    return null;
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

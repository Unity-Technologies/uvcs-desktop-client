// Where Unity looks for a texture a model names (its ModelImporter's texture search), as workspace-relative paths in
// the order it tries them. Pure: the service tries each on the disk (`unityAssetsService`). For a texture the model
// names `bark.png` at `Assets/Art/Tree/Tree.fbx`:
//   1. the model's folder: `Assets/Art/Tree/bark.png`;
//   2. a `Textures` folder there and in each folder above it, up to `Assets`: `Assets/Art/Tree/Textures/bark.png`,
//      `Assets/Art/Textures/bark.png`, `Assets/Textures/bark.png`;
//   3. the path the model stores relative to itself (FBX's `RelativeFilename`), when it leads inside the project;
//   4. the absolute path the model stores, when it is inside the project on this machine;
//   5. with "search textures globally" only, any file of that name in the project, those under the folders above first
//      (`preferredMatches`, over the project's index of names).
// A remap of the texture in the model's `.meta` is tried before all of these (by GUID, in the service). Outside a
// Unity project, the same, climbing up to the workspace's root, and nothing global.

import { posix } from 'node:path';
import { isSameOrInside } from '../files/pathContainment';
import { pathsOf } from '../files/workspacePaths';
import type { UnityProject } from './unityProject';

export interface TextureSearch {
  /** The model's workspace-relative path, `/`-separated. */
  modelPath: string;
  project: UnityProject | null;
  /** The file name as stored (`bark.png`). */
  name: string;
  storedPaths: string[];
  /** The workspace's absolute path on this machine, which an absolute stored path is matched against. */
  workspacePath: string;
  platform: NodeJS.Platform;
}

/** The paths to try, in Unity's order, for steps 1-4; never one leading out of the project (or the workspace). */
export function textureCandidates(search: TextureSearch): string[] {
  if (!isPlainFileName(search.name)) return [];
  const folder = folderOf(search.modelPath);
  const candidates = [
    joined(folder, search.name),
    ...searchedFolders(search).map((searched) => joined(searched, 'Textures', search.name)),
    ...search.storedPaths.flatMap((stored) => storedCandidate(search, folder, stored)),
  ];
  return [...new Set(candidates)];
}

/**
 * The folders whose `Textures` folder is searched, the model's first, then each one above it while still in the
 * project's `Assets` (or the workspace, outside a project): the ones step 5 prefers a match under, in this order.
 */
export function searchedFolders({ modelPath, project }: Pick<TextureSearch, 'modelPath' | 'project'>): string[] {
  const top = project ? project.assets : '';
  const folders: string[] = [];
  for (let folder = folderOf(modelPath); ; folder = folderOf(folder)) {
    if (!isSameOrUnder(folder, top)) break;
    folders.push(folder);
    if (folder === top) break;
  }
  return folders;
}

/** Step 5: the files of the name found in the project, those under the folders searched first, by that order. */
export function preferredMatches(matches: readonly string[], preferredFolders: readonly string[]): string[] {
  const rank = (path: string): number => {
    const at = preferredFolders.findIndex((folder) => isSameOrUnder(folderOf(path), folder));
    return at === -1 ? preferredFolders.length : at;
  };
  return [...matches].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** A path the model stores for the texture, where it leads in the workspace: relative to the model, or absolute. */
function storedCandidate({ project, workspacePath, platform }: TextureSearch, folder: string, stored: string): string[] {
  const top = project ? project.root : '';
  if (isAbsolute(stored)) {
    const paths = pathsOf(platform);
    const projectFolder = paths.join(workspacePath, ...top.split('/').filter(Boolean));
    if (!isAbsoluteHere(stored, platform) || !isSameOrInside(projectFolder, stored, platform)) return [];
    const relative = paths.relative(paths.resolve(workspacePath), paths.resolve(stored)).split(paths.sep).join('/');
    return relative === '' || relative.startsWith('..') ? [] : [relative];
  }
  const resolved = posix.normalize(joined(folder, ...stored.split(/[\\/]/)));
  if (resolved.startsWith('../') || resolved === '..' || resolved.startsWith('/')) return [];
  return isSameOrUnder(folderOf(resolved), top) ? [resolved] : [];
}

/** A drive letter, a UNC share or a root: a path from another machine's or this one's root. */
function isAbsolute(path: string): boolean {
  return /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\') || path.startsWith('/') || path.startsWith('\\');
}

/** Whether this OS reads the absolute path as one of its own: a Windows path on Windows, a POSIX one elsewhere. */
function isAbsoluteHere(path: string, platform: NodeJS.Platform): boolean {
  return platform === 'win32' ? /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\') : path.startsWith('/');
}

/** A file name and nothing else: no folder, no `..`. */
function isPlainFileName(name: string): boolean {
  return name !== '' && name !== '.' && name !== '..' && !/[\\/]/.test(name);
}

function folderOf(path: string): string {
  const end = path.lastIndexOf('/');
  return end === -1 ? '' : path.slice(0, end);
}

function joined(folder: string, ...parts: string[]): string {
  return [folder, ...parts].filter((part) => part !== '').join('/');
}

function isSameOrUnder(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}

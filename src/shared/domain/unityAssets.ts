// What a model's materials name, looked up as Unity would find it, where the version of the model shown is (its
// `AssetsPoint`): textures by the file name the model stores (Unity's texture search), assets by their GUID (a `.meta`'s
// remaps, a material's textures), and files at paths already known (a glTF's images beside it). Paths are
// workspace-relative, `/`-separated.

import type { RevisionRef } from './revision';

/**
 * Where a version of a model is, so its materials and textures are the ones that go with it: the workspace's disk as
 * it is (pending changes, a workspace file), or the repository's tree at a changeset or a branch's head (`cs:12`,
 * `br:/main/task`: what `cm ls --tree` lists), never the disk's files of another revision.
 */
export type AssetsPoint = { kind: 'workspace' } | { kind: 'repository'; at: string; before?: AssetsBefore };

/**
 * The side before a change, at the tree after it: `changes`, the files a diff changed, each as it was before it (none:
 * the diff added it); `changeset`, every file of `repository` the changeset made, as it was before it (its parent
 * revision), as the tree's listing tells. Changeset numbers are per repository: a file under an xlink made in its own
 * repository's changeset of the same number stays. A file the changeset deleted isn't in the tree after it: the side
 * before doesn't find it.
 */
export type AssetsBefore = { kind: 'changes'; changes: ChangedAsset[] } | { kind: 'changeset'; changeset: number; repository: string };

/**
 * How long a branch head's tree is taken as it was listed, by main (`RepositoryTrees`) and the renderer's queries
 * alike: a changeset's never changes, a branch's moves as people check in. Long enough for the reads of the diff on
 * screen, both sides and both rounds of lookups, to share one listing.
 */
export const BRANCH_TREE_LIFE_MS = 60_000;

/** A file a diff changed, as it was on the side before: its revision there, or null where it wasn't there yet. */
export interface ChangedAsset {
  path: string;
  revision: RevisionRef | null;
}

/** A texture a model's material names, to be found as Unity's texture search finds it. */
export interface TextureLookup {
  /** The file name as stored, with its extension (`bark.png`). */
  name: string;
  /** The paths the model stores for it, as written on the artist's machine: relative to the model, or absolute. */
  storedPaths: string[];
  /** The GUID of the texture the model's `.meta` remaps this one to (by its name without extension), tried first. */
  remapGuid: string | null;
}

export interface UnityAssetsRequest {
  /** The model's path in the workspace: Unity's project and the folders searched are found from it. */
  modelPath: string;
  /** Where the version of the model is: what is looked up is what was there with it. */
  point: AssetsPoint;
  textures: TextureLookup[];
  /** Assets by GUID (32 hex digits). */
  guids: string[];
  /** Files at known paths (a glTF's images beside it), told only if they are there. */
  paths: string[];
  /** Whether a texture may be any file of its name in the project when the folders searched first don't have it. */
  searchTexturesGlobally: boolean;
}

/**
 * A file found, with what tells one version of it from another: on the workspace's disk, its size and when it was
 * last written; in the repository, its revision and content hash (MD5, base64, as `cm` gives it; null where not known,
 * as for a diff's side before). Read with `unityAssets.read`.
 */
export type FoundFile = { path: string; size: number } & ({ stored: 'disk'; modified: number } | { stored: 'repository'; revision: RevisionRef; hash: string | null });

/** One key per version of a file found: its path, and what tells that version (`FoundFile`). */
export function foundFileKey(file: FoundFile): string {
  const version = file.stored === 'disk' ? `${file.size}\0${file.modified}` : `${file.revision.revisionId}@${file.revision.repository}`;
  return `${file.path}\0${file.stored}\0${version}`;
}

/** Each lookup's file, in the request's order; null where nothing was found. */
export interface UnityAssetsAnswer {
  textures: (FoundFile | null)[];
  guids: (FoundFile | null)[];
  paths: (FoundFile | null)[];
  /**
   * Whether the model's Unity project imports `.psb` files as textures: only with the 2D PSD Importer package
   * (`com.unity.2d.psdimporter`) in its `Packages/manifest.json` or `packages-lock.json`. A `.psd` it always imports.
   */
  importsPsb: boolean;
  /** Whether every GUID answered null is known missing, and if not, why (`GuidMisses`). */
  guidMisses: GuidMisses;
}

/**
 * `known`: every GUID answered null is missing. Otherwise one isn't known missing: `noProject`, a model outside any
 * Unity project (a package's own repository, which no project's index looks up); `outsidePackage`, a project that
 * loads a package from a folder outside it (`file:../…` in its manifest), whose assets no folder read holds; `noLibrary`, a project without a
 * `Library` (never opened in Unity on this machine: no package cache to look in); `unread`, a read that couldn't
 * finish (a file held, a change overtaking it), or a file found the disk refused to check (an antivirus holding
 * it: textures too).
 */
export type GuidMisses = 'known' | 'noProject' | 'outsidePackage' | 'noLibrary' | 'unread';

/** The most lookups of each kind one request may carry: a model is read with at most 64 textures. */
export const MAX_UNITY_ASSET_LOOKUPS = 512;
/**
 * The most bytes (`downloadedAheadBytesOf`) one `unityAssets.download` asks for: half what a session keeps of its
 * downloads (1 GB, one budget for every window), so what one look fetched is still kept when it reads it, a few at a
 * time. A look needing more asks for the rest as its reads get there. Past that (two looks downloading at once, a
 * repository's big listing meanwhile), a texture let go of before its read is downloaded again, alone.
 */
export const MAX_DOWNLOADED_AHEAD_BYTES = 512 * 1024 * 1024;
/** What a revision of unknown size (a diff's side before) counts as downloaded ahead: as much as a big texture takes. */
export const UNKNOWN_TEXTURE_BYTES = 64 * 1024 * 1024;

/** What a file counts as against `MAX_DOWNLOADED_AHEAD_BYTES`: its size, or `UNKNOWN_TEXTURE_BYTES` where not known. */
export function downloadedAheadBytesOf(file: FoundFile): number {
  return file.size >= 0 ? file.size : UNKNOWN_TEXTURE_BYTES;
}
/** The most paths a model stores for one texture (an FBX: its relative and absolute ones). */
export const MAX_STORED_PATHS = 16;
/** The longest name or path a request may carry: past any OS's path length. */
export const MAX_UNITY_ASSET_PATH_LENGTH = 4096;
/** The most files a diff's side before may say it changed (`AssetsBefore`'s `changes`). */
export const MAX_CHANGED_ASSETS = 20_000;

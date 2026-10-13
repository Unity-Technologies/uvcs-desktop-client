// What a model's materials name, looked up in the workspace on disk as Unity would find it: textures by the file name
// the model stores (Unity's texture search), assets by their GUID (a `.meta`'s remaps, a material's textures), and
// files at paths already known (a glTF's images beside it). Paths are workspace-relative, `/`-separated.

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
  textures: TextureLookup[];
  /** Assets by GUID (32 hex digits). */
  guids: string[];
  /** Files at known paths (a glTF's images beside it), told only if they are there. */
  paths: string[];
  /** Whether a texture may be any file of its name in the project when the folders searched first don't have it. */
  searchTexturesGlobally: boolean;
}

/** A file found, with what tells one version of it from another: its size and when it was last written. */
export interface FoundFile {
  path: string;
  size: number;
  modified: number;
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
  /**
   * Whether a GUID answered null is known missing: false for a model outside any project (a package's own repository),
   * where no project's index looks GUIDs up and every one is answered null without telling whether the asset exists.
   */
  guidMissesKnown: boolean;
}

/** The most lookups of each kind one request may carry: a model is read with at most 64 textures. */
export const MAX_UNITY_ASSET_LOOKUPS = 512;
/** The most paths a model stores for one texture (an FBX: its relative and absolute ones). */
export const MAX_STORED_PATHS = 16;
/** The longest name or path a request may carry: past any OS's path length. */
export const MAX_UNITY_ASSET_PATH_LENGTH = 4096;

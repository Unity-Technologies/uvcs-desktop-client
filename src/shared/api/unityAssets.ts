import type { FoundFile, UnityAssetsAnswer, UnityAssetsRequest } from '../domain/unityAssets';

export interface UnityAssetsApi {
  /**
   * Where the files a model's materials name are, found as Unity finds them (its texture search, GUIDs through the
   * project's `.meta` files), at the version's point (`request.point`): the workspace's disk, or the repository's tree
   * there (`cm ls --tree`, once per point, the model's folder first). Nothing outside the workspace.
   */
  find(workspacePath: string, request: UnityAssetsRequest): Promise<UnityAssetsAnswer>;
  /**
   * A file found's bytes; null when it's no longer there. A repository's revision is read from the disk when the
   * workspace's file there has the same content (its hash), else downloaded with the others asked meanwhile in one
   * `cm cat`, and kept for the session.
   */
  read(workspacePath: string, file: FoundFile): Promise<Uint8Array | null>;
  /**
   * Downloads, in one `cm cat`, the repository's revisions among the files that the workspace's disk hasn't, without
   * reading them; files on the disk need nothing. A reader that reads a few at a time to hold few in memory (the
   * Materials look's textures) asks for them all here first: its reads then download nothing, and one that fails says
   * so as it is read. At most `MAX_UNITY_ASSET_LOOKUPS` files, of `MAX_DOWNLOADED_AHEAD_BYTES` in all.
   */
  download(workspacePath: string, files: FoundFile[]): Promise<void>;
}

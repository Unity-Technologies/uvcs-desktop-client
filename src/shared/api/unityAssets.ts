import type { UnityAssetsAnswer, UnityAssetsRequest } from '../domain/unityAssets';

export interface UnityAssetsApi {
  /**
   * Where the files a model's materials name are in the workspace on disk, found as Unity finds them (its texture
   * search, GUIDs through the project's `.meta` files). Reads only the disk, never `cm` nor the server; nothing outside
   * the workspace.
   */
  find(workspacePath: string, request: UnityAssetsRequest): Promise<UnityAssetsAnswer>;
}

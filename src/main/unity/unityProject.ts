/** A Unity project in the workspace: its folder and its `Assets` folder, workspace-relative and `/`-separated. */
export interface UnityProject {
  /** '' when the workspace is the project. */
  root: string;
  /** `Assets` as written on disk, under the root (`Game/Assets`). */
  assets: string;
}

/**
 * The Unity project a model is in: the outermost folder above it holding an `Assets` folder the model is under (its
 * name matched whatever its case, as Unity projects copied between machines have it). The outermost, as an asset
 * store package can keep an `Assets` folder of its own inside the project's. Null outside one (a model in a package,
 * in a folder of source art): Unity's search then climbs to the workspace's root.
 */
export function unityProjectOf(modelPath: string): UnityProject | null {
  const parts = modelPath.split('/');
  const at = parts.slice(0, -1).findIndex((part) => part.toLowerCase() === 'assets');
  return at === -1 ? null : { root: parts.slice(0, at).join('/'), assets: parts.slice(0, at + 1).join('/') };
}

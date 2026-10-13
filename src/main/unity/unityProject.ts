/** A Unity project in the workspace: its folder and its `Assets` folder, workspace-relative and `/`-separated. */
export interface UnityProject {
  /** '' when the workspace is the project. */
  root: string;
  /** `Assets` as written on disk, under the root (`Game/Assets`). */
  assets: string;
}

/**
 * The Unity project a model is in: the nearest folder above it holding an `Assets` folder the model is under (its
 * name matched whatever its case, as Unity projects copied between machines have it). Null outside one (a model in a
 * package, in a folder of source art): Unity's search then climbs to the workspace's root.
 */
export function unityProjectOf(modelPath: string): UnityProject | null {
  const parts = modelPath.split('/');
  for (let at = parts.length - 2; at >= 0; at--) {
    if (parts[at]!.toLowerCase() === 'assets') return { root: parts.slice(0, at).join('/'), assets: parts.slice(0, at + 1).join('/') };
  }
  return null;
}

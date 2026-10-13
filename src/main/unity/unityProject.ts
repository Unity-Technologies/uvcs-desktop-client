/** A Unity project in the workspace: its folder and its `Assets` folder, workspace-relative and `/`-separated. */
export interface UnityProject {
  /** '' when the workspace is the project. */
  root: string;
  /** `Assets` as written on disk, under the root (`Game/Assets`). */
  assets: string;
}

/**
 * The Unity project a model is in, as Unity knows one: the nearest folder above it whose `Assets` folder (the model is
 * under) has a `ProjectSettings` folder beside it (`holdsProjectSettings`, which asks the disk). Nearest, as a project
 * may be kept inside another's `Assets`. Where none has one (a project checked in without it), `unityProjectOf`.
 */
export async function unityProjectFound(modelPath: string, holdsProjectSettings: (root: string) => Promise<boolean>): Promise<UnityProject | null> {
  for (const project of projectsAbove(modelPath).reverse()) {
    if (await holdsProjectSettings(project.root)) return project;
  }
  return unityProjectOf(modelPath);
}

/**
 * The Unity project a model is in, by folder names alone: the outermost folder above it holding an `Assets` folder
 * the model is under. The outermost, as an asset store package can keep an `Assets` folder of its own inside the
 * project's; named exactly `Assets`, as Unity's is, so a folder of source art named `assets` above a project is no
 * project's. Where none is named exactly, the outermost of any case, as projects copied between machines have it.
 * Null outside one (a model in a package, in a folder of source art): Unity's search then climbs to the workspace's
 * root.
 */
export function unityProjectOf(modelPath: string): UnityProject | null {
  const projects = projectsAbove(modelPath);
  return projects.find((project) => project.assets.endsWith('/Assets') || project.assets === 'Assets') ?? projects[0] ?? null;
}

/** Each folder above the model holding an `Assets` folder (whatever its case) the model is under, outermost first. */
function projectsAbove(modelPath: string): UnityProject[] {
  const parts = modelPath.split('/');
  const projects: UnityProject[] = [];
  parts.slice(0, -1).forEach((part, at) => {
    if (part.toLowerCase() === 'assets') projects.push({ root: parts.slice(0, at).join('/'), assets: parts.slice(0, at + 1).join('/') });
  });
  return projects;
}

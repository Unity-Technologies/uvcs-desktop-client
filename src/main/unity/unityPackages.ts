// What a Unity project's packages make Unity import: a `.psb` is a texture only with the 2D PSD Importer package
// (`com.unity.2d.psdimporter`), named in `Packages/manifest.json` or, brought in by another package, in
// `Packages/packages-lock.json`.

const PSD_IMPORTER = 'com.unity.2d.psdimporter';

/** Whether a manifest's or lock's text lists the 2D PSD Importer among its dependencies; false for text that isn't one. */
export function listsPsdImporter(text: string | null): boolean {
  if (text === null) return false;
  try {
    const { dependencies } = JSON.parse(text) as { dependencies?: unknown };
    return typeof dependencies === 'object' && dependencies !== null && PSD_IMPORTER in dependencies;
  } catch {
    return false;
  }
}

/** The files that tell a project's packages, workspace-relative, in its `Packages` folder. */
export function packageListsOf(projectRoot: string): string[] {
  const folder = projectRoot === '' ? 'Packages' : `${projectRoot}/Packages`;
  return [`${folder}/manifest.json`, `${folder}/packages-lock.json`];
}

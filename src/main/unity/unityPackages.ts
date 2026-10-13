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

/**
 * Whether a manifest's text loads a package from a folder outside the project's `Packages` (`file:../../Shared/…`, or
 * an absolute path): Unity reads it where it lies, never into `Library/PackageCache`, so its assets are in no folder
 * the index reads. A `.tgz` Unity unpacks into the cache; `file:<name>` is a folder inside `Packages`, read already.
 */
export function loadsPackagesFromOutside(text: string | null): boolean {
  if (text === null) return false;
  try {
    const { dependencies } = JSON.parse(text) as { dependencies?: unknown };
    if (typeof dependencies !== 'object' || dependencies === null) return false;
    return Object.values(dependencies).some((spec) => typeof spec === 'string' && isOutsideFolder(spec));
  } catch {
    return false;
  }
}

function isOutsideFolder(spec: string): boolean {
  if (!spec.startsWith('file:') || spec.toLowerCase().endsWith('.tgz')) return false;
  const path = spec.slice('file:'.length).replaceAll('\\', '/');
  return path.startsWith('../') || path.startsWith('/') || /^[a-z]:/i.test(path);
}

/** The files that tell a project's packages, workspace-relative, in its `Packages` folder. */
export function packageListsOf(projectRoot: string): string[] {
  const folder = projectRoot === '' ? 'Packages' : `${projectRoot}/Packages`;
  return [`${folder}/manifest.json`, `${folder}/packages-lock.json`];
}

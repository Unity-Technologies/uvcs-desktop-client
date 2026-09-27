/**
 * The folder holding what a file system event reports (`/`-separated, `''` for the workspace root), whose listing
 * changed; null when the platform didn't tell which item it was. On macOS in the decomposed form `cm` names folders
 * with, whatever form the file system reported.
 */
export function changedFolder(relativePath: string | undefined, platform: NodeJS.Platform): string | null {
  if (!relativePath) return null;
  const path = relativePath.replaceAll('\\', '/');
  const slash = path.lastIndexOf('/');
  const folder = slash < 0 ? '' : path.slice(0, slash);
  return platform === 'darwin' ? folder.normalize('NFD') : folder;
}

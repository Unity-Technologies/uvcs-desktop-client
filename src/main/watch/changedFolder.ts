/**
 * The folder holding what a file system event reports (`/`-separated, `''` for the workspace root), whose listing
 * changed; null when the platform didn't tell which item it was.
 */
export function changedFolder(relativePath: string | undefined): string | null {
  if (!relativePath) return null;
  const path = relativePath.replaceAll('\\', '/');
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}

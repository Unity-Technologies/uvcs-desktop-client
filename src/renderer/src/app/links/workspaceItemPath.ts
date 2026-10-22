/**
 * Where a workspace link's folder is in its workspace, as the app names items (`Assets/Player.cs`, forward slashes):
 * '' for the workspace's root, null outside it. Windows and macOS compare names in any case, as their file systems do
 * (`cm` names the root as it is on disk, an agent may write it otherwise); Linux exactly.
 */
export function workspaceItemPath(root: string, folder: string, platform: string): string | null {
  const caseless = platform === 'win32' || platform === 'darwin';
  const comparable = (path: string): string => {
    const forward = path.replaceAll('\\', '/').replace(/\/+$/, '');
    return caseless ? forward.toLowerCase() : forward;
  };
  const rootPath = comparable(root);
  const folderPath = comparable(folder);
  if (folderPath === rootPath) return '';
  if (!folderPath.startsWith(`${rootPath}/`)) return null;
  return folder.replaceAll('\\', '/').replace(/\/+$/, '').slice(rootPath.length + 1);
}

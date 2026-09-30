/** Joins a folder and a name with the folder's own separator (`/` or `\`). */
export function joinPath(directory: string, name: string): string {
  const separator = directory.includes('\\') ? '\\' : '/';
  return directory.endsWith(separator) ? `${directory}${name}` : `${directory}${separator}${name}`;
}

/**
 * The last name of a local path, with either separator: `game` for `C:\work\game\`. Workspace-relative and server
 * paths take `fileNameOf`: only `/` separates their names.
 */
export function lastSegment(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

/** The folder containing a path, e.g. `/Users/me/wkspaces` for `/Users/me/wkspaces/game`. */
export function parentDirectory(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const end = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return end > 0 ? trimmed.slice(0, end) : trimmed.slice(0, end + 1) || trimmed;
}

/**
 * `cm undelete`'s refusals in the app's words, for the item restored at `path` (workspace-relative); null for any other
 * failure, which stays as `cm` tells it. `cm` names the item by its id and its server path, and the operation by its
 * own name.
 */
export function undeleteRefusal(output: string, path: string): string | null {
  const text = output.trim();
  // The item is still loaded somewhere in the workspace (`The item 35 is already loaded on tree on path '/src/a.cs'.`).
  const loaded = /^The item \d+ is already loaded on tree on path '\/(.*)'\.$/s.exec(text);
  if (loaded) return `${path} is already in the workspace, at ${loaded[1]}.`;
  if (text === 'Undelete operation is not supported for xlinks.') return `${path} is or holds an xlink, and xlinks can’t be restored.`;
  // The app checks the place first; this is something taking it in between.
  if (text === 'The restore path should not exist.') return placeTaken(path);
  return null;
}

/** Why an item can't come back at `path`: something is there. */
export function placeTaken(path: string): string {
  return `${path} is already in the workspace. Restore it to another path.`;
}

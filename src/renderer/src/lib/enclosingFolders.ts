/**
 * Every folder that holds one of `paths` (`/src` and `/src/ui` for `/src/ui/a.ts`), as listed paths name them: a
 * listed path among them is a folder with other listed items in it.
 */
export function enclosingFolders(paths: Iterable<string>): Set<string> {
  const folders = new Set<string>();
  for (const path of paths) {
    for (let end = path.lastIndexOf('/'); end > 0; end = path.lastIndexOf('/', end - 1)) folders.add(path.slice(0, end));
  }
  return folders;
}

/**
 * `items` without the folders whose items are listed too: a folder added or deleted with what it holds says nothing
 * they don't (a new folder tree would fill the top of the list). `keepsFolder`: a folder listed all the same, e.g. a
 * moved one, which a move lists alone. Items that are no folder never enclose others, so only folders go.
 */
export function withoutRepeatedFolders<T>(items: T[], pathOf: (item: T) => string, keepsFolder: (item: T) => boolean): T[] {
  const enclosing = enclosingFolders(items.map(pathOf));
  return items.filter((item) => keepsFolder(item) || !enclosing.has(pathOf(item)));
}

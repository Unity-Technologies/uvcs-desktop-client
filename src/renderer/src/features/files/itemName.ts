/**
 * What's wrong with a name typed for a new or renamed item, or undefined when it can be used. `siblings` are the names
 * already in the target folder (as far as they're listed); names differing only in case count as taken, as they do on
 * macOS and Windows. A new item's name may hold folders (`docs/intro.md`), created along with it.
 */
export function itemNameProblem(name: string, siblings: readonly string[], { allowFolders }: { allowFolders: boolean }): string | undefined {
  const segments = name.trim().split('/');
  if (!allowFolders && segments.length > 1) return 'A name can’t contain “/”';
  if (segments.some((segment) => segment.trim() === '')) return 'Folder names can’t be empty';
  if (segments.some((segment) => segment === '.' || segment === '..')) return '“.” and “..” aren’t names';
  if (name.includes('\\')) return 'A name can’t contain “\\”';

  const first = segments[0]!.trim().toLowerCase();
  const taken = siblings.find((sibling) => sibling.toLowerCase() === first);
  if (taken !== undefined && segments.length === 1) return `“${taken}” already exists here`;
  return undefined;
}

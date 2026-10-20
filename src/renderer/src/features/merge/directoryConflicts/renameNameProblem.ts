import { isValidRenameName } from '@shared/domain/merge';

/** What the Keep both name field says is wrong with `newName`, by the merge's rule (`isValidRenameName`); undefined when nothing is. */
export function renameNameProblem(newName: string): string | undefined {
  if (isValidRenameName(newName)) return undefined;
  if (newName.trim() === '') return 'Enter a name.';
  if (newName === '.' || newName === '..') return `“${newName}” names a folder, not an item: enter another name.`;
  return 'Enter a file name without folders.';
}

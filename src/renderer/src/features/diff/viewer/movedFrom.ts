/**
 * Where a moved file came from, as its diff's header says it after the path: the old name alone when the file stayed
 * in its folder (a rename), the old path when it changed folders.
 */
export function movedFrom(path: string, oldPath: string): string {
  const folder = (of: string): string => of.slice(0, of.lastIndexOf('/') + 1);
  return folder(path) === folder(oldPath) ? oldPath.slice(folder(oldPath).length) : oldPath;
}

/** Why a moved file's diff shows no changes: the header already says where it came from. */
export const ONLY_MOVED = 'The file was only moved.';

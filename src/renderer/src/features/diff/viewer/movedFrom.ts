import { pathChangeSegments, type PathPart } from '../../../lib/pathChangeSegments';

/**
 * Where a moved file came from, as its diff's header says it before the path: the old name alone when the file stayed
 * in its folder (a rename), the old path when it changed folders.
 */
export function movedFrom(path: string, oldPath: string): string {
  const folder = (of: string): string => of.slice(0, of.lastIndexOf('/') + 1);
  return folder(path) === folder(oldPath) ? oldPath.slice(folder(oldPath).length) : oldPath;
}

/** Why a moved file's diff shows no changes: the header already says where it came from. */
export const ONLY_MOVED = 'The file was only moved.';

/** The characters a move changed in its diff's header: in the path (added) and in what `movedFrom` names (removed). */
export interface MovedTitleMarks {
  path: number[];
  from: number[];
}

/**
 * What a move changed, marked in the header as its hover marks it (`pathChangeSegments`, `PathMoveLines`): the
 * segments it added to the path, and those it removed from where the file was, as far as `movedFrom` shows it.
 */
export function movedTitleMarks(path: string, oldPath: string): MovedTitleMarks {
  const change = pathChangeSegments(oldPath, path);
  // Each path's parts end it; the shared folder before them may be spelled in another Unicode form in each path.
  return {
    path: changedPositions(change.new, path.length - textOf(change.new).length),
    from: changedPositions(change.old, movedFrom(path, oldPath).length - textOf(change.old).length),
  };
}

function textOf(parts: PathPart[]): string {
  return parts.map((part) => part.text).join('');
}

function changedPositions(parts: PathPart[], start: number): number[] {
  const positions: number[] = [];
  let offset = start;
  for (const part of parts) {
    if (part.changed) for (let index = 0; index < part.text.length; index++) positions.push(offset + index);
    offset += part.text.length;
  }
  return positions;
}

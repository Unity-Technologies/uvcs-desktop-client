import { pathChangeSegments, type PathPart } from '../../../lib/pathChangeSegments';

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
  const from = movedFrom(path, oldPath);
  // `movedFrom` is the end of the old path: positions before it were dropped with the shared folder.
  const fromShift = oldPath.length - from.length;
  return {
    path: changedPositions(change.new, change.folder.length),
    from: changedPositions(change.old, change.folder.length - fromShift).filter((position) => position >= 0),
  };
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

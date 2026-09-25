import type { DiffEntry } from '@shared/domain/diff';
import type { FailedCommand } from '@shared/ipc';

/**
 * `MERGE_NEEDED A merge is needed from changeset 'cs:43@rep:…' to changeset 'cs:41@rep:…' in order to checkin.`
 * (also without the `--machinereadable` code).
 */
const MERGE_NEEDED = /A merge is needed from changeset 'cs:(\d+)[^']*' to changeset 'cs:(\d+)/;

/** The branch head moved since the workspace was last updated. */
export interface CheckinRejection {
  headChangeset: number;
  loadedChangeset: number;
}

/**
 * Someone checked in to the branch since the workspace was updated: `cm` rejects every checkin until the workspace
 * catches up, even when none of the files overlap.
 */
export function checkinRejection(command: FailedCommand | undefined): CheckinRejection | null {
  const match = command && MERGE_NEEDED.exec(command.output);
  return match ? { headChangeset: Number(match[1]), loadedChangeset: Number(match[2]) } : null;
}

/** The local paths an incoming change touches: the same item, or one inside the other (a moved or deleted directory). */
export function overlappingPaths(incoming: DiffEntry[], localPaths: string[]): string[] {
  const touched = incoming
    // A directory "changes" whenever something inside it does; that alone touches nothing.
    .filter((entry) => !(entry.itemType === 'directory' && entry.status === 'changed'))
    .flatMap((entry) => (entry.oldPath ? [entry.path, entry.oldPath] : [entry.path]));
  return localPaths.filter((path) => touched.some((other) => other === path || isInside(path, other) || isInside(other, path)));
}

function isInside(path: string, directory: string): boolean {
  return path.startsWith(`${directory}/`);
}

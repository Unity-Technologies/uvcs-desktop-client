import { onLinksThemselves } from './symlinkArgs';

/**
 * `cm checkin` of the given items, private ones added and moves and deletions found on disk included, with the comment
 * read from a file. A link named checks in the link itself: without `--symlink` cm checks in the file it points to
 * ("The item /README.md is not changed").
 */
export function checkinArgs(paths: string[], commentsFile: string): string[] {
  return onLinksThemselves('checkin', ...paths, '--all', '--private', `-commentsfile=${commentsFile}`, '--machinereadable');
}

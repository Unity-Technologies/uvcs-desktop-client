import { onLinksThemselves } from './symlinkArgs';

/**
 * `cm checkin` of the given items, moves and deletions found on disk included, with the comment read from a file. cm
 * takes everything under each path, with `--private` every private item there too, so it is asked for only when a
 * private item is to go in. `--dependencies` takes the private and added folders above each path, and nothing else in
 * them, so a private file goes in without its folder given (which would take all the folder holds). A link named checks in the link itself: without `--symlink` cm checks in the file it
 * points to ("The item /README.md is not changed").
 */
export function checkinArgs(paths: string[], commentsFile: string, addsPrivate: boolean): string[] {
  return onLinksThemselves('checkin', ...paths, '--all', '--dependencies', ...(addsPrivate ? ['--private'] : []), `-commentsfile=${commentsFile}`, '--machinereadable');
}

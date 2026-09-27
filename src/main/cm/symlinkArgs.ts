/** The commands that follow a symbolic link to its target unless told `--symlink`. */
type LinkFollowingCommand = 'ls' | 'fileinfo' | 'history' | 'checkout' | 'undo';

/**
 * `cm` arguments that act on a symbolic link itself, as every other item is acted on: without `--symlink`, undoing a
 * link reverts the changes of the file it points to, checking it out checks out that file, and `ls`, `fileinfo` and
 * `history` describe that file under the link's name. Items that aren't links read the same either way.
 */
export function onLinksThemselves(command: LinkFollowingCommand, ...args: string[]): string[] {
  return [command, ...args, '--symlink'];
}

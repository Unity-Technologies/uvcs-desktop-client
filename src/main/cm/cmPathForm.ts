import { isSameOrInside } from '../files/pathContainment';

/**
 * The command with its local paths the way `cm` reads names on macOS: decomposed (NFD, `e` + accent), as it reports
 * them. Given the composed form most apps write (`é`), `cm checkin` says there are no changes; a file on disk is found
 * by either form. Only paths in the working directory change: branch names, queries and server paths are the
 * repository's, as they were written.
 */
export function inCmPathForm(args: string[], cwd: string, platform: NodeJS.Platform): string[] {
  if (platform !== 'darwin') return args;
  return args.map((arg) => (arg.startsWith('/') && !isAscii(arg) && isSameOrInside(cwd, arg, platform) ? arg.normalize('NFD') : arg));
}

function isAscii(text: string): boolean {
  return /^[\x00-\x7f]*$/.test(text);
}

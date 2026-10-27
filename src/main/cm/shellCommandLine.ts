/**
 * `cm shell`, reading its commands as UTF-8 as they are written: otherwise it reads them in the console's code page on
 * Windows (437, 850...), and a path or branch name with an accent names something else.
 *
 * It names the app, so the usage events it records are this app's, and sends no pings of its own: the app pings once
 * an hour (`UsageEvents`), where each shell it keeps open would ping for itself. A `cm` that doesn't know these
 * options ignores them.
 */
export const SHELL_ARGS = ['shell', '--encoding=utf-8', '--application=UVCSDesktop', '--nopingevents'];

/** A `cm shell` line has no escapes: a quote would end an argument early, and a line break the command. */
const UNSAFE_FOR_SHELL = /["\r\n]/;

export function canRunInShell(args: string[]): boolean {
  return !args.some((arg) => UNSAFE_FOR_SHELL.test(arg));
}

/** The line a `cm shell` reads the command from: arguments that are empty or hold spaces go in quotes. */
export function toShellCommandLine(args: string[]): string {
  return args.map((arg) => (arg === '' || /\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
}

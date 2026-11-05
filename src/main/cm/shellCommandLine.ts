/**
 * `cm shell`, reading its commands as UTF-8 as they are written: otherwise it reads them in the console's code page on
 * Windows (437, 850...), and a path or branch name with an accent names something else.
 */
export const SHELL_ARGS = ['shell', '--encoding=utf-8'];

/**
 * A `cm shell` line has no escapes: it splits on spaces, a quote toggles quoting, and each argument is trimmed and
 * dropped when empty. So a quote would end an argument early, a line break the command, and an argument that is empty
 * or starts or ends with whitespace would reach `cm` changed.
 */
const UNSAFE_FOR_SHELL = /["\r\n]/;

function isSafeForShell(arg: string): boolean {
  return arg !== '' && arg === arg.trim() && !UNSAFE_FOR_SHELL.test(arg);
}

export function canRunInShell(args: string[]): boolean {
  return args.every(isSafeForShell);
}

/** The line a `cm shell` reads the command from: arguments that hold spaces go in quotes. */
export function toShellCommandLine(args: string[]): string {
  return args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
}

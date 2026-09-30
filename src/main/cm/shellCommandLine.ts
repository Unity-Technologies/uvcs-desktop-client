/**
 * `cm shell`, reading its commands as UTF-8 as they are written: otherwise it reads them in the console's code page on
 * Windows (437, 850...), and a path or branch name with an accent names something else.
 */
export const SHELL_ARGS = ['shell', '--encoding=utf-8'];

/** A `cm shell` line has no escapes: a quote would end an argument early, and a line break the command. */
const UNSAFE_FOR_SHELL = /["\r\n]/;

export function canRunInShell(args: string[]): boolean {
  return !args.some((arg) => UNSAFE_FOR_SHELL.test(arg));
}

/** The line a `cm shell` reads the command from: arguments that are empty or hold spaces go in quotes. */
export function toShellCommandLine(args: string[]): string {
  return args.map((arg) => (arg === '' || /\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
}

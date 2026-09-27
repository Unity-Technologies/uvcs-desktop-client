/**
 * `cm shell`, reading its commands as UTF-8 as they are written: otherwise it reads them in the console's code page on
 * Windows (437, 850...), and a path or branch name with an accent names something else.
 */
export const SHELL_ARGS = ['shell', '--encoding=utf-8'];

const UNSAFE_FOR_SHELL = /["\r\n]/;

export function canRunInShell(args: string[]): boolean {
  return !args.some((arg) => UNSAFE_FOR_SHELL.test(arg));
}

export function toShellCommandLine(args: string[]): string {
  return args.map((arg) => (arg === '' || /\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
}

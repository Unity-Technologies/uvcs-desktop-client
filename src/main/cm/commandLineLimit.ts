/**
 * Windows starts a process with at most 32,767 characters of command line, `cm.exe`'s own path included, and macOS
 * with about a megabyte of arguments and environment: a checkin or a shelve of thousands of files names more.
 */
export const MAX_COMMAND_LINE = 30_000;

/** Measured as Windows gets it, with the quotes and escapes that make it the longest of every OS's. */
export function fitsCommandLine(args: readonly string[]): boolean {
  let length = 0;
  for (const arg of args) length += quotedLength(arg) + 1;
  return length <= MAX_COMMAND_LINE;
}

/**
 * How long an argument is on a Windows command line, quoted as Node (libuv) quotes it: as it is without spaces, tabs
 * or quotes; otherwise in quotes, with a backslash before each quote and the backslashes before a quote or the closing
 * one doubled (`C:\My Project\` becomes `"C:\My Project\\"`).
 */
export function quotedLength(arg: string): number {
  if (arg === '') return 2;
  if (!/[ \t"]/.test(arg)) return arg.length;
  let length = arg.length + 2;
  let backslashes = 0;
  for (const char of arg) {
    if (char === '\\') {
      backslashes++;
      continue;
    }
    if (char === '"') length += backslashes + 1;
    backslashes = 0;
  }
  return length + backslashes;
}

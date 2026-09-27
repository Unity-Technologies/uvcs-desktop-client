import { canRunInShell, SHELL_ARGS, toShellCommandLine } from './shellCommandLine';
import { printsInConsoleCodePage } from './utf8Output';

/**
 * Windows starts a process with at most 32,767 characters of command line, `cm.exe`'s own path included, and macOS
 * with about a megabyte of arguments and environment: a checkin or a shelve of thousands of files names more.
 */
export const MAX_COMMAND_LINE = 30_000;

interface ProcessCommand {
  args: string[];
  /** The command line, for a `cm shell` of its own to read. */
  input?: string;
}

/**
 * How to run `cm <args>` in a process of its own: as is, or as a line a `cm shell` reads, when it's too long to start
 * a process with (as long as it takes), or on Windows when it prints text: a process prints it in the console's code
 * page there (437, 850...), garbling accents and turning other scripts into `?`, a shell in UTF-8. It costs the
 * shell's start, about half a second more.
 */
export function processCommand(args: string[], platform: NodeJS.Platform = process.platform): ProcessCommand {
  const asIs = fitsCommandLine(args) && (platform !== 'win32' || !printsInConsoleCodePage(args));
  // A path with a quote or a line break can't be written on a shell's line: it's left to the process as it is.
  if (asIs || !canRunInShell(args)) return { args };
  return { args: [...SHELL_ARGS], input: `${toShellCommandLine(args)}\nexit\n` };
}

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

const RESULT_LINE = /^CommandResult (-?\d+)$/;

/** Whether an output line is the `CommandResult <code>` a `cm shell` ends a command's output with. */
export function isShellResultLine(line: string): boolean {
  return RESULT_LINE.test(line);
}

/** The output of a command a `cm shell` of its own ran, without its `CommandResult` line, and the command's exit code. */
export function shellCommandResult(output: string): { output: string; exitCode: number } {
  const lines = output.replace(/\r?\n$/, '').split(/\r?\n/);
  const code = RESULT_LINE.exec(lines.at(-1) ?? '');
  // No result line: the shell itself failed (it couldn't start, or was stopped).
  if (!code) return { output, exitCode: -1 };
  return { output: lines.slice(0, -1).map((line) => `${line}\n`).join(''), exitCode: Number(code[1]) };
}

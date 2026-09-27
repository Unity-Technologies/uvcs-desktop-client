import { canRunInShell, toShellCommandLine } from './shellCommandLine';

/**
 * Windows starts a process with at most 32,767 characters of command line, and macOS with about a megabyte of
 * arguments and environment: a checkin or a shelve of thousands of files names more.
 */
export const MAX_COMMAND_LINE = 30_000;

interface ProcessCommand {
  args: string[];
  /** The command line, for a `cm shell` of its own to read, when it's too long to start a process with. */
  input?: string;
}

/** How to run `cm <args>` in a process of its own: as is, or as a line a `cm shell` reads (as long as it takes). */
export function processCommand(args: string[]): ProcessCommand {
  // A path with a quote or a line break can't be written on a shell's line: it's left to the process as it is.
  if (fitsCommandLine(args) || !canRunInShell(args)) return { args };
  return { args: ['shell'], input: `${toShellCommandLine(args)}\nexit\n` };
}

export function fitsCommandLine(args: readonly string[]): boolean {
  let length = 0;
  for (const arg of args) length += arg.length + 1;
  return length <= MAX_COMMAND_LINE;
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

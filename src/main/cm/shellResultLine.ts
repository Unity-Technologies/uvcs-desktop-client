import type { CmResult } from './CmResult';

/**
 * The `CommandResult <code>` line `cm shell` ends each command's output with. A command's output can hold such a line
 * too (a changeset comment quoting a `cm shell` session), so only the last line, with nothing after it, ends it.
 */
const RESULT_LINE = /^CommandResult (-?\d+)\r?$/;
/** Longer than any result line. */
const RESULT_LINE_ROOM = 40;

/** Whether an output line is the result line. */
export function isShellResultLine(line: string): boolean {
  return RESULT_LINE.test(line);
}

/**
 * The result line the output read so far ends with: where the command's own output ends (before the line break that
 * precedes the result line) and its exit code; null when the output doesn't end with one. Only the end is looked at,
 * so huge outputs arriving in hundreds of chunks stay cheap.
 */
export function resultLineAtEnd(output: string): { outputEnd: number; exitCode: number } | null {
  if (!output.endsWith('\n')) return null;
  const tailStart = Math.max(0, output.length - RESULT_LINE_ROOM);
  const lineInTail = output.slice(tailStart).lastIndexOf('CommandResult ');
  if (lineInTail < 0) return null;
  const lineStart = tailStart + lineInTail;
  if (lineStart > 0 && output[lineStart - 1] !== '\n') return null;
  const result = RESULT_LINE.exec(output.slice(lineStart, -1));
  return result ? { outputEnd: Math.max(0, lineStart - 1), exitCode: Number(result[1]) } : null;
}

/** The output of a command a `cm shell` of its own ran, without its result line, and the command's exit code. */
export function shellCommandResult(output: string): CmResult {
  const lines = output.replace(/\r?\n$/, '').split(/\r?\n/);
  const result = RESULT_LINE.exec(lines.at(-1) ?? '');
  // No result line: the shell itself failed (it couldn't start, or was stopped).
  if (!result) return { output, exitCode: -1 };
  return { output: lines.slice(0, -1).map((line) => `${line}\n`).join(''), exitCode: Number(result[1]) };
}

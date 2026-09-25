import type { CommandProgress } from '@shared/domain/operation';

/**
 * Reads one command's progress from its output, one line at a time: returns the progress after the line (the previous
 * one when the line tells nothing new). `cm` rewrites its progress line with `\r`, so each rewrite arrives as a line.
 */
export type ProgressReader = (previous: CommandProgress | null, line: string) => CommandProgress | null;

/** Feeds every line to the reader, for tests and for commands whose whole output is at hand. */
export function readProgress(reader: ProgressReader, lines: readonly string[]): CommandProgress | null {
  return lines.reduce<CommandProgress | null>(reader, null);
}

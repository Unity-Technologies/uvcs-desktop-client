import type { CommandProgress } from '@shared/domain/operation';
import type { ProgressReader } from '../progressReader';

/** The progress a command's output tells once every line of it came, as a reader fed it line by line reads it. */
export function readProgress(reader: ProgressReader, lines: readonly string[]): CommandProgress | null {
  return lines.reduce<CommandProgress | null>(reader, null);
}

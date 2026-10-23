import type { TextLimit } from './outputLimit';

/**
 * Reads a command's stdout as it arrives, in byte chunks, keeping only the item still arriving: the output is never
 * held whole (`RecordReader` for `--format` records, `XmlElementReader` for the elements of an XML list).
 */
export interface StreamReader {
  read(chunk: Buffer): void;
  /**
   * The text after the last item, which it then forgets: nothing for an output of items alone, what the command printed
   * besides them (an error, a `cm shell`'s `CommandResult` line) otherwise.
   */
  takeRest(): string;
}

/**
 * How a runner reads a command's output (`cmOutputKind`): its stdout streamed into a reader as it arrives (a list), or
 * kept as text within a limit (an answer or an operation).
 */
export type OutputReading = { stream: StreamReader } | { text: TextLimit };

/**
 * The most characters a command's output may have. It is read as one string, and V8 refuses strings longer than
 * 2^29 - 24 characters (about 512 MB: `RangeError: Invalid string length`, thrown where nothing could catch it). Half
 * that leaves room for the copy reading it makes (`replaceAll('\r\n', '\n')`); the largest real answers are tens of MB
 * (every branch of a repository with 20,000 of them).
 */
export const MAX_OUTPUT_LENGTH = 256 * 1024 * 1024;

const MEGABYTE = 1024 * 1024;

/**
 * A command printed more than its output may have (`MAX_OUTPUT_LENGTH`), so it was stopped. `CmClient` reports it as a
 * `CmError`, which names the command.
 */
export class CmOutputTooLargeError extends Error {
  constructor(maxLength: number) {
    super(`The command printed more than ${describeLength(maxLength)}, too much to read, and was stopped.`);
    this.name = 'CmOutputTooLargeError';
  }
}

function describeLength(length: number): string {
  return length >= MEGABYTE ? `${Math.round(length / MEGABYTE)} MB` : `${length} characters`;
}

/** The message of a `cm` failure that printed nothing. */
export const SILENT_FAILURE_MESSAGE = 'The cm command failed.';

export class CmError extends Error {
  constructor(
    message: string,
    readonly commandLine: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = 'CmError';
  }
}

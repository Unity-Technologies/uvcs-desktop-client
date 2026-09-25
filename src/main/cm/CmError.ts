import type { FailedCommand } from '@shared/ipc';

/** The message of a `cm` failure that printed nothing. */
export const SILENT_FAILURE_MESSAGE = 'The cm command failed.';

export class CmError extends Error {
  constructor(
    message: string,
    readonly command: FailedCommand,
  ) {
    super(message);
    this.name = 'CmError';
  }

  /** The same failure explained in other words; the command details are kept for diagnosis. */
  withMessage(message: string): CmError {
    return new CmError(message, this.command);
  }
}

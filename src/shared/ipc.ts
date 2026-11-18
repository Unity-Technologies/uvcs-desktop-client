import type { SignInProblem } from './domain/signIn';

export const INVOKE_CHANNEL = 'uvcs:invoke';
export const EVENT_CHANNEL = 'uvcs:event';

export interface InvokeRequest {
  method: string;
  args: unknown[];
}

export type InvokeResponse =
  | { ok: true; value: unknown }
  | { ok: false; error: RemoteError };

export interface RemoteError {
  message: string;
  /** Set when the error comes from a failed `cm` command. */
  command?: FailedCommand;
  /** Set when the command was refused, or failed, as its server needs a sign-in (`CmSignInError`). */
  signIn?: SignInProblem;
}

export interface FailedCommand {
  commandLine: string;
  exitCode: number;
  /** Everything the command printed (stdout and stderr). */
  output: string;
  /** The command's entry in the command log. */
  logEntryId: number;
}

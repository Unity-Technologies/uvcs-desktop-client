import type { FailedCommand } from '@shared/ipc';
import type { SignInProblem } from '@shared/domain/signIn';
import { CmError } from './CmError';

/**
 * A command refused because its server needs a sign-in: it ran into one (its `command` says what `cm` printed), or it
 * never ran, as the server was known to need one (`SignInGate`). The window shows one sign-in screen for the server
 * instead of this error (docs/features/accounts.md).
 */
export class CmSignInError extends CmError {
  constructor(
    readonly problem: SignInProblem,
    command: FailedCommand,
  ) {
    super(signInMessage(problem.server), command);
    this.name = 'CmSignInError';
  }
}

/** The error's own words, for what shows it anyway (a log, a window with no sign-in screen for the server). */
function signInMessage(server: string): string {
  return `Sign in to ${server} to continue.`;
}

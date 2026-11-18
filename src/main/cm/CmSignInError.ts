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
    super(SIGN_IN_MESSAGE, command);
    this.name = 'CmSignInError';
  }
}

/**
 * The error's own words, for what shows it anyway (Home's lists, an xlinked server's read): naming no server, as `cm`
 * names them (`local`, an organization's id) and the window names them apart (This computer, its name).
 */
const SIGN_IN_MESSAGE = 'Sign in to this server again to continue.';

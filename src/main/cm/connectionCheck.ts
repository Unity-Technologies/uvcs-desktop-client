import type { ConnectionProblem } from '@shared/domain/setup';
import type { SignInProblem, SignInProblemKind } from '@shared/domain/signIn';
import type { CmClient } from './CmClient';
import { CmError } from './CmError';
import { CmStoppedAtPromptError } from './consolePrompts';
import { isSignInPrompt, signInFailureOf } from './signInFailure';

/** Long enough for a slow VPN, short enough not to leave the user waiting on a stuck check. */
const CHECK_TIMEOUT_MS = 10_000;


/** What `cm checkconnection <server>` found: the server answered, needs a sign-in, or couldn't be reached. */
export type ConnectionCheck =
  | { kind: 'reached' }
  | { kind: 'needsSignIn'; problem: SignInProblem }
  | { kind: 'unreachable'; problem: ConnectionProblem };

/**
 * What a failed (or stopped) `cm checkconnection` means: a sign-in problem (`signInFailureOf`, or a prompt it was
 * stopped at), or null for a connection problem. Never loose words: a secure connection that fails says
 * "Authentication failed because the remote party has closed the transport stream", a proxy asks for its own
 * credentials, and a false sign-in would cover every window on the server.
 */
export function classifyConnectionCheck(output: string, stoppedAt?: string): SignInProblemKind | null {
  return signInFailureOf(output) ?? (stoppedAt !== undefined && isSignInPrompt(stoppedAt) ? 'signInRequired' : null);
}

/**
 * Runs `cm checkconnection <server>`. A missing sign-in makes `cm` prompt forever, so the check is killed as soon as it
 * asks, or after a timeout. Its command goes through `CmClient`'s sign-in gate (`SignInGate.passes`): it is how a
 * server needing a sign-in is found, and found again signed in.
 */
export async function checkConnection(cm: CmClient, server: string): Promise<ConnectionCheck> {
  const args = ['checkconnection', server];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const lines: string[] = [];
  const onOutputLine = (line: string): void => {
    lines.push(line);
    if (isSignInPrompt(line)) controller.abort();
  };
  const failed = (output: string, stoppedAt?: string): ConnectionCheck => {
    const commandLine = `cm ${args.join(' ')}`;
    const kind = classifyConnectionCheck(output, stoppedAt);
    if (kind) return { kind: 'needsSignIn', problem: { kind, server, details: { commandLine, output } } };
    return { kind: 'unreachable', problem: { server, commandLine, output: output || `No answer after ${CHECK_TIMEOUT_MS / 1000} seconds.` } };
  };

  try {
    await cm.execute(args, { signal: controller.signal, killSignal: 'SIGKILL', onOutputLine, server });
    return { kind: 'reached' };
  } catch (error) {
    if (error instanceof CmStoppedAtPromptError) return failed(error.command.output, error.prompt);
    if (error instanceof CmError) return failed(error.command.output);
    if (controller.signal.aborted) return failed(stoppedOutput(lines));
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** What a check stopped at a prompt or by the timeout printed; a stopped prompt pads its lines with long runs of spaces. */
function stoppedOutput(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

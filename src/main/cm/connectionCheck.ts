import type { ConnectionProblem, ConnectionProblemKind } from '@shared/domain/setup';
import type { CmClient } from './CmClient';
import { CmError } from './CmError';

/** Long enough for a slow VPN, short enough not to leave the user waiting on a stuck check. */
const CHECK_TIMEOUT_MS = 10_000;

/** `cm` asks for a sign-in method or credentials instead of failing. */
const SIGN_IN_PROMPT = /sign in to:|select your system|^\s*(user|password):/im;
const REJECTED_CREDENTIALS = /credentials|not authenticated|authentication failed|invalid user|password is not valid/i;

/** What a failed (or stopped) `cm checkconnection` means: a sign-in problem, or else a connection problem. */
export function classifyConnectionCheck(output: string): ConnectionProblemKind {
  return SIGN_IN_PROMPT.test(output) || REJECTED_CREDENTIALS.test(output) ? 'notSignedIn' : 'serverUnreachable';
}

/**
 * Runs `cm checkconnection <server>`; null when the server answers. A missing sign-in makes `cm` prompt forever, so the
 * check is killed as soon as it asks, or after a timeout.
 */
export async function checkConnection(cm: CmClient, server: string): Promise<ConnectionProblem | null> {
  const args = ['checkconnection', server];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const lines: string[] = [];
  const onOutputLine = (line: string): void => {
    lines.push(line);
    if (SIGN_IN_PROMPT.test(line)) controller.abort();
  };
  const problem = (output: string): ConnectionProblem => ({
    kind: classifyConnectionCheck(output),
    server,
    commandLine: `cm ${args.join(' ')}`,
    output: output || `No answer after ${CHECK_TIMEOUT_MS / 1000} seconds.`,
  });

  try {
    await cm.execute(args, { signal: controller.signal, killSignal: 'SIGKILL', onOutputLine });
    return null;
  } catch (error) {
    if (error instanceof CmError) return problem(error.command.output);
    if (controller.signal.aborted) return problem(stoppedOutput(lines));
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

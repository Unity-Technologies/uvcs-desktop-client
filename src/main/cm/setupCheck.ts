import type { SetupProblem, SetupProblemKind } from '@shared/domain/setup';
import type { CmClient } from './CmClient';
import { CmError } from './CmError';

const CHECK_ARGS = ['checkconnection'];
/** Long enough for a slow VPN, short enough not to leave the user staring at a stuck check. */
const CHECK_TIMEOUT_MS = 10_000;

const NOT_CONFIGURED = /not correctly configured|client\.conf not found/i;
/** `cm` asks for a sign-in method or credentials instead of failing. */
const SIGN_IN_PROMPT = /sign in to:|select your system|^\s*(user|password):/im;
const REJECTED_CREDENTIALS = /credentials|not authenticated|authentication failed|invalid user|password is not valid/i;
const SIGN_IN_SERVER = /sign in to:\s*(\S+)/i;

/** What a failed (or stopped) `cm checkconnection` means. Anything but a setup or sign-in problem is taken as a connection problem. */
export function classifySetupCheck(output: string): SetupProblemKind {
  if (NOT_CONFIGURED.test(output)) return 'notConfigured';
  if (SIGN_IN_PROMPT.test(output) || REJECTED_CREDENTIALS.test(output)) return 'notSignedIn';
  return 'serverUnreachable';
}

export function signInServer(output: string): string | undefined {
  return SIGN_IN_SERVER.exec(output)?.[1];
}

/**
 * Runs `cm checkconnection` against the default server. A missing sign-in makes `cm` prompt
 * forever, so the check is killed as soon as it asks, or after a timeout.
 */
export async function checkSetup(cm: CmClient): Promise<SetupProblem | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const lines: string[] = [];
  const onOutputLine = (line: string): void => {
    lines.push(line);
    if (SIGN_IN_PROMPT.test(line)) controller.abort();
  };

  try {
    await cm.execute(CHECK_ARGS, { signal: controller.signal, killSignal: 'SIGKILL', onOutputLine });
    return null;
  } catch (error) {
    const stopped = controller.signal.aborted;
    if (!(error instanceof CmError) && !stopped) throw error;

    // A stopped prompt pads its lines with long runs of spaces.
    const output =
      error instanceof CmError
        ? error.command.output
        : lines
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n');
    return {
      kind: classifySetupCheck(output),
      server: signInServer(output),
      commandLine: `cm ${CHECK_ARGS.join(' ')}`,
      output: output || `No answer after ${CHECK_TIMEOUT_MS / 1000} seconds.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

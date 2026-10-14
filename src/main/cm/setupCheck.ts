import type { SetupProblem } from '@shared/domain/setup';
import type { CmClient } from './CmClient';
import { CmError } from './CmError';

/**
 * A local command that needs a configuration: without one, every command but `version`, `location`, `configure` and
 * `help` fails before doing anything, saying so. Checking with a local command means the check never waits on a server.
 */
const CHECK_ARGS = ['profile', 'list'];

const NOT_CONFIGURED = /not correctly configured|client\.conf not found/i;

/**
 * Whether `cm` has a configuration; null when it has. Another failure is no setup problem: the views say what failed.
 * Its own process: `cm shell` refuses to start until `cm` is configured.
 */
export async function checkSetup(cm: CmClient): Promise<SetupProblem | null> {
  try {
    await cm.execute(CHECK_ARGS);
    return null;
  } catch (error) {
    if (!(error instanceof CmError)) throw error;
    const { output } = error.command;
    return NOT_CONFIGURED.test(output) ? { commandLine: `cm ${CHECK_ARGS.join(' ')}`, output } : null;
  }
}

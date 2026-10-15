import type { SetupProblem } from '@shared/domain/setup';
import { CmError } from './CmError';
import type { ProfileList } from './ProfileList';

/**
 * The check is `cm profile list`, a local command that needs a configuration: without one, every command but `version`,
 * `location`, `configure` and `help` fails before doing anything, saying so. A local command never waits on a server.
 */
const CHECK_COMMAND_LINE = 'cm profile list';

const NOT_CONFIGURED = /not correctly configured|client\.conf not found/i;

/**
 * Whether `cm` has a configuration; null when it has. Another failure is no setup problem: the views say what failed.
 * It shares the profiles read the accounts and the servers make at launch (`ProfileList`), so it costs no command of its
 * own. Unconfigured, that read runs as a process: `cm shell` refuses to start, so no session is ever ready for it.
 */
export async function checkSetup(profiles: Pick<ProfileList, 'readable'>): Promise<SetupProblem | null> {
  try {
    await profiles.readable();
    return null;
  } catch (error) {
    if (!(error instanceof CmError)) throw error;
    const { output } = error.command;
    return NOT_CONFIGURED.test(output) ? { commandLine: CHECK_COMMAND_LINE, output } : null;
  }
}

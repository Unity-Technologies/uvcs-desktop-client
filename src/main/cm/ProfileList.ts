import { ACCOUNT_FORMAT } from './accounts';
import type { CmClient } from './CmClient';

const PROFILE_LIST_ARGS = ['profile', 'list', `--format=${ACCOUNT_FORMAT}`];

/**
 * `cm profile list`, the one read the accounts, the servers and the setup check share: they all ask at launch, and one
 * command answers everyone who asks while it runs. A local command that answers the same in any directory, so it runs
 * in a workspace's `cm shell`s when a window shows one (`anyDirectory`), starting none in the home folder.
 */
export class ProfileList {
  private reading: Promise<string> | null = null;
  private readOnce = false;

  constructor(private readonly cm: Pick<CmClient, 'query'>) {}

  /** The profiles as `cm` prints them in `ACCOUNT_FORMAT` (`parseAccounts`); a read running already answers. */
  read(): Promise<string> {
    this.reading ??= this.cm.query(PROFILE_LIST_ARGS, { anyDirectory: true }).then(
      (output) => {
        this.reading = null;
        this.readOnce = true;
        return output;
      },
      (error: unknown) => {
        this.reading = null;
        throw error;
      },
    );
    return this.reading;
  }

  /**
   * Settles once `cm` read the profiles, now or before: `cm` reads none until it has a configuration (`checkSetup`), so
   * a read that succeeded once tells for the rest of the session, with no command.
   */
  async readable(): Promise<void> {
    if (!this.readOnce) await this.read();
  }
}

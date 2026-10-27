import type { Account } from '@shared/domain/account';
import { ACCOUNT_FORMAT, readAccount } from './accounts';
import type { CmClient } from './CmClient';

const PROFILE_LIST_ARGS = ['profile', 'list', `--format=${ACCOUNT_FORMAT}`];

/**
 * `cm profile list`, the one read the accounts, the servers and the setup check share: they all ask at launch, and one
 * command answers everyone who asks while it runs. A local command that answers the same in any directory, so it runs
 * in a workspace's `cm shell`s when a window shows one (`anyDirectory`), starting none in the home folder.
 */
export class ProfileList {
  private reading: Promise<Account[]> | null = null;
  private readOnce = false;

  constructor(private readonly cm: Pick<CmClient, 'queryRecords'>) {}

  /** The profiles (`readAccount`); a read running already answers. */
  read(): Promise<Account[]> {
    if (this.reading) return this.reading;
    const reading = this.cm.queryRecords(PROFILE_LIST_ARGS, readAccount, { anyDirectory: true }).then(
      (accounts) => {
        this.readOnce = true;
        return accounts;
      },
    );
    this.reading = reading;
    // Only this read's own end lets it go: one forgotten (`forget`) may end after a newer one started.
    const letGo = () => {
      if (this.reading === reading) this.reading = null;
    };
    reading.then(letGo, letGo);
    return reading;
  }

  /** A write changed the profiles (`profile delete`): a read that started before it answers no one after it. */
  forget(): void {
    this.reading = null;
  }

  /**
   * Settles once `cm` read the profiles, now or before: `cm` reads none until it has a configuration (`checkSetup`), so
   * a read that succeeded once tells for the rest of the session, with no command.
   */
  async readable(): Promise<void> {
    if (!this.readOnce) await this.read();
  }
}

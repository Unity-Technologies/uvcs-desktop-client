import type { Account } from '@shared/domain/account';
import { recordFormat, type ReadRecord } from './formatRecords';

/** `cm profile list` fields for `readAccount`; the security config (tokens, encrypted passwords) is never read. */
export const ACCOUNT_FORMAT = recordFormat(['name', 'server', 'user', 'workingmode']);

/** One profile of `ACCOUNT_FORMAT`; none without a name. */
export const readAccount: ReadRecord<Account> = ([name = '', server = '', user = '', workingMode = '']) =>
  name ? { name, server, user, workingMode } : undefined;

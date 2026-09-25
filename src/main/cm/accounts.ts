import type { Account } from '@shared/domain/account';
import { parseRecords, recordFormat } from './formatRecords';

/** `cm profile list` fields for `parseAccounts`; the security config (tokens, encrypted passwords) is never read. */
export const ACCOUNT_FORMAT = recordFormat(['name', 'server', 'user', 'workingmode']);

export function parseAccounts(output: string): Account[] {
  return parseRecords(output)
    .map(([name = '', server = '', user = '', workingMode = '']) => ({ name, server, user, workingMode }))
    .filter((account) => account.name);
}

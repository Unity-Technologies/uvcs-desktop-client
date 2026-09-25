import type { AccountsApi } from '@shared/api/accounts';
import { ACCOUNT_FORMAT, parseAccounts } from '../cm/accounts';
import type { ServiceContext } from './ServiceContext';

export function createAccountsService({ cm }: ServiceContext): AccountsApi {
  return {
    list: async () => parseAccounts(await cm.query(['profile', 'list', `--format=${ACCOUNT_FORMAT}`])),
    remove: async (name) => {
      await cm.query(['profile', 'delete', `--name=${name}`]);
    },
  };
}

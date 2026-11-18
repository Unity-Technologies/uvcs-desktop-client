import type { AccountsApi } from '@shared/api/accounts';
import { userAccountsOf } from '../cm/userAccounts';
import type { ProfilesContext, ServiceContext } from './ServiceContext';

export function createAccountsService({ cm }: ServiceContext, { profiles }: ProfilesContext): AccountsApi {
  return {
    list: () => profiles.read(),
    accounts: async () => userAccountsOf(await profiles.read()),
    remove: async (name) => {
      try {
        await cm.query(['profile', 'delete', `--name=${name}`], { anyDirectory: true });
      } finally {
        profiles.forget();
      }
    },
  };
}

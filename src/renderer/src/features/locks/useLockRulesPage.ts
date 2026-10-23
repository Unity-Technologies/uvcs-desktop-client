import { useMemo } from 'react';
import { useServerAccount } from '../../app/account/accounts';
import { usePlaceServer } from '../../app/workspace/useWorkspace';
import { lockRulesPage, type LockRulesPage } from './lockRulesPage';

/** The lock rules page of the place's server (`lockRulesPage`), from what the window already read: no `cm` command. */
export function useLockRulesPage(): LockRulesPage | null {
  const server = usePlaceServer();
  const account = useServerAccount(server)?.account;
  return useMemo(() => (server ? lockRulesPage(server, account) : null), [server, account]);
}

import { useMemo } from 'react';
import { useServerAccount } from '../../app/account/accounts';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { lockRulesPage, type LockRulesPage } from './lockRulesPage';

/** The lock rules page of the workspace's server (`lockRulesPage`), from what the window already read: no `cm` command. */
export function useLockRulesPage(): LockRulesPage | null {
  const server = useWorkspaceInfo().data?.server;
  const account = useServerAccount(server)?.account;
  return useMemo(() => (server ? lockRulesPage(server, account) : null), [server, account]);
}

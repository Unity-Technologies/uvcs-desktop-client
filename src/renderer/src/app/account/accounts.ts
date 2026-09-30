import { queryOptions, useQuery } from '@tanstack/react-query';
import type { Account } from '@shared/domain/account';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { describeServer } from '../../lib/servers';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';
import { queryClient } from '../queryClient';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { accountForServer } from './serverAccount';

/** Refreshed when the window regains focus after a minute: signing in with the official client adds or changes one. */
const accountsQuery = queryOptions({ queryKey: queryKeys.accounts, queryFn: () => api.accounts.list(), staleTime: 60_000 });

/** The user `cm` signs in as where no account is set up (client.conf's default user); it changes only by hand. */
const defaultUserQuery = queryOptions({ queryKey: queryKeys.user, queryFn: () => api.system.currentUser(), staleTime: Infinity });

export function useAccounts() {
  return useQuery(accountsQuery);
}

/**
 * Who you are on `server`: its profile when there is one; otherwise `cm` signs in as the default user of
 * client.conf, which is what `cm whoami` shows.
 */
export function useServerAccount(server: string | undefined): { user: string; account?: Account } | undefined {
  const { data: accounts } = useAccounts();
  const account = server && accounts ? accountForServer(accounts, server) : undefined;
  const { data: defaultUser } = useQuery({ ...defaultUserQuery, enabled: Boolean(server && accounts && !account) });
  if (account) return { user: account.user, account };
  return defaultUser ? { user: defaultUser } : undefined;
}

/** Who you are on the workspace's server (`useServerAccount`); undefined while it's read. */
export function useWorkspaceUser(): string | undefined {
  return useServerAccount(useWorkspaceInfo().data?.server)?.user;
}

/** Who you are on `server`, like `useServerAccount`, for code outside components (from the same cached queries). */
export async function readServerUser(server: string): Promise<string> {
  const accounts = await queryClient.fetchQuery(accountsQuery);
  const account = accountForServer(accounts, server);
  if (account) return account.user;
  return queryClient.fetchQuery(defaultUserQuery);
}

export async function removeAccount(account: Account): Promise<void> {
  const { label } = describeServer(account.server);
  const confirmed = await confirm({
    title: `Remove the account on ${label}?`,
    message: `cm forgets how to sign in to ${account.server} as ${account.user}. Sign in again with the Unity Version Control app to use it.`,
    confirmLabel: 'Remove account',
    danger: true,
  });
  if (!confirmed) return;

  try {
    await api.accounts.remove(account.name);
  } catch (error) {
    toast.error("Couldn't remove the account", error);
  } finally {
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    void queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
  }
}

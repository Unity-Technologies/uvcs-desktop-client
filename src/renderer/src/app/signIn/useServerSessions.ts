import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServerSession } from '@shared/domain/signIn';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { useSession } from '../workspace/sessionStore';
import { offerRefusedAgain } from './refusedOperation';
import { useCommandLogStore } from '../shell/commandLogStore';
import { failedForSignInEntries, failedForSignInTo, signedInAgain } from './windowSignIn';

/** The servers that need a sign-in, app-wide: read once, then kept by main's `serverSessionsChanged`. */
const serverSessionsQuery = queryOptions({ queryKey: queryKeys.serverSessions, queryFn: () => api.accounts.sessions(), staleTime: Infinity });

export function useServerSessions() {
  return useQuery(serverSessionsQuery);
}

/**
 * Follows main's sign-in state (one per server, `ServerSessions`). A server signed in again reads once more what failed
 * for its sign-in in this window (their commands no failure to point at anymore), and offers the operation it refused
 * (`offerRefusedAgain`). Used once, by the app.
 */
export function useServerSessionsFromMain(): void {
  const client = useQueryClient();
  useUvcsEvent('serverSessionsChanged', (sessions) => {
    const before = client.getQueryData<ServerSession[]>(queryKeys.serverSessions) ?? [];
    client.setQueryData(queryKeys.serverSessions, sessions);
    for (const server of signedInAgain(before, sessions)) {
      failedForSignInEntries(client.getQueryCache().getAll(), server).forEach(useCommandLogStore.getState().markHandled);
      void client.invalidateQueries({ predicate: failedForSignInTo(server) });
      offerRefusedAgain(server, useSession.getState().place);
    }
  });
}

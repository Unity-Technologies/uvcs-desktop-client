import type { UserAccount } from '@shared/domain/account';

/** A Unity account as `api.accounts.accounts` answers it: `user`'s organizations, and its `*@cloud` profile if `wildcard`. */
export function unityAccount(user: string, servers: string[], { wildcard = false } = {}): UserAccount {
  return {
    id: `cloud:${user.toLowerCase()}`,
    user,
    kind: 'cloud',
    workingMode: 'SSOWorkingMode',
    servers,
    profiles: [...(wildcard ? ['*@cloud'] : []), ...servers].map((server) => ({ name: server, server, user, workingMode: 'SSOWorkingMode' })),
  };
}

/** A server's account, signing in with a user and password. */
export function serverAccount(server: string, user = 'jsmith'): UserAccount {
  return { id: `server:${server}`, user, kind: 'server', workingMode: 'UPWorkingMode', servers: [server], profiles: [{ name: server, server, user, workingMode: 'UPWorkingMode' }] };
}

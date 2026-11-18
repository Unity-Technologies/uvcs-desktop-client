import type { Account, UserAccount } from './account';
import { serverKind } from './organizations';

/** `*@cloud`: the profile `cm` signs in to every cloud organization with when the organization has none of its own. */
const WILDCARD_SERVER = /^\*@/;

/**
 * The accounts the profiles make (docs/features/accounts.md "Accounts"): every cloud profile of one user, whatever
 * the case of its email, is one Unity account, its `*@cloud` profile included (which makes an account even with no
 * organization of its own); each server's profile is an account of its own; `local`, this computer, belongs to none.
 * Unity accounts first, by user, then the servers' by server.
 */
export function userAccountsOf(profiles: readonly Account[]): UserAccount[] {
  const accounts = new Map<string, UserAccount>();
  for (const profile of profiles) {
    const kind = accountKindOf(profile.server);
    if (!kind) continue;
    const id = kind === 'cloud' ? `cloud:${profile.user.toLowerCase()}` : `server:${profile.server}`;
    const account = accounts.get(id) ?? { id, user: profile.user, kind, workingMode: profile.workingMode, servers: [], profiles: [] };
    account.profiles.push(profile);
    if (!WILDCARD_SERVER.test(profile.server) && !account.servers.includes(profile.server)) account.servers.push(profile.server);
    accounts.set(id, account);
  }
  return [...accounts.values()].sort(byKindThenName);
}

function accountKindOf(server: string): UserAccount['kind'] | undefined {
  if (!server) return undefined;
  if (WILDCARD_SERVER.test(server)) return 'cloud';
  const kind = serverKind(server);
  if (kind === 'local') return undefined;
  return kind === 'server' ? 'server' : 'cloud';
}

function byKindThenName(a: UserAccount, b: UserAccount): number {
  if (a.kind !== b.kind) return a.kind === 'cloud' ? -1 : 1;
  const name = (account: UserAccount) => (account.kind === 'cloud' ? account.user : account.servers[0] ?? '');
  return name(a).localeCompare(name(b), undefined, { sensitivity: 'base' });
}

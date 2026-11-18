import type { UserAccount } from '@shared/domain/account';
import { isCloudServer } from '../../lib/servers';

const sameServer = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** The Unity accounts, which the home screen switches between; a server's account is listed under every one. */
export function unityAccountsOf(accounts: readonly UserAccount[]): UserAccount[] {
  return accounts.filter((account) => account.kind === 'cloud');
}

/**
 * The account `cm` signs in to `server` with: the one listing it, else, for a cloud organization no account lists,
 * the Unity account whose `*@cloud` profile signs in to every organization without one of its own.
 */
export function accountOfServer(accounts: readonly UserAccount[], server: string): UserAccount | undefined {
  const listing = accounts.find((account) => account.servers.some((listed) => sameServer(listed, server)));
  if (listing || !isCloudServer(server)) return listing;
  return accounts.find((account) => account.profiles.some((profile) => profile.server.startsWith('*@')));
}

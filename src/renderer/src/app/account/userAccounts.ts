import type { UserAccount } from '@shared/domain/account';
import { accountForServer } from './serverAccount';

/** The Unity accounts, which the home screen switches between; a server's account is listed under every one. */
export function unityAccountsOf(accounts: readonly UserAccount[]): UserAccount[] {
  return accounts.filter((account) => account.kind === 'cloud');
}

/**
 * The account `cm` signs in to `server` with: the one holding the profile `accountForServer` resolves, so every place
 * agrees on it (an organization by its name or its genesis id, on `@cloud` or `@unity`; else the `*@cloud` profile).
 */
export function accountOfServer(accounts: readonly UserAccount[], server: string): UserAccount | undefined {
  const profile = accountForServer(
    accounts.flatMap((account) => account.profiles),
    server,
  );
  return profile && accounts.find((account) => account.profiles.includes(profile));
}

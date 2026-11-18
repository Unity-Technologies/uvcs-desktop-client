import type { Account, UserAccount } from '../domain/account';

export interface AccountsApi {
  /** Every connection profile, including wildcard ones such as `*@cloud`. */
  list(): Promise<Account[]>;
  /** The accounts those profiles make (`userAccountsOf`), from the same read: a Unity account per user, one per server. */
  accounts(): Promise<UserAccount[]>;
  /** Deletes a connection profile: `cm` falls back to `*@cloud` or the default user, or asks to sign in again. */
  remove(name: string): Promise<void>;
}

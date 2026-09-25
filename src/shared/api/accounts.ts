import type { Account } from '../domain/account';

export interface AccountsApi {
  /** Every connection profile, including wildcard ones such as `*@cloud`. */
  list(): Promise<Account[]>;
  /** Deletes a connection profile: `cm` falls back to `*@cloud` or the default user, or asks to sign in again. */
  remove(name: string): Promise<void>;
}

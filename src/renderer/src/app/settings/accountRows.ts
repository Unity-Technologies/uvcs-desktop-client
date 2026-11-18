import type { Account, UserAccount } from '@shared/domain/account';
import { describeServer } from '../../lib/servers';
import { pluralize } from '../../lib/text';
import { signInMethod } from '../account/serverAccount';
import { accountOfServer } from '../account/userAccounts';

/** A place an account signs in to, in Settings › Accounts: removed one at a time (`cm profile delete`). */
export interface AccountRowServer {
  /** The profile it is, removed by its name. */
  profile: Account;
  /** As the home sidebar names it: `acme`, `build:8087`, "Any cloud organization" for `*@cloud`. */
  label: string;
}

/** An account's row in Settings › Accounts. */
export interface AccountRow {
  account: UserAccount;
  /** Under the user: "Unity · 3 organizations", "build:8087 · User and password". */
  detail: string;
  /** It signs in to the server of the window's place: first, and marked. */
  inUse: boolean;
  /** What the row lists once expanded: its organizations by name, then `*@cloud`; a server's one server. */
  servers: AccountRowServer[];
  /** A Unity account's row opens to its organizations, each removed apart; a server's removes its one server itself. */
  expands: boolean;
}

/**
 * Settings › Accounts' rows, one per account (docs/features/accounts.md "Settings"): the one signing in to the
 * window's place first, then the others in their order, Unity accounts before servers'.
 */
export function accountRowsOf(accounts: readonly UserAccount[], placeServer: string | undefined): AccountRow[] {
  const inUse = placeServer ? accountOfServer(accounts, placeServer) : undefined;
  const rows = accounts.map((account) => ({ account, detail: accountDetail(account), inUse: account === inUse, servers: rowServers(account), expands: account.kind === 'cloud' }));
  return [...rows.filter((row) => row.inUse), ...rows.filter((row) => !row.inUse)];
}

function accountDetail(account: UserAccount): string {
  if (account.kind === 'server') return `${describeServer(account.servers[0] ?? '').label} · ${signInMethod(account.workingMode)}`;
  return account.servers.length > 0 ? `Unity · ${pluralize(account.servers.length, 'organization')}` : 'Unity';
}

function rowServers(account: UserAccount): AccountRowServer[] {
  const servers = account.profiles.map((profile) => ({ profile, label: describeServer(profile.server).label }));
  const isWildcard = (server: AccountRowServer) => server.profile.server.startsWith('*@');
  return servers.sort((a, b) => Number(isWildcard(a)) - Number(isWildcard(b)) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

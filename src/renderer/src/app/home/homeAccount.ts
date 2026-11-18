import type { UserAccount } from '@shared/domain/account';
import type { ServerProfile } from '@shared/domain/repository';
import { isCloudServer } from '../../lib/servers';
import { accountOfServer, unityAccountsOf } from '../account/userAccounts';
import { WELCOME, type HomeSection } from './homeSection';

/** What decides which Unity account the home sidebar shows, the first that names one winning. */
export interface HomeAccountCues {
  /** The server whose repositories the home screen shows (a link may open one of another account). */
  shownServer?: string;
  /** The account picked in this window's switcher, since it came to the home screen. */
  picked?: string;
  /** The server of the workspace this window left for the home screen. */
  openedFrom?: string;
  /** The account last picked in any window (`AppSettings.homeAccount`). */
  remembered?: string;
}

/**
 * The Unity account whose organizations the home sidebar lists (docs/features/accounts.md "Home"): the one holding
 * the repositories shown, the one picked here, the workspace's this window left, the one last picked, else the main one
 * (`mainAccountOf`). None without a Unity account.
 */
export function homeAccountOf(accounts: readonly UserAccount[], cues: HomeAccountCues): UserAccount | undefined {
  const unity = unityAccountsOf(accounts);
  const byServer = (server: string | undefined) => (server ? accountOfServer(unity, server) : undefined);
  const byId = (id: string | undefined) => (id ? unity.find((account) => account.id === id) : undefined);
  return byServer(cues.shownServer) ?? byId(cues.picked) ?? byServer(cues.openedFrom) ?? byId(cues.remembered) ?? mainAccountOf(unity);
}

/**
 * The account a home screen shows when nothing names one: the one `cm` signs in to every other organization with
 * (`*@cloud`), else the one holding the most organizations, the first of them on a tie. Not the first by name: an
 * email account with one organization would come before the work account with twenty.
 */
function mainAccountOf(unity: readonly UserAccount[]): UserAccount | undefined {
  const wildcard = unity.find((account) => account.profiles.some((profile) => profile.server.startsWith('*@')));
  return wildcard ?? unity.reduce<UserAccount | undefined>((most, account) => (most && most.servers.length >= account.servers.length ? most : account), undefined);
}

const LOCAL: ServerProfile = { server: 'local', user: '', workingMode: '' };

/**
 * The servers the home sidebar lists under `shown`: this computer, the shown account's organizations, and every
 * server's account, each with its user. Without a Unity account, this computer and the servers.
 */
export function homeServersOf(accounts: readonly UserAccount[], shown: UserAccount | undefined): ServerProfile[] {
  const listed = accounts.filter((account) => account === shown || account.kind === 'server');
  return [LOCAL, ...listed.flatMap(({ servers, user, workingMode }) => servers.map((server) => ({ server, user, workingMode })))];
}

/**
 * Where the home screen stays once it shows `account`: on the repositories on screen while they are this computer's,
 * a server's (listed under every account) or `account`'s own, as `accountOfServer` resolves them (by name or genesis
 * id, whatever the case, or through `*@cloud`); else back on its welcome, as they belong to the account left.
 */
export function sectionAfterSwitch(section: HomeSection, account: UserAccount, accounts: readonly UserAccount[]): HomeSection {
  if (section.kind !== 'server' || !isCloudServer(section.server)) return section;
  return accountOfServer(unityAccountsOf(accounts), section.server) === account ? section : WELCOME;
}

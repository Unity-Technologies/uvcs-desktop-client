import { useQuery } from '@tanstack/react-query';
import type { UserAccount } from '@shared/domain/account';
import { useUserAccounts } from '../account/accounts';
import { useSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import { homeAccountOf } from './homeAccount';
import { useHomeAccountPick } from './homeAccountStore';
import { useHomeSection } from './homeSectionStore';

const NO_ACCOUNTS: UserAccount[] = [];

/** The accounts, and the Unity one the home sidebar shows (`homeAccountOf`); `reading` until the accounts are read. */
export function useHomeAccount(): { accounts: UserAccount[]; shown: UserAccount | undefined; reading: boolean } {
  const { data: accounts = NO_ACCOUNTS, isPending } = useUserAccounts();
  const section = useHomeSection((state) => state.section);
  const picked = useHomeAccountPick((state) => state.picked);
  const remembered = useSettings().homeAccount;
  const openedFrom = useLeftWorkspaceServer();
  const shown = homeAccountOf(accounts, { shownServer: section.kind === 'server' ? section.server : undefined, picked, openedFrom, remembered });
  return { accounts, shown, reading: isPending };
}

/**
 * The server of the workspace this window left for the home screen, as the window read it while it showed the
 * workspace; never read for this (`enabled: false`), so none once that read is gone.
 */
function useLeftWorkspaceServer(): string | undefined {
  const left = useSession((state) => state.leftWorkspacePath);
  const { data } = useQuery({ ...workspaceInfoQuery(left ?? ''), enabled: false });
  return left ? data?.server : undefined;
}

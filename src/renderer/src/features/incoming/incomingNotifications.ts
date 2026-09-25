import type { IncomingSummary } from '@shared/domain/incoming';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { navigation } from '../../app/navigation/navigationStore';
import { queryClient } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { incomingNotificationMessage } from './incomingNotificationMessage';

/**
 * Someone checked in to the loaded branch (not from this workspace: that moves the loaded changeset too): with the setting on and the window in the background, an OS
 * notification says who and what. Best effort: a failure here is not worth interrupting anyone for.
 */
export async function notifyIncoming(workspacePath: string, before: IncomingSummary, after: IncomingSummary): Promise<void> {
  if (!after.branch || after.headChangeset <= before.headChangeset || document.hasFocus()) return;
  try {
    const settings = await queryClient.fetchQuery({ queryKey: queryKeys.settings, queryFn: () => api.settings.get(), staleTime: Infinity });
    if (!settings.notifyOnIncoming) return;

    const newest = await api.changesets.get(workspacePath, after.headChangeset);
    await api.system.notifyIncoming(workspacePath, incomingNotificationMessage(newest, after.branch, after.changesetCount - before.changesetCount));
  } catch {
    // Nothing to report: the incoming chip shows the new changesets anyway.
  }
}

/** Clicking an incoming notification for the open workspace opens Incoming. */
export function useIncomingNotificationClicks(): void {
  const workspacePath = useWorkspacePath();
  useUvcsEvent('incomingNotificationClicked', (clicked) => {
    if (clicked.workspacePath === workspacePath) navigation.goToView('incoming');
  });
}

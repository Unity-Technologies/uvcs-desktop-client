import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { parentDirectory } from '../../../lib/paths';
import { toast } from '../../../ui/toast/toastStore';
import { queryClient } from '../../queryClient';
import { forgetRecentWorkspace } from '../../settings/useSettings';
import { useSession } from '../sessionStore';

/**
 * Asks where a moved workspace went and opens it there. `cm` re-registers a moved workspace at its new
 * place as soon as it runs inside it (`cm workspace move` can't: it moves a workspace whose folder still exists).
 */
export async function locateWorkspace(name: string, missingPath: string, open: (path: string) => void): Promise<void> {
  const directory = await api.system.pickDirectory(`Where is “${name}” now?`, parentDirectory(missingPath));
  if (!directory) return;

  const root = await api.workspaces.findRoot(directory);
  if (!root) {
    toast.error("That folder isn't a workspace", `Choose the folder “${name}” was moved to.`);
    return;
  }
  await forgetRecentWorkspace(missingPath);
  void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  open(root);
}

/** Forgets a workspace whose folder is gone. `cm` already leaves it out of its workspace list. */
export async function forgetMissingWorkspace(missingPath: string): Promise<void> {
  await forgetRecentWorkspace(missingPath);
  useSession.getState().closeWorkspace();
}

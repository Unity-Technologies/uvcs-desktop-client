import { startingPageIn, startingSeedIn, startingWorkspaceIn } from '@shared/startingWorkspace';
import { useNavigation } from '../navigation/navigationStore';
import { queryClient } from '../queryClient';
import { useSession } from '../workspace/sessionStore';
import { folderMissingQuery } from '../workspace/useWorkspace';
import { asMovablePage } from './movablePages';
import { plantPageSeed } from './pageSeeds';
import { usePageWindow } from './pageWindowStore';

type AddressPage = { location: Pick<Location, 'search'> };

/**
 * Starts a page window (`windows.openPage`) on the page its address names, in its workspace, before the first render,
 * with what its page shows as its window had read it (`plantPageSeed`).
 * Its address keeps them, so a reload shows the page again. False for any other window, which starts as before
 * (`openWorkspaceFromAddress`). Its workspace window showed the workspace a moment ago: its folder is there.
 */
export function openPageWindowFromAddress(page: AddressPage = window): boolean {
  const workspacePath = startingWorkspaceIn(page.location.search);
  const shown = startingPageIn(page.location.search);
  const movable = shown && asMovablePage(shown);
  if (!workspacePath || !movable) return false;
  queryClient.setQueryData(folderMissingQuery(workspacePath).queryKey, false);
  const seed = startingSeedIn(page.location.search);
  if (seed) plantPageSeed(workspacePath, seed);
  useSession.getState().openWorkspace(workspacePath);
  useNavigation.setState({ pages: [movable] });
  usePageWindow.setState({ isPageWindow: true });
  return true;
}

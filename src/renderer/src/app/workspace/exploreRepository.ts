import { repositoryPlace, samePlace } from '@shared/domain/place';
import { api } from '../../api/client';
import { navigation } from '../navigation/navigationStore';
import { firstViewOf } from '../navigation/views';
import { useSession } from './sessionStore';
import type { WorkspaceWindowChoice } from './workspaceWindowChoice';

/**
 * Explores a repository without a workspace (docs/features/explore-repository.md), here or in a new window beside
 * this one (Shift, `windowAskedBy`), as a workspace opens.
 */
export function exploreRepository(repository: string, where: WorkspaceWindowChoice): void {
  if (where === 'newWindow') void api.windows.openPlace(repositoryPlace(repository));
  else void exploreHere(repository);
}

/**
 * Explores the repository in this window, on its first view (`firstViewOf`): the window already exploring it comes
 * forward instead, as one window shows each place. Exploring it here again keeps the view.
 */
export async function exploreHere(repository: string): Promise<void> {
  const place = repositoryPlace(repository);
  if (await api.windows.focusPlace(place)) return;
  const shown = useSession.getState().place;
  if (!shown || !samePlace(shown, place)) navigation.goToView(firstViewOf(place));
  useSession.getState().explore(repository);
}

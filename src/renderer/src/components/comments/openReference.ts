import type { Place } from '@shared/domain/place';
import { openLink } from '../../app/links/openLink';
import { repositoryLinkTo } from '../../app/links/linkTo';
import type { LinkTarget } from '../../app/links/linkNavigation';
import { queryClient } from '../../app/queryClient';
import { workspaceInfoQuery } from '../../app/workspace/useWorkspace';
import { referenceRepository, type ChipTarget } from './chipContent';

/**
 * Opens what a chip names as its link would (`openLink`): in this window when it shows that repository, else in the
 * one that does, or wherever the user picks. `placeRepository` is the window's, once known; else it is read.
 */
export async function openReference(place: Place, placeRepository: string | undefined, target: ChipTarget): Promise<void> {
  const linkTarget: LinkTarget = { ...(target.object && { object: target.object }), ...(target.page && { page: target.page }) };
  const repository =
    placeRepository ?? (place.kind === 'repository' ? place.repository : (await queryClient.fetchQuery(workspaceInfoQuery(place.workspacePath))).repository);
  await openLink(repositoryLinkTo(referenceRepository(target, repository), linkTarget));
}

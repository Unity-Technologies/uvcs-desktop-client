import type { Place } from '@shared/domain/place';
import { openLink } from '../../app/links/openLink';
import { repositoryLinkTo } from '../../app/links/linkTo';
import type { LinkTarget } from '../../app/links/linkNavigation';
import { queryClient } from '../../app/queryClient';
import { workspaceInfoQuery } from '../../app/workspace/useWorkspace';
import { splitRepositorySpec } from '../../lib/servers';
import type { ChipTarget } from './chipContent';

/**
 * Opens what a chip names as its link would (`openLink`): in this window when it shows that repository, else in the
 * one that does, or wherever the user picks. A repository named without its server (`cs:12@art`) is on the place's.
 */
export async function openReference(place: Place, target: ChipTarget): Promise<void> {
  const linkTarget: LinkTarget = { ...(target.object && { object: target.object }), ...(target.page && { page: target.page }) };
  const placeRepository = place.kind === 'repository' ? place.repository : (await queryClient.fetchQuery(workspaceInfoQuery(place.workspacePath))).repository;
  const repository = !target.repository
    ? placeRepository
    : target.repository.includes('@')
      ? target.repository
      : `${target.repository}@${splitRepositorySpec(placeRepository).server}`;
  await openLink(repositoryLinkTo(repository, linkTarget));
}

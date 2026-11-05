import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { workspacePathOf } from '@shared/domain/place';
import type { IssueReferenceReader } from '@shared/issueTrackers/issueReferences';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { repositoryOfPlace } from '../../app/workspace/placeOrigin';
import { useSession } from '../../app/workspace/sessionStore';
import { useWorkspaceInfoOf } from '../../app/workspace/useWorkspace';
import { connectionsToReread, issueKeys, issueTrackerSetupQuery } from './issueQueries';
import { placeTrackerOf, type PlaceTracker } from './placeTracker';

export function useIssueTrackerSetup() {
  return useQuery(issueTrackerSetupQuery).data;
}

/**
 * The tracker of the window's place, when its repository has one; none outside a place (release notes, the home
 * screen), where no comment reads issues.
 */
export function usePlaceTracker(): PlaceTracker | null {
  const setup = useIssueTrackerSetup();
  const place = useSession((state) => state.place);
  const info = useWorkspaceInfoOf(place ? workspacePathOf(place) : null).data;
  const repository = place ? repositoryOfPlace(place, info) : undefined;
  return useMemo(() => placeTrackerOf(setup, repository), [setup, repository]);
}

/** How the window's comments read issues (`MarkdownOptions.issues`); none without a tracker. */
export function useIssueReferences(): IssueReferenceReader | undefined {
  return usePlaceTracker()?.reader;
}

/**
 * Keeps the window's trackers in step with what main says changed (`issueTrackersChanged`): a sign-in in another
 * window, a credential refused. The issues of a connection whose sign-in changed are read again.
 */
export function useIssueTrackersFromMain(): void {
  const queryClient = useQueryClient();
  useUvcsEvent('issueTrackersChanged', (setup) => {
    const reread = connectionsToReread(queryClient.getQueryData(issueKeys.setup), setup);
    queryClient.setQueryData(issueKeys.setup, setup);
    for (const connectionId of reread) void queryClient.invalidateQueries({ queryKey: issueKeys.ofConnection(connectionId) });
  });
}

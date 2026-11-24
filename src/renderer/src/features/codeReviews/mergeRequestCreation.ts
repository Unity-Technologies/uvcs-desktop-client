import type { CreatedMergeRequest, CreateMergeRequestRequest } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { invalidatePlace, queryClient } from '../../app/queryClient';
import { isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { toast } from '../../ui/toast/toastStore';
import { onFirstReadOfReview } from './firstReadOfReview';
import { createdAs } from './mergeRequestDraft';

/**
 * Creates a merge request (one quick `cm mergerequest create`), hands its id to `onCreated` (the dialog closes, the
 * list selects it) and says so; the toast opens it. Then the reviews are read again; it resolves once they are, to the
 * id, or to undefined when it failed (the toast says why).
 *
 * A server older than merge requests makes a plain code review of it and says nothing: a read of it during that
 * refresh (a list on screen, the dialog's own read of the branch's reviews) tells, and a note says so (`createdAs`).
 * It asks for no read of its own, so with none on screen holding it (created from another branch's menu) the note
 * doesn't come.
 */
export async function createMergeRequest(place: Place, request: CreateMergeRequestRequest, onCreated?: (reviewId: number) => void): Promise<number | undefined> {
  let stopWatching = (): void => {};
  let created: CreatedMergeRequest;
  try {
    created = await api.codeReviews.createMergeRequest(place, request);
    // Before the refresh starts, so its reads are seen.
    stopWatching = onFirstReadOfReview(queryClient, place, created.id, (review) => {
      if (createdAs(review) === 'codeReview') toast.info("This server doesn't have merge requests yet", `It was created as code review ${created.id}.`);
    });
  } catch (error) {
    toast.error("Couldn't create the merge request", error);
    await invalidatePlace(place, isAffectedByCodeReviews);
    return undefined;
  }
  const refreshed = invalidatePlace(place, isAffectedByCodeReviews);

  onCreated?.(created.id);
  const open = { label: 'Open', run: () => navigation.openPage({ kind: 'codeReview', reviewId: created.id }) };
  if (created.descriptionSaved) toast.success('Created merge request', undefined, open);
  else toast.info('Created merge request', "Its description couldn't be saved.", open);

  await refreshed.finally(stopWatching);
  return created.id;
}

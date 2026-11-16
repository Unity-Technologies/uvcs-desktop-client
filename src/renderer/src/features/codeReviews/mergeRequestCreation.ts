import type { CreateMergeRequestRequest } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { queryClient } from '../../app/queryClient';
import { runAction } from '../../app/operations/runOperation';
import { isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { toast } from '../../ui/toast/toastStore';
import { onFirstReadOfReview } from './firstReadOfReview';
import { createdAs } from './mergeRequestDraft';

/**
 * Creates a merge request (one quick `cm mergerequest create`) and reads the reviews again; the toast opens it.
 * Resolves to its id, or undefined when it failed (the toast says why).
 *
 * A server older than merge requests makes a plain code review of it and says nothing: the first read of it that
 * follows (the refresh's, a list's or its page's) tells, and a note says so (`createdAs`). That read is one the
 * refresh makes anyway; this asks for none.
 */
export async function createMergeRequest(place: Place, request: CreateMergeRequestRequest): Promise<number | undefined> {
  const created = await runAction(
    place,
    "Couldn't create the merge request",
    async () => {
      const made = await api.codeReviews.createMergeRequest(place, request);
      // Before the refresh `runAction` starts, so its reads are seen.
      onFirstReadOfReview(queryClient, place, made.id, (review) => {
        if (createdAs(review) === 'codeReview') toast.info("This server doesn't have merge requests yet", `${made.id} was created as a code review.`);
      });
      return made;
    },
    isAffectedByCodeReviews,
  );
  if (!created) return undefined;

  const open = { label: 'Open', run: () => navigation.openPage({ kind: 'codeReview', reviewId: created.id }) };
  if (created.descriptionSaved) toast.success(`Created merge request ${created.id}`, undefined, open);
  else toast.info(`Created merge request ${created.id}`, "Its description couldn't be saved.", open);
  return created.id;
}

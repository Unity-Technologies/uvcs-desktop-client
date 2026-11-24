import type { Place } from '@shared/domain/place';
import type { CodeReviewsApi } from '@shared/api/codeReviews';
import type { CodeReviewFilter, CodeReviewSummary } from '@shared/domain/codeReview';
import { branchTargetIdsOf, withTargetNamed } from '@shared/domain/reviewTargetNames';
import type { QueryFilter } from '@shared/domain/query';
import { cmPlace } from '../cm/cmPlace';
import { addReviewersArgs, createReviewArgs, deleteReviewsArgs, listReviewersArgs, ownStatusArgs, removeReviewersArgs, renameReviewArgs, reRequestReviewArgs } from '../cm/codeReviewArgs';
import { FOUND_REVIEWS, LISTED_REVIEWERS, type RawCodeReview } from '../cm/codeReviewRecords';
import { equalsCondition, findArgs } from '../cm/findQuery';
import { branchTargetsCondition } from '../cm/branchTargetsCondition';
import { CmError } from '../cm/CmError';
import { createdMergeRequestOf, createMergeRequestArgs, mergeRequestDestinationArgs, mergeRequestStateArgs, recordMergedArgs } from '../cm/mergeRequestArgs';
import { parseReviewSubscription, reviewSubscriptionArgs, setSubscriptionArgs } from '../cm/reviewSubscription';
import { layoutReader } from '../cm/formatRecords';
import { withTempFile } from '../files/tempFile';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createCodeReviewsService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): CodeReviewsApi {
  function findReviews(place: Place, conditions: string[], filter: QueryFilter): Promise<RawCodeReview[]> {
    const at = cmPlace(place);
    return cm.queryRecords(findArgs(FOUND_REVIEWS, filter, 'date desc', conditions, at.repository), layoutReader(FOUND_REVIEWS), at.options);
  }

  function findReviewById(place: Place, reviewId: number): Promise<RawCodeReview[]> {
    return findReviews(place, [`id = ${reviewId}`], {});
  }

  function findListedReviews(place: Place, filter: CodeReviewFilter): Promise<RawCodeReview[]> {
    const conditions = [
      ...(filter.id !== undefined ? [`id = ${filter.id}`] : []),
      // A branch's name can't hold a quote, which `cm find` can't read: its spec is matched exactly.
      ...(filter.targetBranch !== undefined ? [equalsCondition('target', `br:${filter.targetBranch}`)] : []),
      ...(filter.targetBranchIds !== undefined ? [branchTargetsCondition(filter.targetBranchIds)] : []),
      // `reviewer` isn't in `cm find`'s help, but it is what the official client asks for "Needs my review".
      ...(filter.reviewerIsMe ? ["reviewer = 'me'"] : []),
      ...(filter.status ? [equalsCondition('status', filter.status)] : []),
      // `{mergerequeststatusname}`'s English name, as `cm find` takes it; one state per query, as for the status.
      ...(filter.mergeRequestState ? [equalsCondition('mergerequeststatus', filter.mergeRequestState)] : []),
    ];
    return findReviews(place, conditions, {
      owners: filter.owners,
      sinceDate: filter.sinceDate,
      text: filter.text,
      limit: filter.limit,
    });
  }

  /**
   * `cm` reports branch targets only by object id; the names come from the branch lists already read, or from the
   * names of every branch, read once in a while (`BranchNamesCache`).
   */
  async function branchNamesOf(place: Place, branchIds: number[]): Promise<Record<number, string>> {
    if (branchIds.length === 0) return {};
    return Object.fromEntries(await branchNames.resolve(place, branchIds));
  }

  return {
    async listSummaries(place, filter) {
      return (await findListedReviews(place, filter)).map(summaryOf);
    },

    branchNames: branchNamesOf,

    async get(place, reviewId) {
      const [review] = (await findReviewById(place, reviewId)).map(summaryOf);
      if (!review) throw new Error(`Code review ${reviewId} was not found.`);
      return withTargetNamed(review, await branchNamesOf(place, branchTargetIdsOf([review])));
    },

    reviewers(place, reviewId) {
      const at = cmPlace(place);
      return cm.queryRecords(listReviewersArgs(reviewId, at), layoutReader(LISTED_REVIEWERS), at.options);
    },

    async create(place, request) {
      const at = cmPlace(place);
      const output = await cm.query(createReviewArgs(request, at), at.options);
      return Number.parseInt(output.trim(), 10);
    },

    async addReviewers(place, reviewId, reviewers) {
      const at = cmPlace(place);
      await cm.query(addReviewersArgs(reviewId, reviewers, at), at.options);
    },

    async removeReviewers(place, reviewId, reviewers) {
      const at = cmPlace(place);
      await cm.query(removeReviewersArgs(reviewId, reviewers, at), at.options);
    },

    async reRequestReview(place, reviewId, reviewers) {
      const at = cmPlace(place);
      await cm.query(reRequestReviewArgs(reviewId, reviewers, at), at.options);
    },

    async setOwnStatus(place, reviewId, status, comment) {
      const at = cmPlace(place);
      if (!comment?.trim()) {
        await cm.query(ownStatusArgs(reviewId, status, undefined, at), at.options);
        return;
      }
      await withTempFile(comment, (commentsFile) => cm.query(ownStatusArgs(reviewId, status, commentsFile, at), at.options));
    },

    async rename(place, reviewId, title) {
      const at = cmPlace(place);
      await cm.query(renameReviewArgs(reviewId, title, at), at.options);
    },

    async remove(place, reviewIds) {
      const at = cmPlace(place);
      await cm.query(deleteReviewsArgs(reviewIds, at), at.options);
    },

    async subscription(place, reviewId) {
      const at = cmPlace(place);
      return parseReviewSubscription(await cm.query(reviewSubscriptionArgs(reviewId, at), at.options));
    },

    async subscribe(place, reviewId) {
      const at = cmPlace(place);
      await cm.query(setSubscriptionArgs(reviewId, true, at), at.options);
    },

    async unsubscribe(place, reviewId) {
      const at = cmPlace(place);
      await cm.query(setSubscriptionArgs(reviewId, false, at), at.options);
    },

    async createMergeRequest(place, request) {
      const at = cmPlace(place);
      const create = (descriptionFile?: string): Promise<string> => cm.query(createMergeRequestArgs(request, descriptionFile, at), at.options);
      try {
        const output = request.description?.trim() ? await withTempFile(request.description, create) : await create();
        const created = createdMergeRequestOf(output, false);
        if (!created) throw new Error("The server didn't say which merge request it created.");
        return created;
      } catch (error) {
        // A description that failed after the request was made: `cm` printed its id and exited 1. It exists.
        const created = error instanceof CmError ? createdMergeRequestOf(error.command.output, true) : undefined;
        if (!created) throw error;
        return created;
      }
    },

    async setMergeRequestState(place, reviewId, state) {
      const at = cmPlace(place);
      await cm.query(mergeRequestStateArgs(reviewId, state, at), at.options);
    },

    async setMergeRequestDestination(place, reviewId, branch) {
      const at = cmPlace(place);
      await cm.query(mergeRequestDestinationArgs(reviewId, branch, at), at.options);
    },

    async recordMerged(place, reviewId, changesetId) {
      const at = cmPlace(place);
      await cm.query(recordMergedArgs(reviewId, changesetId, at), at.options);
    },
  };
}

/** The review as listed: its branch target by object id, a changeset or shelve named by its number. */
function summaryOf({ targetType, targetId, ...summary }: RawCodeReview): CodeReviewSummary {
  if (targetType === 'branch') return { ...summary, targetBranchId: targetId };
  if (targetType === 'changeset') return { ...summary, target: { kind: 'changeset', changesetId: targetId } };
  if (targetType === 'shelve') return { ...summary, target: { kind: 'shelve', shelveId: targetId } };
  return summary;
}

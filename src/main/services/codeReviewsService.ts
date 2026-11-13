import type { Place } from '@shared/domain/place';
import type { CodeReviewsApi } from '@shared/api/codeReviews';
import { type CodeReview, type CodeReviewFilter, type CodeReviewSummary, type CodeReviewTarget } from '@shared/domain/codeReview';
import type { QueryFilter } from '@shared/domain/query';
import { cmPlace } from '../cm/cmPlace';
import { addReviewersArgs, createReviewArgs, deleteReviewsArgs, listReviewersArgs, ownStatusArgs, removeReviewersArgs, renameReviewArgs, reRequestReviewArgs } from '../cm/codeReviewArgs';
import { FOUND_REVIEWS, LISTED_REVIEWERS, type RawCodeReview } from '../cm/codeReviewRecords';
import { equalsCondition, findArgs } from '../cm/findQuery';
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
      // `reviewer` isn't in `cm find`'s help, but it is what the official client asks for "Needs my review".
      ...(filter.reviewerIsMe ? ["reviewer = 'me'"] : []),
      ...(filter.status ? [equalsCondition('status', filter.status)] : []),
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
  async function resolveTargets(place: Place, reviews: RawCodeReview[]): Promise<CodeReview[]> {
    const branchIds = reviews.filter((review) => review.targetType === 'branch').map((review) => review.targetId);
    const names = branchIds.length > 0 ? await branchNames.resolve(place, branchIds) : new Map<number, string>();

    return reviews.map((review) => ({
      ...summaryOf(review),
      target: targetOf(review, names),
    }));
  }

  return {
    async list(place, filter) {
      return resolveTargets(place, await findListedReviews(place, filter));
    },

    async listSummaries(place, filter) {
      return (await findListedReviews(place, filter)).map(summaryOf);
    },

    async get(place, reviewId) {
      const [review] = await resolveTargets(place, await findReviewById(place, reviewId));
      if (!review) throw new Error(`Code review ${reviewId} was not found.`);
      return review;
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
  };
}

/** The review as listed: its branch target by object id, a changeset or shelve named by its number. */
function summaryOf({ targetType, targetId, ...summary }: RawCodeReview): CodeReviewSummary {
  if (targetType === 'branch') return { ...summary, targetBranchId: targetId };
  if (targetType === 'changeset') return { ...summary, target: { kind: 'changeset', changesetId: targetId } };
  if (targetType === 'shelve') return { ...summary, target: { kind: 'shelve', shelveId: targetId } };
  return summary;
}

function targetOf({ targetType, targetId }: RawCodeReview, branchNames: ReadonlyMap<number, string>): CodeReviewTarget {
  if (targetType === 'changeset') return { kind: 'changeset', changesetId: targetId };
  if (targetType === 'shelve') return { kind: 'shelve', shelveId: targetId };
  const branch = targetType === 'branch' ? branchNames.get(targetId) : undefined;
  if (branch !== undefined) return { kind: 'branch', branch };
  return { kind: 'unknown', description: targetType === 'branch' ? 'an unknown branch' : 'changes of an unknown kind' };
}

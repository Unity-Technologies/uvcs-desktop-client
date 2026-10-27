import type { Place } from '@shared/domain/place';
import type { CodeReviewsApi } from '@shared/api/codeReviews';
import { MAX_LISTED_CODE_REVIEWS, type CodeReview, type CodeReviewFilter, type CodeReviewSummary, type CodeReviewTarget } from '@shared/domain/codeReview';
import type { QueryFilter } from '@shared/domain/query';
import { cmPlace } from '../cm/cmPlace';
import { FOUND_REVIEWS, type RawCodeReview } from '../cm/codeReviewRecords';
import { equalsCondition, findArgs } from '../cm/findQuery';
import { layoutReader } from '../cm/formatRecords';
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
      ...(filter.assignedToMe ? ["assignee = 'me'"] : []),
      ...(filter.status ? [equalsCondition('status', filter.status)] : []),
    ];
    return findReviews(place, conditions, {
      owners: filter.owners,
      sinceDate: filter.sinceDate,
      text: filter.text,
      limit: MAX_LISTED_CODE_REVIEWS,
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

    async create(place, { targetSpec, title, assignee }) {
      const at = cmPlace(place);
      const output = await cm.query(
        ['codereview', at.spec(targetSpec), title, ...(assignee ? [`--assignee=${assignee}`] : []), '--format={id}', ...at.repositoryOption],
        at.options,
      );
      return Number.parseInt(output.trim(), 10);
    },

    async update(place, reviewId, { status, assignee }) {
      const at = cmPlace(place);
      await cm.query(
        [
          'codereview',
          '-e',
          String(reviewId),
          ...(status ? [`--status=${status}`] : []),
          ...(assignee !== undefined ? [`--assignee=${assignee}`] : []),
          ...at.repositoryOption,
        ],
        at.options,
      );
      // `cm` succeeds without changing the status of a review nobody is assigned to.
      const [updated] = status ? await findReviewById(place, reviewId) : [];
      if (updated && updated.status !== status) {
        throw new Error("The status didn't change: a review nobody is assigned to keeps its status. Assign the review, then try again.");
      }
    },

    async remove(place, reviewIds) {
      const at = cmPlace(place);
      await cm.query(['codereview', '-d', ...reviewIds.map(String), ...at.repositoryOption], at.options);
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

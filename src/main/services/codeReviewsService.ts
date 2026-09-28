import type { CodeReviewsApi } from '@shared/api/codeReviews';
import { MAX_LISTED_CODE_REVIEWS, type CodeReview, type CodeReviewFilter, type CodeReviewSummary, type CodeReviewTarget } from '@shared/domain/codeReview';
import type { QueryFilter } from '@shared/domain/query';
import { parseCodeReviews, type RawCodeReview } from '../cm/codeReviewsXml';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createCodeReviewsService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): CodeReviewsApi {
  async function findRaw(workspacePath: string, conditions: string[], filter: QueryFilter): Promise<RawCodeReview[]> {
    const xml = await cm.query(findArgs('review', filter, 'date desc', conditions), { cwd: workspacePath });
    return parseCodeReviews(xml);
  }

  async function find(workspacePath: string, conditions: string[], filter: QueryFilter): Promise<CodeReview[]> {
    return resolveTargets(workspacePath, await findRaw(workspacePath, conditions, filter));
  }

  function findListed(workspacePath: string, filter: CodeReviewFilter): Promise<RawCodeReview[]> {
    const conditions = [
      ...(filter.assignedToMe ? ["assignee = 'me'"] : []),
      ...(filter.status ? [`status = '${escapeQueryValue(filter.status)}'`] : []),
    ];
    return findRaw(workspacePath, conditions, {
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
  async function resolveTargets(workspacePath: string, reviews: RawCodeReview[]): Promise<CodeReview[]> {
    const branchIds = reviews.filter((review) => review.targetType === 'branch').map((review) => review.targetId);
    const names = branchIds.length > 0 ? await branchNames.resolve(workspacePath, branchIds) : new Map<number, string>();

    return reviews.map((review) => ({
      ...summaryOf(review),
      target: targetOf(review, names),
    }));
  }

  return {
    async list(workspacePath, filter) {
      return resolveTargets(workspacePath, await findListed(workspacePath, filter));
    },

    async listSummaries(workspacePath, filter) {
      return (await findListed(workspacePath, filter)).map(summaryOf);
    },

    async get(workspacePath, reviewId) {
      const [review] = await find(workspacePath, [`id = ${reviewId}`], {});
      if (!review) throw new Error(`Code review ${reviewId} was not found.`);
      return review;
    },

    async create(workspacePath, { targetSpec, title, assignee }) {
      const output = await cm.query(
        ['codereview', targetSpec, title, ...(assignee ? [`--assignee=${assignee}`] : []), '--format={id}'],
        { cwd: workspacePath },
      );
      return Number.parseInt(output.trim(), 10);
    },

    async update(workspacePath, reviewId, { status, assignee }) {
      await cm.query(
        ['codereview', '-e', String(reviewId), ...(status ? [`--status=${status}`] : []), ...(assignee !== undefined ? [`--assignee=${assignee}`] : [])],
        { cwd: workspacePath },
      );
      // `cm` succeeds without changing the status of a review nobody is assigned to.
      const [updated] = status ? await findRaw(workspacePath, [`id = ${reviewId}`], {}) : [];
      if (updated && updated.status !== status) {
        throw new Error("cm didn't change the status: it ignores status changes on reviews nobody is assigned to. Assign the review, then try again.");
      }
    },

    async remove(workspacePath, reviewIds) {
      await cm.query(['codereview', '-d', ...reviewIds.map(String)], { cwd: workspacePath });
    },
  };
}

/** The review as listed, its branch target by object id. */
function summaryOf({ targetType, targetId, ...summary }: RawCodeReview): CodeReviewSummary {
  return targetType === 'branch' ? { ...summary, targetBranchId: targetId } : summary;
}

function targetOf({ targetType, targetId }: RawCodeReview, branchNames: ReadonlyMap<number, string>): CodeReviewTarget {
  if (targetType === 'changeset') return { kind: 'changeset', changesetId: targetId };
  if (targetType === 'shelve') return { kind: 'shelve', shelveId: targetId };
  const branch = targetType === 'branch' ? branchNames.get(targetId) : undefined;
  if (branch !== undefined) return { kind: 'branch', branch };
  return { kind: 'unknown', description: targetType === 'branch' ? 'an unknown branch' : 'changes of an unknown kind' };
}

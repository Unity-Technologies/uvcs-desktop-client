import '../../testing/fakeWindow';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { workspacePlace } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';
import { codeReviewKey } from '../../features/codeReviews/codeReviewKey';
import { mergeConflictsKey } from '../../features/codeReviews/mergeConflictsKey';
import { readQuery, showQuery, type QueryProbe } from '../../testing/queryProbes';
import { createQueryClient, IMMUTABLE_QUERY } from '../queryClient';
import { refreshShownIn } from './refreshShown';

const ws = '/work/game';
const place = workspacePlace(ws);
const key = (...parts: unknown[]) => queryKeys.inWorkspace(ws, ...parts);
const reviewPage = { kind: 'codeReview', reviewId: 7 } as const;

function reviewOf(target: CodeReview['target']): CodeReview {
  const date = '2026-11-10T09:00:00Z';
  return { id: 7, title: 'Faster loading', status: 'Under review', owner: 'ana', reviewers: [], date, lastActivity: date, commentCount: 2, openIssueCount: 1, target };
}

let client: QueryClient;
beforeEach(() => {
  client = createQueryClient();
  client.mount();
});
afterEach(() => {
  client.unmount();
  client.clear();
});

/** The window with a branch's review in front of the Merge requests view: what each shows, read once. */
async function showReviewOfBranch(): Promise<Record<string, QueryProbe>> {
  const review = reviewOf({ kind: 'branch', branch: '/main/task-12' });
  return {
    review: await showQuery(client, codeReviewKey(place, 7), { answer: () => review }),
    conversation: await showQuery(client, key('codeReviews', 'conversation', 7)),
    reviewers: await showQuery(client, key('codeReviews', 'reviewers', 7)),
    files: await showQuery(client, key('diff', { kind: 'branch', branch: '/main/task-12' })),
    changesets: await showQuery(client, key('changesets', { branch: '/main/task-12' })),
    fileText: await showQuery(client, key('diffContents', 'rev:1', 'rev:2'), { meta: IMMUTABLE_QUERY }),
    reviewList: await showQuery(client, key('codeReviews', {})),
    pendingChanges: await showQuery(client, key('pendingChanges', 'all')),
    branches: await showQuery(client, key('branches', {})),
  };
}

const readsOf = (probes: Record<string, QueryProbe>) => Object.fromEntries(Object.entries(probes).map(([name, probe]) => [name, probe.reads()]));

describe('refreshShown', () => {
  it("with a code review's page in front, reads again only what the page shows", async () => {
    const shown = await showReviewOfBranch();

    await refreshShownIn(client, place, reviewPage);

    expect(readsOf(shown)).toEqual({
      review: 2,
      conversation: 2,
      reviewers: 2,
      files: 2,
      changesets: 2,
      fileText: 1,
      reviewList: 1,
      pendingChanges: 1,
      branches: 1,
    });
  });

  it('with no page in front, reads again everything the window shows but what never changes', async () => {
    const shown = await showReviewOfBranch();

    await refreshShownIn(client, place, undefined);

    expect(readsOf(shown)).toEqual({
      review: 2,
      conversation: 2,
      reviewers: 2,
      files: 2,
      changesets: 2,
      fileText: 1,
      reviewList: 2,
      pendingChanges: 2,
      branches: 2,
    });
  });
});

describe("refreshShown with an open merge request's page in front", () => {
  /** The page, and its destination's branch shown elsewhere too (the top bar's, the workspace being on it). */
  async function showOpenRequest({ conflictsChecked }: { conflictsChecked: boolean }): Promise<QueryProbe> {
    const review: CodeReview = { ...reviewOf({ kind: 'branch', branch: '/main/task-12' }), mergeRequest: { state: 'Open', destination: '/main' } };
    await showQuery(client, codeReviewKey(place, 7), { answer: () => review });
    const destination = await showQuery(client, key('branches', 'byName', '/main'));
    if (conflictsChecked) await readQuery(client, mergeConflictsKey(place, '/main/task-12', 3, '/main', 19), { meta: IMMUTABLE_QUERY });
    return destination;
  }

  it('reads the destination branch again once its conflicts were checked, so a check-in there checks them again', async () => {
    const destination = await showOpenRequest({ conflictsChecked: true });

    await refreshShownIn(client, place, reviewPage);

    expect(destination.reads()).toBe(2);
  });

  it('leaves the destination branch alone when its conflicts were never checked', async () => {
    const destination = await showOpenRequest({ conflictsChecked: false });

    await refreshShownIn(client, place, reviewPage);

    expect(destination.reads()).toBe(1);
  });
});

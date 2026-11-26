import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

// The destination's dialog renders the branch list; a test says which branch the user picked in it, or that they cancelled.
vi.mock('./DestinationDialog', () => ({ pickDestination: vi.fn() }));

import type { Branch } from '@shared/domain/branch';
import { workspacePlace } from '@shared/domain/place';
import type { CodeReview } from '@shared/domain/codeReview';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { codeReviewKey } from './codeReviewKey';
import { pickDestination } from './DestinationDialog';
import { chooseMergeRequestDestination, setMergedBranchHidden, setMergeRequestDestination, setMergeRequestState } from './mergeRequestOperations';

const ws = '/ws';
const inWs = workspacePlace(ws);
const request = (state: 'Draft' | 'Open' | 'Closed', id = 43): CodeReview => ({
  ...codeReviewSummary({ id, mergeRequest: { state, destination: '/main' } }),
  target: { kind: 'branch', branch: '/main/task1' },
});
const listKey = queryKeys.inPlace(inWs, 'codeReviews', {});
const shown = (id: number) => queryClient.getQueryData<CodeReview>(codeReviewKey(inWs, id));
const listed = () => queryClient.getQueryData<CodeReview[]>(listKey);

describe("moving a merge request's state", () => {
  it('closes it with one call, shows it closed at once on its page and in the lists, and reads the reviews again', async () => {
    queryClient.setQueryData(codeReviewKey(inWs, 43), request('Open'));
    queryClient.setQueryData(listKey, [request('Open'), request('Open', 44)]);
    const refreshed = watchRefreshes(ws);
    fakeApi.answer('codeReviews.setMergeRequestState', () => undefined);

    await setMergeRequestState(inWs, request('Open'), { to: 'Closed', word: 'closeMergeRequest' });

    expect(fakeApi.argsOf('codeReviews.setMergeRequestState')).toEqual([[inWs, 43, 'Closed']]);
    expect(shown(43)?.mergeRequest).toEqual({ state: 'Closed', destination: '/main' });
    expect(listed()?.map((each) => each.mergeRequest?.state)).toEqual(['Closed', 'Open']);
    expect(queryClient.getQueryState(codeReviewKey(inWs, 43))?.isInvalidated).toBe(true);
    expect(refreshed()).toEqual(['codeReviews']);
  });

  it("shows the move at once in the lists when its page was never opened (the list's row menu)", async () => {
    queryClient.removeQueries({ queryKey: codeReviewKey(inWs, 47) });
    queryClient.setQueryData(listKey, [request('Draft', 47), request('Open', 44)]);
    fakeApi.answer('codeReviews.setMergeRequestState', () => undefined);

    await setMergeRequestState(inWs, request('Draft', 47), { to: 'Open', word: 'readyForReview' });

    expect(listed()?.map((each) => each.mergeRequest?.state)).toEqual(['Open', 'Open']);
  });

  it('says which move failed, and keeps showing the state it had', async () => {
    queryClient.setQueryData(codeReviewKey(inWs, 45), request('Draft', 45));
    fakeApi.answer('codeReviews.setMergeRequestState', () => {
      throw new Error('You need the change permission on the branch.');
    });

    await setMergeRequestState(inWs, request('Draft', 45), { to: 'Open', word: 'readyForReview' });

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't mark the merge request ready for review", detail: 'You need the change permission on the branch.' }]);
    expect(shown(45)?.mergeRequest?.state).toBe('Draft');
  });
});

describe("changing a merge request's destination", () => {
  it('changes it with one call and shows the new one at once', async () => {
    queryClient.setQueryData(codeReviewKey(inWs, 46), request('Open', 46));
    fakeApi.answer('codeReviews.setMergeRequestDestination', () => undefined);

    await setMergeRequestDestination(inWs, request('Open', 46), '/main/release');

    expect(fakeApi.argsOf('codeReviews.setMergeRequestDestination')).toEqual([[inWs, 46, '/main/release']]);
    expect(shown(46)?.mergeRequest).toEqual({ state: 'Open', destination: '/main/release' });
  });

  it('tells it failed', async () => {
    fakeApi.answer('codeReviews.setMergeRequestDestination', () => {
      throw new Error("The specified branch /main/gone can't be found.");
    });

    await setMergeRequestDestination(inWs, request('Open'), '/main/gone');

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't change the destination", detail: "The specified branch /main/gone can't be found." }]);
  });
});

describe("choosing a merge request's destination from its row's menu", () => {
  const changeable = { destination: '/main', source: '/main/task1' };
  const branch = (name: string): Branch => ({ id: 1, name, parent: '/main', comment: '', owner: 'bob', date: '', headChangeset: 3, guid: '', repository: 'game' });

  it("asks in the page's branch list, starting on the request's destination, and shows the one picked in the row and its details at once", async () => {
    queryClient.removeQueries({ queryKey: codeReviewKey(inWs, 48) });
    queryClient.setQueryData(listKey, [request('Open', 48), request('Open', 44)]);
    const refreshed = watchRefreshes(ws);
    fakeApi.answer('codeReviews.setMergeRequestDestination', () => undefined);
    vi.mocked(pickDestination).mockResolvedValueOnce(branch('/main/release'));

    await chooseMergeRequestDestination(inWs, request('Open', 48), changeable);

    expect(vi.mocked(pickDestination).mock.lastCall).toEqual([{ place: inWs, title: 'Review 48', changeable }]);
    expect(fakeApi.argsOf('codeReviews.setMergeRequestDestination')).toEqual([[inWs, 48, '/main/release']]);
    // The details panel shows the selected row as the list read it.
    expect(listed()?.map((each) => each.mergeRequest?.destination)).toEqual(['/main/release', '/main']);
    expect(refreshed()).toEqual(['codeReviews']);
  });

  it('changes nothing when the user picks the destination it has, or cancels', async () => {
    vi.mocked(pickDestination).mockResolvedValueOnce(branch('/main'));
    await chooseMergeRequestDestination(inWs, request('Open', 48), changeable);
    vi.mocked(pickDestination).mockResolvedValueOnce(undefined);
    await chooseMergeRequestDestination(inWs, request('Open', 48), changeable);

    expect(fakeApi.argsOf('codeReviews.setMergeRequestDestination')).toEqual([]);
  });
});

describe("hiding a merged request's branch", () => {
  it('hides it, and reads again the branches and the reviews, whose conversation the server may note it in', async () => {
    const refreshed = watchRefreshes(ws);
    fakeApi.answer('branches.setHidden', () => undefined);

    await setMergedBranchHidden(inWs, '/main/task1', true);

    expect(fakeApi.argsOf('branches.setHidden')).toEqual([[inWs, ['/main/task1'], true]]);
    expect(refreshed()).toEqual(expect.arrayContaining(['branches', 'codeReviews']));
  });

  it('shows it again', async () => {
    fakeApi.answer('branches.setHidden', () => undefined);

    await setMergedBranchHidden(inWs, '/main/task1', false);

    expect(fakeApi.argsOf('branches.setHidden')).toEqual([[inWs, ['/main/task1'], false]]);
  });
});

import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({
  confirmed: true,
  typed: undefined as string | undefined,
  prompts: [] as { initialValue?: string }[],
}));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => asked.confirmed }));
vi.mock('../../ui/dialog/prompt', () => ({
  prompt: async (options: { initialValue?: string }) => {
    asked.prompts.push(options);
    return asked.typed;
  },
}));

import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { shownToasts } from '../../testing/operationOutcome';
import { deleteReviews, reassignReview, setReviewStatus } from './codeReviewOperations';

const ws = '/ws';
const review = (assignee: string, id = 31): CodeReviewSummary => ({ id, title: `Review ${id}`, status: 'Under review', owner: 'bob', assignee, date: '' });
const workspaceOn = (server: string) =>
  queryClient.setQueryData<WorkspaceInfo>(queryKeys.inWorkspace(ws, 'info'), {
    name: 'ws',
    path: ws,
    repository: `game@${server}`,
    repositoryName: 'game',
    server,
    selector: { kind: 'branch', name: '/main' },
    loadedChangeset: 5,
  });

beforeEach(() => {
  asked.confirmed = true;
  asked.typed = undefined;
  asked.prompts.length = 0;
});

describe('changing a review status', () => {
  it('sets the status alone on a review someone is assigned to, asking nothing', async () => {
    fakeApi.answer('codeReviews.update', () => undefined);

    await setReviewStatus(ws, review('ana'), 'Reviewed');

    expect(asked.prompts).toEqual([]);
    expect(fakeApi.argsOf('codeReviews.update')).toEqual([[ws, 31, { status: 'Reviewed', assignee: undefined }]]);
  });

  it('asks for a reviewer first on a review nobody is assigned to (cm would keep its status), suggesting the user', async () => {
    workspaceOn('local');
    fakeApi.answer('accounts.list', () => []);
    fakeApi.answer('system.currentUser', () => 'ana');
    fakeApi.answer('codeReviews.update', () => undefined);
    asked.typed = 'ana';

    await setReviewStatus(ws, review(' '), 'Rework required');

    expect(asked.prompts.map((prompt) => prompt.initialValue)).toEqual(['ana']);
    expect(fakeApi.argsOf('codeReviews.update')).toEqual([[ws, 31, { status: 'Rework required', assignee: 'ana' }]]);
  });

  it('changes nothing when the reviewer prompt is cancelled', async () => {
    await setReviewStatus(ws, review(''), 'Reviewed');

    expect(fakeApi.methods()).toEqual([]);
  });
});

describe('review operations', () => {
  it('reassigns to the reviewer typed, starting from the current one', async () => {
    fakeApi.answer('codeReviews.update', () => undefined);
    asked.typed = 'carl';

    await reassignReview(ws, review('ana'));

    expect(asked.prompts.map((prompt) => prompt.initialValue)).toEqual(['ana']);
    expect(fakeApi.argsOf('codeReviews.update')).toEqual([[ws, 31, { assignee: 'carl' }]]);
  });

  it('deletes the reviews picked in one call, and tells it did', async () => {
    fakeApi.answer('codeReviews.remove', () => undefined);

    expect(await deleteReviews(ws, [review('ana', 1), review('ana', 2)])).toBe(true);

    expect(fakeApi.argsOf('codeReviews.remove')).toEqual([[ws, [1, 2]]]);
  });

  it('tells a delete failed or was cancelled, so the selection stays', async () => {
    fakeApi.answer('codeReviews.remove', () => {
      throw new Error('Access denied');
    });
    expect(await deleteReviews(ws, [review('ana')])).toBe(false);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the review", detail: 'Access denied' }]);

    asked.confirmed = false;
    expect(await deleteReviews(ws, [review('ana')])).toBe(false);
    expect(fakeApi.argsOf('codeReviews.remove')).toHaveLength(1);
  });
});

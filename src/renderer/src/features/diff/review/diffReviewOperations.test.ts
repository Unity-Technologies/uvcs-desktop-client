import { fakeApi } from '../../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import type { DiffEntry } from '@shared/domain/diff';
import { workspacePlace } from '@shared/domain/place';
import { branchGuidFor, repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { queryClient } from '../../../app/queryClient';
import { shownToasts } from '../../../testing/operationOutcome';
import { diffReviewTargetToWrite, reviewTargetWhenKnown, setDiffReviewed } from './diffReviewOperations';

const place = workspacePlace('/ws');
const GAME = repositoryGuidFor(1);
const TASK = branchGuidFor(1);
const entry: DiffEntry = { status: 'changed', path: 'a.ts', itemType: 'file', baseRevisionId: 1, revisionId: 10, repository: 'game@local' };
const task: Branch = { id: 7, name: '/main/task', parent: '/main', comment: '', owner: 'ana', date: '2026-10-01', headChangeset: 12, guid: TASK, repository: 'game@local' };

beforeEach(() => queryClient.clear());

describe('diffReviewTargetToWrite', () => {
  it('names a branch’s diff by the repository’s and the branch’s GUIDs, with the name its marks had before', async () => {
    fakeApi.answer('repositories.guidOf', () => GAME);
    fakeApi.answer('branches.get', () => task);

    expect(await diffReviewTargetToWrite(place, 'game@local', { kind: 'branch', branch: '/main/task' })).toEqual({
      place,
      repository: GAME,
      name: `br:${TASK}`,
      formerName: 'br:/main/task',
    });
  });

  it('reads no branch for a changeset’s diff', async () => {
    fakeApi.answer('repositories.guidOf', () => GAME);

    expect(await diffReviewTargetToWrite(place, 'game@local', { kind: 'changeset', changesetId: 4 })).toEqual({ place, repository: GAME, name: 'cs:4', formerName: undefined });
    expect(fakeApi.methods()).toEqual(['repositories.guidOf']);
  });

  it('rejects with a message to show when the branch is gone', async () => {
    fakeApi.answer('repositories.guidOf', () => GAME);
    fakeApi.answer('branches.get', () => null);

    await expect(diffReviewTargetToWrite(place, 'game@local', { kind: 'branch', branch: '/main/task' })).rejects.toThrow("Couldn't find the branch /main/task.");
  });
});

describe('setDiffReviewed', () => {
  it('marks the files under the diff’s GUIDs', async () => {
    fakeApi.answer('review.markDiff', () => undefined);
    fakeApi.answer('review.diffMarks', () => []);

    await setDiffReviewed(async () => ({ place, repository: GAME, name: `br:${TASK}` }), [entry], true);

    expect(fakeApi.argsOf('review.markDiff')).toEqual([[GAME, `br:${TASK}`, [{ path: 'a.ts', revisionId: 10 }], undefined]]);
  });

  it('says the files weren’t marked when where to write their marks can’t be read', async () => {
    await setDiffReviewed(() => Promise.reject(new Error('Unable to connect to local')), [entry], true);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't mark the files as reviewed", detail: 'Unable to connect to local' }]);
    expect(fakeApi.argsOf('review.markDiff')).toEqual([]);
  });
});

describe('reviewTargetWhenKnown', () => {
  const changeset = { kind: 'changeset', changesetId: 4 } as const;

  it('writes where the marks were read, asking nothing', async () => {
    const known = { place, repository: GAME, name: 'cs:4' };

    expect(await reviewTargetWhenKnown(known, place, undefined, changeset)!()).toBe(known);
    expect(fakeApi.methods()).toEqual([]);
  });

  it('reads where to write once the repository is known, and marks nothing before', async () => {
    fakeApi.answer('repositories.guidOf', () => GAME);

    expect(reviewTargetWhenKnown(undefined, place, undefined, changeset)).toBeNull();
    expect(await reviewTargetWhenKnown(undefined, place, 'game@local', changeset)!()).toMatchObject({ repository: GAME, name: 'cs:4' });
  });
});

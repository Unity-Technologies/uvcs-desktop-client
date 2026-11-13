import { fakeApi } from '../../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({ picked: undefined as number | undefined, picker: [] as unknown[] }));
vi.mock('../../../ui/dialog/confirm', () => import('../../../testing/fakeDialogs'));
vi.mock('../../changesets/ChangesetPickerDialog', () => ({
  pickChangeset: async (options: unknown) => {
    asked.picker.push(options);
    return asked.picked;
  },
}));

import { workspacePlace } from '@shared/domain/place';
import { answerConfirms } from '../../../testing/fakeDialogs';
import { shownToasts, watchRefreshes } from '../../../testing/operationOutcome';
import {
  addLineComment,
  addReviewComment,
  deleteReviewComment,
  discardChangeRequest,
  editReviewComment,
  markChangeRequest,
  replyToComment,
  saveReviewDescription,
} from './reviewCommentOperations';

const ws = '/ws';
const inWs = workspacePlace(ws);
const comment = { guid: 'c1' };

beforeEach(() => {
  asked.picked = undefined;
  asked.picker.length = 0;
});

describe('writing on a review', () => {
  it('adds, replies, discards, edits and describes, each with one call', async () => {
    for (const method of ['reviewComments.add', 'reviewComments.addOnLine', 'reviewComments.reply', 'reviewComments.edit', 'reviewComments.setDescription'] as const) {
      fakeApi.answer(method, () => undefined);
    }

    expect(await addReviewComment(inWs, 41, 'Nice')).toBe(true);
    expect(await addLineComment(inWs, 41, { revisionId: 30, line: 7, kind: 'question' }, 'Why?')).toBe(true);
    expect(await replyToComment(inWs, comment, 'Thanks')).toBe(true);
    expect(await discardChangeRequest(inWs, comment, 'cm calls it target')).toBe(true);
    expect(await editReviewComment(inWs, comment, 'Nicer')).toBe(true);
    expect(await saveReviewDescription(inWs, 41, '')).toBe(true);

    expect(fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1)])).toEqual([
      ['reviewComments.add', 41, 'Nice'],
      ['reviewComments.addOnLine', 41, { revisionId: 30, line: 7, kind: 'question' }, 'Why?'],
      ['reviewComments.reply', 'c1', 'Thanks'],
      ['reviewComments.reply', 'c1', 'cm calls it target', { discard: true }],
      ['reviewComments.edit', 'c1', 'Nicer'],
      ['reviewComments.setDescription', 41, ''],
    ]);
  });

  it('reads only the reviews again after each write, their lists and conversations, never the workspace', async () => {
    for (const method of ['reviewComments.add', 'reviewComments.addOnLine', 'reviewComments.reply', 'reviewComments.edit', 'reviewComments.remove', 'reviewComments.setDescription'] as const) {
      fakeApi.answer(method, () => undefined);
    }
    answerConfirms(true);
    const writes = [
      () => addReviewComment(inWs, 41, 'Nice'),
      () => addLineComment(inWs, 41, { revisionId: 30, line: 7, kind: 'changeRequest' }, 'Rename it'),
      () => replyToComment(inWs, comment, 'Thanks'),
      () => discardChangeRequest(inWs, comment, 'Not needed'),
      () => editReviewComment(inWs, comment, 'Nicer'),
      () => deleteReviewComment(inWs, comment),
      () => saveReviewDescription(inWs, 41, 'Why'),
    ];

    for (const write of writes) {
      const refreshed = watchRefreshes(ws);
      await write();
      expect(refreshed()).toEqual(['codeReviews']);
    }
  });

  it('says it failed and keeps the text to try again', async () => {
    fakeApi.answer('reviewComments.reply', () => {
      throw new Error('The comment was deleted');
    });

    expect(await replyToComment(inWs, comment, 'Thanks')).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't reply", detail: 'The comment was deleted' }]);
  });

  it('deletes a comment once confirmed, and nothing otherwise', async () => {
    fakeApi.answer('reviewComments.remove', () => undefined);

    answerConfirms(false);
    expect(await deleteReviewComment(inWs, comment)).toBe(false);
    answerConfirms(true);
    expect(await deleteReviewComment(inWs, comment)).toBe(true);

    expect(fakeApi.argsOf('reviewComments.remove')).toEqual([[inWs, 'c1']]);
  });
});

describe('marking a change request by hand', () => {
  const branchReview = { target: { kind: 'branch', branch: '/main/task' } } as const;

  it("marks it applied in the changeset picked among the branch's, the newest ready for Enter", async () => {
    fakeApi.answer('reviewComments.markApplied', () => undefined);
    asked.picked = 12;
    const refreshed = watchRefreshes(ws);

    expect(await markChangeRequest(inWs, branchReview, comment, 'applied')).toBe(true);

    expect(asked.picker).toEqual([{ title: 'Mark as applied in a changeset', among: { branch: '/main/task', limit: expect.any(Number) } }]);
    expect(fakeApi.argsOf('reviewComments.markApplied')).toEqual([[inWs, 'c1', 12]]);
    expect(refreshed()).toEqual(['codeReviews']);
  });

  it("offers a changeset's or a shelve's review the repository's newest changesets", async () => {
    await markChangeRequest(inWs, { target: { kind: 'shelve', shelveId: 3 } }, comment, 'applied');

    expect(asked.picker).toEqual([{ title: 'Mark as applied in a changeset', among: undefined }]);
  });

  it('marks nothing when no changeset is picked', async () => {
    expect(await markChangeRequest(inWs, branchReview, comment, 'applied')).toBe(false);

    expect(fakeApi.calls()).toEqual([]);
  });

  it('marks it not applied at once, refreshing the reviews only', async () => {
    fakeApi.answer('reviewComments.markNotApplied', () => undefined);
    const refreshed = watchRefreshes(ws);

    expect(await markChangeRequest(inWs, branchReview, comment, 'notApplied')).toBe(true);

    expect(asked.picker).toEqual([]);
    expect(fakeApi.argsOf('reviewComments.markNotApplied')).toEqual([[inWs, 'c1']]);
    expect(refreshed()).toEqual(['codeReviews']);
  });

  it("says why cm refused it", async () => {
    fakeApi.answer('reviewComments.markApplied', () => {
      throw new Error('The change request is already applied in changeset 9.');
    });
    asked.picked = 12;

    expect(await markChangeRequest(inWs, branchReview, comment, 'applied')).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't mark the change request as applied", detail: 'The change request is already applied in changeset 9.' }]);
  });
});

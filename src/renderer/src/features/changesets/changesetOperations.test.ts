import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({
  comment: undefined as string | undefined,
  picked: undefined as string | undefined,
  picker: undefined as { exclude?: string } | undefined,
}));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));
vi.mock('./EditCommentDialog', () => ({ askForChangesetComment: async () => asked.comment }));
vi.mock('../branches/BranchPickerDialog', () => ({
  pickBranch: async (options: { exclude?: string }) => {
    asked.picker = options;
    return asked.picked;
  },
}));

import type { ChangesetInfo } from '@shared/domain/changeset';
import { answerConfirms, answerPrompts } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { deleteChangeset, editChangesetComment, mergeChangesetTo, moveChangesetToBranch, readChangesetGuid, revertWorkspaceToChangeset } from './changesetOperations';

const ws = '/ws';
const changeset = { id: 42, branch: '/main/task', comment: 'Old comment' };
const listed = (guid?: string): ChangesetInfo => ({ id: 42, branch: '/main/task', comment: '', owner: 'ana', date: '', parent: 41, guid });

beforeEach(() => {
  asked.comment = undefined;
  asked.picked = undefined;
  asked.picker = undefined;
});

describe('changeset operations', () => {
  it('saves an edited comment and refreshes only what shows it, the changesets already read too', async () => {
    asked.comment = 'New comment';
    fakeApi.answer('changesets.editComment', () => undefined);
    const refreshed = watchRefreshes(ws);

    await editChangesetComment(ws, changeset);

    expect(fakeApi.argsOf('changesets.editComment')).toEqual([[ws, 42, 'New comment']]);
    expect(refreshed()).toEqual(['annotate', 'branchExplorer', 'changesets', 'history']);
  });

  it('saves nothing when the comment editor is cancelled', async () => {
    await editChangesetComment(ws, changeset);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('merges a changeset into the branch picked, never offering its own', async () => {
    asked.picked = '/main';

    await mergeChangesetTo(changeset);

    expect(asked.picker?.exclude).toBe('/main/task');
    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:42', destinationBranch: '/main' } }]);
  });

  it('moves a changeset to the branch typed, and says so', async () => {
    answerPrompts('/main/task/rescued');
    fakeApi.answer('changesets.moveToBranch', () => undefined);

    await moveChangesetToBranch(ws, changeset);

    expect(fakeApi.argsOf('changesets.moveToBranch')).toEqual([[ws, 42, '/main/task/rescued']]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Moved changeset 42 to /main/task/rescued' }]);
  });

  it('refreshes what shows changesets and the branch lists after moving or deleting one, not the workspace', async () => {
    answerPrompts('/main/task/rescued');
    fakeApi.answer('changesets.moveToBranch', () => undefined);
    fakeApi.answer('changesets.remove', () => undefined);

    const afterMove = watchRefreshes(ws);
    await moveChangesetToBranch(ws, changeset);
    expect(afterMove()).toEqual(['annotate', 'branchExplorer', 'branches', 'changesets', 'history', 'incoming']);

    const afterDelete = watchRefreshes(ws);
    await deleteChangeset(ws, changeset);
    expect(afterDelete()).toEqual(['annotate', 'branchExplorer', 'branches', 'changesets', 'history', 'incoming']);
  });

  it('deletes a changeset only once confirmed, and reports a refusal with no success', async () => {
    answerConfirms(false);
    await deleteChangeset(ws, changeset);
    expect(fakeApi.methods()).toEqual([]);

    fakeApi.answer('changesets.remove', () => {
      throw new Error('Only the last changeset of a branch can be deleted');
    });
    await deleteChangeset(ws, changeset);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the changeset", detail: 'Only the last changeset of a branch can be deleted' }]);
  });

  it('reverts the workspace to a changeset as a subtractive merge of everything after it, reviewed in the merge view', () => {
    revertWorkspaceToChangeset({ id: 40 }, 45);

    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'subtractive', sourceSpec: 'cs:45', intervalOriginSpec: 'cs:40' } }]);
  });

  it("copies a GUID already read without asking the server, and reads it once when the view didn't", async () => {
    expect(await readChangesetGuid(ws, listed('known'))).toBe('known');
    expect(fakeApi.methods()).toEqual([]);

    fakeApi.answer('changesets.get', () => ({ id: 42, guid: 'read' }));
    expect(await readChangesetGuid(ws, listed())).toBe('read');
    expect(fakeApi.argsOf('changesets.get')).toEqual([[ws, 42]]);
  });
});

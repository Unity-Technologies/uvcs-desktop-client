import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({
  comment: undefined as string | undefined,
  picked: undefined as { name: string } | undefined,
  picker: undefined as { exclude?: string } | undefined,
  pickedChangeset: undefined as number | undefined,
  changesetPicker: undefined as { title: string; exclude: number } | undefined,
}));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));
vi.mock('../../components/EditCommentDialog', () => ({ askForComment: async () => asked.comment }));
vi.mock('./ChangesetPickerDialog', () => ({
  pickChangeset: async (options: { title: string; exclude: number }) => {
    asked.changesetPicker = options;
    return asked.pickedChangeset;
  },
}));
vi.mock('../branches/BranchPickerDialog', () => ({
  pickBranch: async (options: { exclude?: string }) => {
    asked.picker = options;
    return asked.picked;
  },
}));

import { workspacePlace } from '@shared/domain/place';
import type { ChangesetInfo } from '@shared/domain/changeset';
import { answerConfirms, answerPrompts } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { deleteChangeset, diffWithAnotherChangeset, editChangesetComment, mergeChangesetTo, moveChangesetToBranch, readChangesetGuid, revertWorkspaceToChangeset, saveChangesetComment } from './changesetOperations';

const ws = '/ws';
const inWs = workspacePlace(ws);
const changeset = { id: 42, branch: '/main/task', comment: 'Old comment' };
const listed = (guid?: string): ChangesetInfo => ({ id: 42, branch: '/main/task', comment: '', owner: 'ana', date: '', parent: 41, guid });

beforeEach(() => {
  asked.comment = undefined;
  asked.picked = undefined;
  asked.picker = undefined;
  asked.pickedChangeset = undefined;
  asked.changesetPicker = undefined;
});

describe('changeset operations', () => {
  it('saves an edited comment and refreshes only what shows it, the changesets already read too', async () => {
    asked.comment = 'New comment';
    fakeApi.answer('changesets.editComment', () => undefined);
    const refreshed = watchRefreshes(ws);

    await editChangesetComment(inWs, changeset);

    expect(fakeApi.argsOf('changesets.editComment')).toEqual([[inWs, 42, 'New comment']]);
    expect(refreshed()).toEqual(['annotate', 'branchExplorer', 'changesets', 'history']);
  });

  it('tells whether a comment was saved, so an unsaved one stays in its editor', async () => {
    fakeApi.answer('changesets.editComment', () => {
      throw new Error('offline');
    });
    expect(await saveChangesetComment(inWs, changeset, 'New comment')).toBe(false);

    fakeApi.answer('changesets.editComment', () => undefined);
    expect(await saveChangesetComment(inWs, changeset, 'New comment')).toBe(true);
  });

  it('saves nothing when the comment editor is cancelled', async () => {
    await editChangesetComment(inWs, changeset);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('merges a changeset into the branch picked, never offering its own', async () => {
    asked.picked = { name: '/main' };

    await mergeChangesetTo(changeset);

    expect(asked.picker?.exclude).toBe('/main/task');
    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:42', destinationBranch: '/main' } }]);
  });

  it('moves a changeset to the branch typed, and says so', async () => {
    answerPrompts('/main/task/rescued');
    fakeApi.answer('changesets.moveToBranch', () => undefined);

    await moveChangesetToBranch(inWs, changeset);

    expect(fakeApi.argsOf('changesets.moveToBranch')).toEqual([[inWs, 42, '/main/task/rescued']]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Moved changeset 42 to rescued' }]);
  });

  it('refreshes what shows changesets and the branch lists after moving or deleting one, not the workspace', async () => {
    answerPrompts('/main/task/rescued');
    fakeApi.answer('changesets.moveToBranch', () => undefined);
    fakeApi.answer('changesets.remove', () => undefined);

    const afterMove = watchRefreshes(ws);
    await moveChangesetToBranch(inWs, changeset);
    expect(afterMove()).toEqual(['annotate', 'branchExplorer', 'branches', 'changesets', 'history', 'incoming']);

    const afterDelete = watchRefreshes(ws);
    await deleteChangeset(inWs, changeset);
    expect(afterDelete()).toEqual(['annotate', 'branchExplorer', 'branches', 'changesets', 'history', 'incoming']);
  });

  it('deletes a changeset only once confirmed, and reports a refusal with no success', async () => {
    answerConfirms(false);
    await deleteChangeset(inWs, changeset);
    expect(fakeApi.methods()).toEqual([]);

    fakeApi.answer('changesets.remove', () => {
      throw new Error('Only the last changeset of a branch can be deleted');
    });
    await deleteChangeset(inWs, changeset);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the changeset", detail: 'Only the last changeset of a branch can be deleted' }]);
  });

  it('reverts the workspace to a changeset as a subtractive merge of everything after it, reviewed in the merge view', () => {
    revertWorkspaceToChangeset({ id: 40 }, 45);

    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'subtractive', sourceSpec: 'cs:45', intervalOriginSpec: 'cs:40' } }]);
  });

  it("copies a GUID already read without asking the server, and reads it once when the view didn't", async () => {
    expect(await readChangesetGuid(inWs, listed('known'))).toBe('known');
    expect(fakeApi.methods()).toEqual([]);

    fakeApi.answer('changesets.get', () => ({ id: 42, guid: 'read' }));
    expect(await readChangesetGuid(inWs, listed())).toBe('read');
    expect(fakeApi.argsOf('changesets.get')).toEqual([[inWs, 42]]);
  });
});

describe('comparing with another changeset', () => {
  it('compares the state after each, the older changeset on the left, never offering the changeset itself', async () => {
    asked.pickedChangeset = 7;

    await diffWithAnotherChangeset({ id: 42 });

    expect(asked.changesetPicker).toEqual({ title: 'Compare changeset 42 with…', exclude: 42 });
    expect(whereTheWindowIs().pages).toEqual([{ kind: 'diff', title: 'Changesets 7 → 42', target: { kind: 'range', fromSpec: 'cs:7', toSpec: 'cs:42' } }]);
  });

  it('opens nothing when the picker is dismissed', async () => {
    await diffWithAnotherChangeset({ id: 42 });

    expect(whereTheWindowIs().pages).toEqual([]);
  });
});

import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({ picked: undefined as number | undefined, picker: [] as unknown[], dialogs: [] as unknown[][] }));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));
vi.mock('../changesets/ChangesetPickerDialog', () => ({
  pickChangeset: async (options: unknown) => {
    asked.picker.push(options);
    return asked.picked;
  },
}));
vi.mock('./CreateLabelDialog', () => ({ openCreateLabelDialog: (...args: unknown[]) => void asked.dialogs.push(args) }));

import type { LabelInfo } from '@shared/domain/label';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { answerConfirms, answerPrompts } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { deleteLabels, diffLabels, newLabel, newLabelActionLabel, renameLabel, saveLabelComment } from './labelOperations';

const ws = '/ws';
const inWs = workspacePlace(ws);
const label = (name: string, changeset = 12): LabelInfo => ({ name, changeset, branch: '/main', comment: '', owner: 'ana', date: '', repository: 'game@local' });

beforeEach(() => {
  asked.picked = undefined;
  asked.picker.length = 0;
  asked.dialogs.length = 0;
});

describe('label operations', () => {
  it('renames to the name typed, refreshing the labels, the graph and the workspace info only', async () => {
    answerPrompts('v2.0');
    fakeApi.answer('labels.rename', () => undefined);
    const refreshed = watchRefreshes(ws);

    await renameLabel(inWs, label('v1.0'));

    expect(fakeApi.argsOf('labels.rename')).toEqual([[inWs, 'v1.0', 'v2.0']]);
    expect(refreshed()).toEqual(['branchExplorer', 'info', 'labels']);
  });

  it('renames nothing when the prompt is cancelled', async () => {
    await renameLabel(inWs, label('v1.0'));

    expect(fakeApi.methods()).toEqual([]);
  });

  it('deletes every label picked at once, and says so', async () => {
    fakeApi.answer('labels.delete', () => undefined);
    const refreshed = watchRefreshes(ws);

    await deleteLabels(inWs, [label('v1.0'), label('v1.1')]);

    expect(fakeApi.argsOf('labels.delete')).toEqual([[inWs, ['v1.0', 'v1.1']]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Deleted 2 labels' }]);
    expect(refreshed()).toEqual(['branchExplorer', 'info', 'labels']);
  });

  it('deletes nothing unless confirmed', async () => {
    answerConfirms(false);

    await deleteLabels(inWs, [label('v1.0')]);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('reports a failed delete instead of a success', async () => {
    fakeApi.answer('labels.delete', () => {
      throw commandFailure('The label is in use');
    });

    await deleteLabels(inWs, [label('v1.0')]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the label", detail: 'The label is in use' }]);
  });

  it('tells whether a comment was saved, so an unsaved one stays in its editor', async () => {
    fakeApi.answer('labels.editComment', () => {
      throw new Error('offline');
    });
    expect(await saveLabelComment(inWs, label('v1.0'), 'Release')).toBe(false);

    fakeApi.answer('labels.editComment', () => undefined);
    expect(await saveLabelComment(inWs, label('v1.0'), 'Release')).toBe(true);
  });

  it('compares two labels with the older one on the left, whichever was picked first', () => {
    diffLabels(label('v2.0', 30), label('v1.0', 12));

    expect(whereTheWindowIs().pages).toEqual([{ kind: 'diff', title: 'v1.0 → v2.0', target: { kind: 'range', fromSpec: 'lb:v1.0', toSpec: 'lb:v2.0' } }]);
  });
});

describe('a new label', () => {
  it("labels what the workspace has loaded, asking nothing first", async () => {
    await newLabel(inWs);

    expect(asked.picker).toEqual([]);
    expect(asked.dialogs).toEqual([[inWs]]);
    expect(newLabelActionLabel(inWs)).toBe('Label your workspace changeset');
  });

  it('asks which changeset first in a repository with no workspace, and labels nothing when none is picked', async () => {
    const repository = repositoryPlace('game@local');

    await newLabel(repository);
    expect(asked.dialogs).toEqual([]);

    asked.picked = 42;
    await newLabel(repository);
    expect(asked.picker).toEqual([{ title: 'Label a changeset' }, { title: 'Label a changeset' }]);
    expect(asked.dialogs).toEqual([[repository, 42]]);
    expect(newLabelActionLabel(repository)).toBe('Label a changeset');
  });
});

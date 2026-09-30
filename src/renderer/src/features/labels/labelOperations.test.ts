import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogs = vi.hoisted(() => ({ confirmed: true, typed: undefined as string | undefined }));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => dialogs.confirmed }));
vi.mock('../../ui/dialog/prompt', () => ({ prompt: async () => dialogs.typed }));

import type { LabelInfo } from '@shared/domain/label';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { deleteLabels, renameLabel, saveLabelComment } from './labelOperations';

const ws = '/ws';
const label = (name: string): LabelInfo => ({ name, changeset: 12, branch: '/main', comment: '', owner: 'ana', date: '', repository: 'game@local' });

beforeEach(() => {
  dialogs.confirmed = true;
  dialogs.typed = undefined;
});

describe('label operations', () => {
  it('renames to the name typed, refreshing the labels, the graph and the workspace info only', async () => {
    dialogs.typed = 'v2.0';
    fakeApi.answer('labels.rename', () => undefined);
    const refreshed = watchRefreshes(ws);

    await renameLabel(ws, label('v1.0'));

    expect(fakeApi.argsOf('labels.rename')).toEqual([[ws, 'v1.0', 'v2.0']]);
    expect(refreshed()).toEqual(['branchExplorer', 'info', 'labels']);
  });

  it('renames nothing when the prompt is cancelled', async () => {
    await renameLabel(ws, label('v1.0'));

    expect(fakeApi.methods()).toEqual([]);
  });

  it('deletes every label picked at once, and says so', async () => {
    fakeApi.answer('labels.delete', () => undefined);
    const refreshed = watchRefreshes(ws);

    await deleteLabels(ws, [label('v1.0'), label('v1.1')]);

    expect(fakeApi.argsOf('labels.delete')).toEqual([[ws, ['v1.0', 'v1.1']]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Deleted 2 labels' }]);
    expect(refreshed()).toEqual(['branchExplorer', 'info', 'labels']);
  });

  it('deletes nothing unless confirmed', async () => {
    dialogs.confirmed = false;

    await deleteLabels(ws, [label('v1.0')]);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('reports a failed delete instead of a success', async () => {
    fakeApi.answer('labels.delete', () => {
      throw commandFailure('The label is in use');
    });

    await deleteLabels(ws, [label('v1.0')]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the label", detail: 'The label is in use' }]);
  });

  it('tells whether a comment was saved, so an unsaved one stays in its editor', async () => {
    fakeApi.answer('labels.editComment', () => {
      throw new Error('offline');
    });
    expect(await saveLabelComment(ws, label('v1.0'), 'Release')).toBe(false);

    fakeApi.answer('labels.editComment', () => undefined);
    expect(await saveLabelComment(ws, label('v1.0'), 'Release')).toBe(true);
  });
});

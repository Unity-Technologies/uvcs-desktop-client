import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));

import type { LabelInfo } from '@shared/domain/label';
import { answerConfirms, answerPrompts } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { deleteLabels, diffLabels, renameLabel, saveLabelComment } from './labelOperations';

const ws = '/ws';
const label = (name: string, changeset = 12): LabelInfo => ({ name, changeset, branch: '/main', comment: '', owner: 'ana', date: '', repository: 'game@local' });

describe('label operations', () => {
  it('renames to the name typed, refreshing the labels, the graph and the workspace info only', async () => {
    answerPrompts('v2.0');
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
    answerConfirms(false);

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

  it('compares two labels with the older one on the left, whichever was picked first', () => {
    diffLabels(label('v2.0', 30), label('v1.0', 12));

    expect(whereTheWindowIs().pages).toEqual([{ kind: 'diff', title: 'v1.0 → v2.0', target: { kind: 'range', fromSpec: 'lb:v1.0', toSpec: 'lb:v2.0' } }]);
  });
});

import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { revertItemTo } from './revisionOperations';

const ws = '/ws';

describe('reverting a file to a revision', () => {
  it("loads the changeset's version as a pending change, refreshing only the workspace and its locks", async () => {
    fakeApi.answer('history.revertTo', () => undefined);
    const refreshed = watchRefreshes(ws);

    await revertItemTo(ws, 'src/a.ts', 41);

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Revert src/a.ts to changeset 41?' }]);
    expect(fakeApi.argsOf('history.revertTo')).toEqual([[ws, ['src/a.ts'], 41]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Reverted src/a.ts', detail: 'Content from changeset 41 is now a pending change.' }]);
    expect(refreshed()).toEqual(['explorer', 'info', 'locks', 'pendingChanges', 'review']);
  });

  it("takes an asset's Unity .meta along, after one confirmation that names it", async () => {
    fakeApi.answer('history.revertTo', () => undefined);

    await revertItemTo(ws, 'Assets/a.png', 41, { metaPath: 'Assets/a.png.meta' });

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Revert Assets/a.png and its .meta to changeset 41?' }]);
    expect(fakeApi.argsOf('history.revertTo')).toEqual([[ws, ['Assets/a.png', 'Assets/a.png.meta'], 41]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Reverted Assets/a.png and its .meta', detail: 'Content from changeset 41 is now a pending change.' }]);
  });

  it('reverts nothing unless confirmed', async () => {
    answerConfirms(false);

    await revertItemTo(ws, 'src/a.ts', 41);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('says why a revert failed', async () => {
    fakeApi.answer('history.revertTo', () => {
      throw commandFailure('The item src/a.ts must be checked in');
    });

    await revertItemTo(ws, 'src/a.ts', 41);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't revert the file", detail: 'The item src/a.ts must be checked in' }]);
  });
});

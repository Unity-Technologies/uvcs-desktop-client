import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { shownToasts } from '../../testing/operationOutcome';
import { noteBrokenWatch } from './watchNotes';

describe('noteBrokenWatch', () => {
  it('tells once per workspace, as an error in plain words, that changes made elsewhere no longer show by themselves', () => {
    noteBrokenWatch('/wk/broken-game');
    noteBrokenWatch('/wk/broken-game');

    expect(shownToasts()).toEqual([
      {
        kind: 'error',
        title: 'Stopped watching this workspace for changes',
        detail: 'Changes made outside the app show when you come back to this window, or with Refresh.',
      },
    ]);
  });
});

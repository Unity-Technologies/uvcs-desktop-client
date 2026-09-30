import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { REVEAL_LABEL } from '../../lib/platform';
import { pressToastAction, shownToasts } from '../../testing/operationOutcome';
import { noteKeptAside } from './keptAsideNotice';

const kept = (path: string) => ({ path, savedAt: `/data/shelve-backups/sh5/${path}` });

describe('noteKeptAside', () => {
  it('names the file kept in the app data folder, and reveals the copy', async () => {
    fakeApi.answer('system.revealInFileManager', () => undefined);

    noteKeptAside([kept('src/Player.cs')]);

    expect(shownToasts()).toEqual([
      {
        kind: 'info',
        title: 'Kept your copy of Player.cs',
        detail: "Another item is at src/Player.cs now, so yours is in the app's data folder.",
        action: REVEAL_LABEL,
      },
    ]);
    pressToastAction('Kept your copy of Player.cs');
    expect(fakeApi.argsOf('system.revealInFileManager')).toEqual([['/data/shelve-backups/sh5/src/Player.cs']]);
  });

  it('names a few of several files', () => {
    noteKeptAside(['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt'].map(kept));

    expect(shownToasts()).toEqual([
      {
        kind: 'info',
        title: 'Kept your copies of 5 files',
        detail: "Other items are at a.txt, b.txt, c.txt and 2 more now, so yours are in the app's data folder.",
        action: REVEAL_LABEL,
      },
    ]);
  });
});

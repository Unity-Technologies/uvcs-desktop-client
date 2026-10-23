import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import type { DiffEntry } from '@shared/domain/diff';
import { useShownDiffFile } from '../../features/diff/shownDiffFile';
import { diffEntriesKey } from '../../features/diff/useDiffEntries';
import { useNavigation } from '../navigation/navigationStore';
import type { Page } from '../navigation/pages';
import { queryClient } from '../queryClient';
import { useSession } from '../workspace/sessionStore';
import { movePageToNewWindow } from './openInNewWindow';

const WORKSPACE = '/work/game';
const TARGET = { kind: 'changeset', changesetId: 10 } as const;
const DIFF: Page = { kind: 'diff', title: 'Changeset 10', target: TARGET };
const PLAYER: DiffEntry = { status: 'changed', path: 'src/player.cs', itemType: 'file', baseRevisionId: 13, revisionId: 37, repository: 'game@local' };

beforeEach(() => {
  useSession.setState({ workspacePath: WORKSPACE });
  useNavigation.setState({ view: 'changesets', pages: [DIFF] });
  fakeApi.answer('windows.openPage', () => undefined);
});
afterEach(() => {
  useSession.setState({ workspacePath: null });
  useShownDiffFile.setState({ shown: null });
  queryClient.clear();
});

describe('moving a page to a new window', () => {
  it('opens it there on the file being read, with the files already read, and goes back to what was under it', () => {
    queryClient.setQueryData(diffEntriesKey(workspacePlace(WORKSPACE), TARGET), [PLAYER]);
    useShownDiffFile.setState({ shown: { target: TARGET, path: 'src/player.cs' } });

    movePageToNewWindow(DIFF);

    expect(fakeApi.argsOf('windows.openPage')).toEqual([
      [{ place: workspacePlace(WORKSPACE), page: { ...DIFF, focusPath: 'src/player.cs' }, diff: { target: TARGET, entries: [PLAYER] } }],
    ]);
    expect(useNavigation.getState().pages).toEqual([]);
  });

  it("keeps the file it opened on when the diff on screen is another one's", () => {
    useShownDiffFile.setState({ shown: { target: { kind: 'changeset', changesetId: 11 }, path: 'src/enemy.cs' } });

    movePageToNewWindow(DIFF);

    expect(fakeApi.argsOf('windows.openPage')).toEqual([[{ place: workspacePlace(WORKSPACE), page: DIFF }]]);
  });
});

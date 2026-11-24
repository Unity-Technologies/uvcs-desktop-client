import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigation, useNavigation } from '../navigation/navigationStore';
import type { Page } from '../navigation/pages';
import { pageWindowGoBack } from './pageWindowNavigation';
import { usePageWindow } from './pageWindowStore';

const DIFF: Page = { kind: 'diff', title: 'Changeset 7', target: { kind: 'changeset', changesetId: 7 } };
const HISTORY: Page = { kind: 'history', path: 'src/player.cs' };
const MERGE: Page = { kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:7' } };

beforeEach(() => {
  usePageWindow.setState({ isPageWindow: true });
  useNavigation.setState({ view: 'changes', pages: [DIFF] });
  fakeApi.answer('windows.showWorkspaceWindow', () => undefined);
  fakeApi.answer('windows.openPageInWorkspaceWindow', () => undefined);
});
afterEach(() => {
  usePageWindow.setState({ isPageWindow: false });
  vi.restoreAllMocks();
});

describe('a page window', () => {
  it("never goes blank for a view its page goes to: its workspace window comes forward on the view's list", () => {
    // A link or Show in Locks: the list, which shows what it asks for, never the pages that view was left with.
    navigation.goToView('branchExplorer');

    expect(fakeApi.argsOf('windows.showWorkspaceWindow')).toEqual([['goto.branchExplorer.list']]);
    expect(useNavigation.getState().pages).toEqual([DIFF]);
  });

  it('returns its workspace window to a view as the user left it, for the view shortcut (⌘1…)', () => {
    navigation.returnToView('branchExplorer');

    expect(fakeApi.argsOf('windows.showWorkspaceWindow')).toEqual([['goto.branchExplorer']]);
  });

  it('opens a history within it, and a merge in its workspace window', () => {
    navigation.openPage(HISTORY);
    navigation.openPage(MERGE);

    expect(useNavigation.getState().pages).toEqual([DIFF, HISTORY]);
    expect(fakeApi.argsOf('windows.openPageInWorkspaceWindow')).toEqual([[MERGE]]);
  });

  it('closes when its page goes back past the one it opened on (a deleted review); its back button stops there', () => {
    // The test's window has no `close` of its own.
    const close = vi.fn();
    Object.assign(window, { close });

    pageWindowGoBack();
    expect(close).not.toHaveBeenCalled();
    navigation.goBack();
    expect(close).toHaveBeenCalledOnce();
    expect(useNavigation.getState().pages).toEqual([DIFF]);
  });
});

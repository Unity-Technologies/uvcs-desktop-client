import '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The results' menus import feature modules that read the platform as they load.

import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { Shelve } from '@shared/domain/shelve';
import { useFilesViewStore } from '../../features/files/filesViewStore';
import { changeStatus } from '../../features/pendingChanges/changeTone';
import { isSubmenu, type Action, type MenuEntry } from '../../lib/actions';
import { navigation } from '../navigation/navigationStore';
import { branchResult, changesetResult, fileResult, shelveResult, type ResultContext } from './objectResults';

const change: PendingChange = { path: 'src/app.ts', kinds: ['changed'], itemType: 'file', size: 1, lastModified: '2026-01-01T00:00:00Z' };
const branch: Branch = { id: 3, name: '/main/task', guid: 'g', parent: '/main', comment: '', owner: 'ana', date: '2026-01-01T00:00:00Z', headChangeset: 5, repository: 'repo@server' };
const changeset = (comment: string): Changeset => ({ id: 12, comment, guid: 'c', branch: '/main', owner: 'ana', date: '2026-01-01T00:00:00Z', parent: 11, repository: 'repo@server' });
const shelve = (comment: string): Shelve => ({ id: 4, comment, guid: 's', owner: 'ana', date: '2026-01-01T00:00:00Z', parentChangeset: 1, repository: 'repo@server' });

function contextFor(term: string, changes: PendingChange[] = []): ResultContext {
  return { workspacePath: '/ws', term, currentBranch: '/main', loadedChangeset: 1, changelists: [], changeAt: (path) => changes.find((candidate) => candidate.path === path) };
}

function actionIn(menu: MenuEntry[], id: string): Action | undefined {
  return menu.find((entry): entry is Action => typeof entry === 'object' && !isSubmenu(entry) && entry.id === id);
}

afterEach(() => {
  vi.restoreAllMocks();
  useFilesViewStore.setState({ revealRequest: null });
});

describe('fileResult', () => {
  it('shows the name with its folder after it, marking in each the letters that matched', () => {
    const result = fileResult({ path: 'src/app.ts', isDirectory: false }, contextFor('sapp'));

    expect(result).toMatchObject({ label: 'app.ts', detail: 'src', labelMatches: [0, 1, 2], detailMatches: [0] });
  });

  it('shows no folder for a file at the workspace root', () => {
    expect(fileResult({ path: 'README.md', isDirectory: false }, contextFor('')).detail).toBe('');
  });

  it('wears the status letter of its pending change, if it has one', () => {
    const withChange = fileResult({ path: 'src/app.ts', isDirectory: false }, contextFor('', [change]));
    const withoutChange = fileResult({ path: 'src/other.ts', isDirectory: false }, contextFor('', [change]));

    expect(withChange.status).toEqual({ tone: changeStatus(change).tone, title: changeStatus(change).label });
    expect(withoutChange.status).toBeUndefined();
  });

  it('shows the file in the Files view when run, as its menu’s “Show in Files” does', () => {
    const goToView = vi.spyOn(navigation, 'goToView').mockImplementation(() => {});
    const result = fileResult({ path: 'src/app.ts', isDirectory: false }, contextFor(''));

    for (const run of [result.run, actionIn(result.menu!(), 'showInFiles')!.run]) {
      goToView.mockClear();
      useFilesViewStore.setState({ revealRequest: null });
      run();
      expect(goToView).toHaveBeenCalledWith('files');
      expect(useFilesViewStore.getState().revealRequest).toEqual({ path: 'src/app.ts', selected: undefined });
    }
  });
});

describe('branchResult', () => {
  it('marks the branch the workspace is on', () => {
    expect(branchResult({ ...branch, name: '/main' }, contextFor('')).isCurrent).toBe(true);
    expect(branchResult(branch, contextFor('')).isCurrent).toBe(false);
  });

  it('marks what the server matched by the words typed, not fuzzily', () => {
    expect(branchResult(branch, contextFor('task'), 'words').labelMatches).toEqual([6, 7, 8, 9]);
  });
});

describe('changeset and shelve results', () => {
  it('show the comment’s first line, or say there is none', () => {
    expect(changesetResult(changeset('Fix the crash\n\nDetails'), contextFor('')).label).toBe('Fix the crash');
    expect(shelveResult(shelve('  '), contextFor('')).label).toBe('(no comment)');
  });

  it('mark in the detail only a number typed, in the leading spec (never the owner, the date or a letter of “cs”)', () => {
    expect(changesetResult(changeset('Fix'), contextFor('12')).detailMatches).toEqual([3, 4]);
    expect(changesetResult(changeset('Fix'), contextFor('cs ana')).detailMatches).toEqual([]);
    expect(shelveResult(shelve('Fix'), contextFor('sh:4')).detailMatches).toEqual([0, 1, 2, 3]);
  });
});

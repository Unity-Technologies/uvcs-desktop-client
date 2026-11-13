import { commandFailure, fakeApi } from '../../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { workspaceInfoQuery } from '../../../app/workspace/useWorkspace';
import { shownToasts, watchRefreshes } from '../../../testing/operationOutcome';
import { applySuggestionToChanges, checkInSuggestion, type SuggestionWrite } from './applySuggestion';

const ws = '/ws';
const PATH = 'Assets/Scripts/Settings.cs';
const BEFORE = 'class Settings\r\n{\r\n    int Timeout = 30;\r\n}\r\n';
const AFTER = 'class Settings\r\n{\r\n    int Timeout = 60;\r\n}\r\n';
const WRITE: SuggestionWrite = { workspacePath: ws, path: PATH, text: BEFORE, firstLine: 3, lastLine: 3, lines: ['    int Timeout = 60;'] };
const COMMENT = 'Apply suggestion from Ana [apply-change:c0d1ce00]';
const CHANGED: PendingChange = { path: PATH, kinds: ['changed'], itemType: 'file', size: 50, lastModified: '' };

/** The workspace's file on disk, as the main process reads and writes it. */
let disk: string;

beforeEach(() => {
  queryClient.clear();
  disk = BEFORE;
  queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
  const info: WorkspaceInfo = { name: 'ws', path: ws, repository: 'game@local', repositoryName: 'game', server: 'local', selector: { kind: 'branch', name: '/main/task' }, loadedChangeset: 41 };
  queryClient.setQueryData(workspaceInfoQuery(ws).queryKey, info);
  fakeApi.answer('content.read', (): FileContent => ({ text: disk, isBinary: false, size: disk.length }));
  fakeApi.answer('content.writeWorkspaceFile', (_workspace: string, _path: string, text: string) => void (disk = text));
  fakeApi.answer('pendingChanges.list', (): PendingChangesSnapshot => ({ changes: disk === BEFORE ? [] : [CHANGED] }) as PendingChangesSnapshot);
  fakeApi.answer('settings.rememberRecentComment', () => DEFAULT_SETTINGS);
});

describe('applySuggestionToChanges', () => {
  it('writes the suggested line into the file, its line ends kept, and checks nothing in', async () => {
    expect(await applySuggestionToChanges(WRITE)).toBe(true);

    expect(disk).toBe(AFTER);
    expect(fakeApi.methods()).not.toContain('pendingChanges.checkin');
    expect(shownToasts()).toMatchObject([{ kind: 'success', title: 'Suggestion applied to Settings.cs', detail: 'Check it in from Changes, which offers its change request to apply.' }]);
  });

  it('writes nothing when the file changed since it was read', async () => {
    disk = BEFORE.replace('Settings', 'Options');

    expect(await applySuggestionToChanges(WRITE)).toBe(false);

    expect(fakeApi.methods()).not.toContain('content.writeWorkspaceFile');
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Settings.cs changed since', detail: 'Nothing was written: look at the suggestion again.' }]);
  });

  it('says so when the file can\'t be written (read-only, locked by another app)', async () => {
    fakeApi.answer('content.writeWorkspaceFile', () => {
      throw new Error('EPERM: operation not permitted');
    });

    expect(await applySuggestionToChanges(WRITE)).toBe(false);
    expect(shownToasts()).toMatchObject([{ kind: 'error', title: "Couldn't write Settings.cs" }]);
  });

  it('refreshes what shows the workspace\'s files', async () => {
    const refreshed = watchRefreshes(ws);
    await applySuggestionToChanges(WRITE);
    expect(refreshed()).toContain('pendingChanges');
  });
});

describe('checkInSuggestion', () => {
  it('writes the line, then checks in that file alone with the comment naming the change request', async () => {
    fakeApi.answer('pendingChanges.checkin', () => ({ kind: 'created', changesetId: 44, branch: '/main/task' }));

    expect(await checkInSuggestion(WRITE, COMMENT)).toBe(true);

    expect(disk).toBe(AFTER);
    expect(fakeApi.argsOf('pendingChanges.checkin')[0]!.slice(0, 2)).toEqual([ws, { paths: [PATH], comment: COMMENT, addsPrivate: false }]);
  });

  it('refreshes the reviews too, as the check-in applies the change request', async () => {
    fakeApi.answer('pendingChanges.checkin', () => ({ kind: 'created', changesetId: 44, branch: '/main/task' }));
    const refreshed = watchRefreshes(ws);

    await checkInSuggestion(WRITE, COMMENT);

    expect(refreshed()).toContain('codeReviews');
  });

  it('leaves the suggestion in the changes when the check-in fails, and says so', async () => {
    fakeApi.answer('pendingChanges.checkin', () => {
      throw commandFailure('The item is locked by another user', 'cm checkin');
    });

    expect(await checkInSuggestion(WRITE, COMMENT)).toBe(false);

    expect(disk).toBe(AFTER);
    expect(shownToasts()).toContainEqual({ kind: 'info', title: 'The suggestion stays in your changes', detail: 'Settings.cs has it: check it in from Changes.' });
  });

  it('checks nothing in when the file changed since it was read', async () => {
    disk = 'other';

    expect(await checkInSuggestion(WRITE, COMMENT)).toBe(false);
    expect(fakeApi.methods()).toEqual(['content.read']);
  });
});

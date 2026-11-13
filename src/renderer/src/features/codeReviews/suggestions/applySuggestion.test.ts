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
import type { SuggestedChange } from './suggestedChange';

const ws = '/ws';
const PATH = 'Assets/Scripts/Settings.cs';
const BEFORE = 'class Settings\r\n{\r\n    int Timeout = 30;\r\n}\r\n';
const AFTER = 'class Settings\r\n{\r\n    int Timeout = 60;\r\n}\r\n';
const CHANGE: SuggestedChange = { path: PATH, revisionId: 37, firstLine: 3, lastLine: 3, lines: ['    int Timeout = 60;'] };
const WRITE: SuggestionWrite = { workspacePath: ws, change: CHANGE, commentedText: BEFORE };
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

  it('writes nothing when the line was edited after the button showed, saying why as the button would', async () => {
    disk = BEFORE.replace('30', '45');

    expect(await applySuggestionToChanges(WRITE)).toBe(false);

    expect(fakeApi.methods()).not.toContain('content.writeWorkspaceFile');
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Nothing was written to Settings.cs', detail: 'Line 3 changed since the suggestion was written' }]);
  });

  it('writes at the line where it is now, when lines were added above it since', async () => {
    disk = `// Settings\r\n${BEFORE}`;

    expect(await applySuggestionToChanges(WRITE)).toBe(true);
    expect(disk).toBe(`// Settings\r\n${AFTER}`);
  });

  it('replaces a range of lines, checked whole', async () => {
    const block: SuggestedChange = { ...CHANGE, firstLine: 2, lastLine: 4, lines: ['{ int Timeout = 60; }'] };
    expect(await applySuggestionToChanges({ ...WRITE, change: block })).toBe(true);
    expect(disk).toBe('class Settings\r\n{ int Timeout = 60; }\r\n');

    disk = BEFORE.replace('}', '} // end');
    expect(await applySuggestionToChanges({ ...WRITE, change: block })).toBe(false);
    expect(shownToasts().at(-1)).toEqual({ kind: 'info', title: 'Nothing was written to Settings.cs', detail: 'Lines 2–4 changed since the suggestion was written' });
  });

  it("writes nothing when the file isn't there any more", async () => {
    fakeApi.answer('content.read', () => {
      throw new Error('ENOENT');
    });

    expect(await applySuggestionToChanges(WRITE)).toBe(false);
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Nothing was written to Settings.cs', detail: "Settings.cs isn't in your workspace" }]);
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
    // One fresh read of the pending changes before writing; the comment isn't kept among the recent ones.
    expect(fakeApi.methods()).toEqual(['pendingChanges.list', 'content.read', 'content.writeWorkspaceFile', 'pendingChanges.checkin']);
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

  it('writes and checks in nothing when the file got other changes after the button showed', async () => {
    disk = `${BEFORE}// more\r\n`;

    expect(await checkInSuggestion(WRITE, COMMENT)).toBe(false);

    expect(fakeApi.methods()).toEqual(['pendingChanges.list']);
    expect(shownToasts()).toEqual([
      { kind: 'info', title: 'Nothing was written to Settings.cs', detail: 'Settings.cs has other changes, which a check-in of it would take too: apply it to your changes' },
    ]);
  });

  it('reads the pending changes afresh, not as the window last saw them', async () => {
    queryClient.setQueryData([...queryKeys.inWorkspace(ws, 'pendingChanges'), DEFAULT_SETTINGS.pendingChanges], { changes: [] });
    disk = `${BEFORE}// more\r\n`;

    expect(await checkInSuggestion(WRITE, COMMENT)).toBe(false);
    expect(fakeApi.methods()).not.toContain('content.writeWorkspaceFile');
  });
});

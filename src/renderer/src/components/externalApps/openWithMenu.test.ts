import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExternalApp, ExternalApps } from '@shared/domain/externalApps';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { isSubmenu, SEPARATOR, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import { shownToasts } from '../../testing/operationOutcome';
import { NO_EXTERNAL_APPS } from './externalApps';
import { openOnDiskEntries, openRevisionWithSubmenu } from './openWithMenu';

const app = (id: string, name: string, opensFolders = true): ExternalApp => ({ id, name, origin: 'known', location: `/Applications/${name}.app`, opensFolders });
const APPS: ExternalApps = {
  editors: [app('vscode', 'Visual Studio Code'), app('rider', 'JetBrains Rider'), app('notepad', 'Notepad++', false)],
  terminals: [app('terminal', 'Terminal'), app('iterm', 'iTerm')],
  editorId: 'rider',
  terminalId: 'iterm',
};
const FILE = { path: '/wk/game/src/player.cs', isFolder: false };
const FOLDER = { path: '/wk/game/src', isFolder: true };

/** What a menu reads as: each entry's label and detail, a submenu's entries indented. */
function reading(entries: MenuEntry[], indent = ''): string[] {
  return entries.flatMap((entry) => {
    if (entry === SEPARATOR) return [`${indent}---`];
    const line = `${indent}${entry.label}${'detail' in entry && entry.detail ? ` (${entry.detail})` : ''}`;
    return isSubmenu(entry) ? [line, ...reading(entry.entries, `${indent}  `)] : [line];
  });
}

const entryNamed = (entries: MenuEntry[], label: string): Action | Submenu =>
  entries.flatMap((entry) => (entry === SEPARATOR ? [] : isSubmenu(entry) ? [entry, ...entry.entries] : [entry])).find((entry) => entry !== SEPARATOR && entry.label === label) as Action | Submenu;

const settle = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => queryClient.clear());

describe('openOnDiskEntries', () => {
  it("offers a file with every editor, the user's first and marked, then in the file manager: its menu's Open is the default app", () => {
    expect(reading(openOnDiskEntries(FILE, APPS))).toEqual([
      'Open with',
      '  Visual Studio Code',
      '  JetBrains Rider (default)',
      '  Notepad++',
      '  ---',
      '  Other app…',
      'Reveal in Finder',
    ]);
  });

  it("offers a folder in the user's editor and terminal, then with every app that opens folders", () => {
    expect(reading(openOnDiskEntries(FOLDER, APPS))).toEqual([
      'Open in JetBrains Rider',
      'Open in iTerm',
      'Open with',
      '  Visual Studio Code',
      '  JetBrains Rider (default)',
      '  ---',
      '  Terminal',
      '  iTerm (default)',
      '  ---',
      '  Other app…',
      'Reveal in Finder',
    ]);
  });

  it("doesn't offer a folder to an editor that would open every file in it", () => {
    const apps = { ...APPS, editorId: 'notepad' };
    expect(reading(openOnDiskEntries(FOLDER, apps)).slice(0, 2)).toEqual(['Open in iTerm', 'Open with']);
    expect(reading(openOnDiskEntries(FILE, apps))).toContain('  Notepad++ (default)');
  });

  it('still opens a terminal, and offers another app, before any app was found', () => {
    expect(reading(openOnDiskEntries(FOLDER, NO_EXTERNAL_APPS))).toEqual(['Open in terminal', 'Open with', '  Other app…', 'Reveal in Finder']);
  });

  it('opens the item in the app picked, the default one when the entry names no other', async () => {
    fakeApi.answer('apps.openInEditor', () => undefined);
    fakeApi.answer('apps.openInTerminal', () => undefined);
    fakeApi.answer('system.revealInFileManager', () => undefined);
    const entries = openOnDiskEntries(FOLDER, APPS);

    for (const label of ['Open in JetBrains Rider', 'Visual Studio Code', 'Open in iTerm', 'Terminal', 'Reveal in Finder']) (entryNamed(entries, label) as Action).run();
    await settle();

    expect(fakeApi.calls()).toEqual([
      { method: 'apps.openInEditor', args: [FOLDER.path, 'rider'] },
      { method: 'apps.openInEditor', args: [FOLDER.path, 'vscode'] },
      { method: 'apps.openInTerminal', args: [FOLDER.path, undefined] },
      { method: 'apps.openInTerminal', args: [FOLDER.path, 'terminal'] },
      { method: 'system.revealInFileManager', args: [FOLDER.path] },
    ]);
  });

  it('says why when the app could not open it', async () => {
    fakeApi.answer('apps.openInEditor', () => {
      throw new Error("That app isn't installed anymore.");
    });
    (entryNamed(openOnDiskEntries(FILE, APPS), 'Visual Studio Code') as Action).run();
    await settle();
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't open it", detail: "That app isn't installed anymore." }]);
  });

  it('adds another app the user picks, offered from then on, and opens the item in it', async () => {
    queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
    fakeApi.answer('apps.pickProgram', () => '/Applications/Sublime Text.app');
    fakeApi.answer('settings.update', (changes: Partial<AppSettings>) => ({ ...DEFAULT_SETTINGS, ...changes }));
    fakeApi.answer('apps.openInEditor', () => undefined);

    (entryNamed(openOnDiskEntries(FILE, APPS), 'Other app…') as Action).run();
    await settle();

    const [[saved]] = fakeApi.argsOf('settings.update') as [[Partial<AppSettings>]];
    expect(saved.customEditors).toEqual([{ id: expect.stringMatching(/^custom:/), name: 'Sublime Text', executable: '/Applications/Sublime Text.app' }]);
    expect(fakeApi.argsOf('apps.openInEditor')).toEqual([[FILE.path, saved.customEditors![0]!.id]]);
  });

  it('opens an app picked again with the one already added, and nothing when the user cancels', async () => {
    const mine = { id: 'custom:1', name: 'Mine', executable: '/opt/mine' };
    queryClient.setQueryData(queryKeys.settings, { ...DEFAULT_SETTINGS, customEditors: [mine] });
    fakeApi.answer('apps.pickProgram', () => '/opt/mine');
    fakeApi.answer('apps.openInEditor', () => undefined);
    (entryNamed(openOnDiskEntries(FILE, APPS), 'Other app…') as Action).run();
    await settle();
    expect(fakeApi.argsOf('apps.openInEditor')).toEqual([[FILE.path, 'custom:1']]);

    fakeApi.answer('apps.pickProgram', () => null);
    (entryNamed(openOnDiskEntries(FILE, APPS), 'Other app…') as Action).run();
    await settle();
    expect(fakeApi.methods().filter((method) => method === 'apps.openInEditor')).toHaveLength(1);
  });
});

describe('openRevisionWithSubmenu', () => {
  it('opens a revision with any editor, or another app', async () => {
    const opened: string[] = [];
    const submenu = openRevisionWithSubmenu(async (editorId) => void opened.push(editorId), APPS);
    expect(reading([submenu])).toEqual(['Open this revision with', '  Visual Studio Code', '  JetBrains Rider (default)', '  Notepad++', '  ---', '  Other app…']);
    (entryNamed(submenu.entries, 'Visual Studio Code') as Action).run();
    await settle();
    expect(opened).toEqual(['vscode']);
  });
});

import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExternalApp, ExternalApps } from '@shared/domain/externalApps';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { isSubmenu, SEPARATOR, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import { shownToasts } from '../../testing/operationOutcome';
import { NO_EXTERNAL_APPS } from './externalApps';
import { openOnDiskEntries, openRevisionEntries } from './openWithMenu';

const app = (id: string, name: string, opensFolders = true): ExternalApp => ({ id, name, origin: 'known', location: `/Applications/${name}.app`, opensFolders });
const APPS: ExternalApps = {
  editors: [app('vscode', 'Visual Studio Code'), app('rider', 'JetBrains Rider'), app('notepad', 'Notepad++', false)],
  terminals: [app('terminal', 'Terminal'), app('iterm', 'iTerm')],
  editorId: 'rider',
  terminalId: 'iterm',
};
/** The user opens each file with its default app: no editor. */
const DEFAULT_APPS: ExternalApps = { ...APPS, editorId: null };
const FILE = { path: '/wk/game/src/player.cs', isFolder: false };
const FOLDER = { path: '/wk/game/src', isFolder: true };

/** What a menu reads as: each entry's label, a submenu's entries indented. */
function reading(entries: MenuEntry[], indent = ''): string[] {
  return entries.flatMap((entry) => {
    if (entry === SEPARATOR) return [`${indent}---`];
    return isSubmenu(entry) ? [`${indent}${entry.label}`, ...reading(entry.entries, `${indent}  `)] : [`${indent}${entry.label}`];
  });
}

const entryNamed = (entries: MenuEntry[], label: string): Action | Submenu =>
  entries.flatMap((entry) => (entry === SEPARATOR ? [] : isSubmenu(entry) ? [entry, ...entry.entries] : [entry])).find((entry) => entry !== SEPARATOR && entry.label === label) as Action | Submenu;

const run = (entries: MenuEntry[], label: string): void => (entryNamed(entries, label) as Action).run();
const settle = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => queryClient.clear());

describe('openOnDiskEntries', () => {
  it("opens a file in the user's editor first, then with any editor or its default app, then in the file manager", () => {
    expect(reading(openOnDiskEntries(FILE, APPS))).toEqual([
      'Open in JetBrains Rider',
      'Open with',
      '  Visual Studio Code',
      '  JetBrains Rider (default)',
      '  Notepad++',
      '  ---',
      '  Default app',
      '  ---',
      '  Choose another app…',
      '  Manage apps…',
      'Reveal in Finder',
    ]);
  });

  it('opens a file plainly with its default app when the user has no editor, and offers every editor', () => {
    expect(reading(openOnDiskEntries(FILE, DEFAULT_APPS))).toEqual([
      'Open',
      'Open with',
      '  Visual Studio Code',
      '  JetBrains Rider',
      '  Notepad++',
      '  ---',
      '  Choose another app…',
      '  Manage apps…',
      'Reveal in Finder',
    ]);
  });

  it("opens a folder in the user's editor and terminal, then with every app that opens folders", () => {
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
      '  Choose another app…',
      '  Manage apps…',
      'Reveal in Finder',
    ]);
  });

  it("doesn't open a folder in an editor that would open every file in it", () => {
    expect(reading(openOnDiskEntries(FOLDER, { ...APPS, editorId: 'notepad' })).slice(0, 2)).toEqual(['Open in iTerm', 'Open with']);
  });

  it('still opens a terminal, and offers another app, before any app was found', () => {
    expect(reading(openOnDiskEntries(FOLDER, NO_EXTERNAL_APPS))).toEqual(['Open in terminal', 'Open with', '  Choose another app…', '  Manage apps…', 'Reveal in Finder']);
  });

  it('opens the item in the app picked, the default one when the entry names no other', async () => {
    fakeApi.answer('apps.openInEditor', () => undefined);
    fakeApi.answer('apps.openInTerminal', () => undefined);
    fakeApi.answer('system.revealInFileManager', () => undefined);
    const entries = openOnDiskEntries(FOLDER, APPS);

    for (const label of ['Open in JetBrains Rider', 'Visual Studio Code', 'Open in iTerm', 'Terminal', 'Reveal in Finder']) run(entries, label);
    await settle();

    expect(fakeApi.calls()).toEqual([
      { method: 'apps.openInEditor', args: [FOLDER.path, 'rider'] },
      { method: 'apps.openInEditor', args: [FOLDER.path, 'vscode'] },
      { method: 'apps.openInTerminal', args: [FOLDER.path, undefined] },
      { method: 'apps.openInTerminal', args: [FOLDER.path, 'terminal'] },
      { method: 'system.revealInFileManager', args: [FOLDER.path] },
    ]);
  });

  it("opens a file in the user's editor, with its default app on request, and with its default app when there's no editor", async () => {
    fakeApi.answer('apps.openInEditor', () => undefined);
    fakeApi.answer('system.openPath', () => undefined);

    run(openOnDiskEntries(FILE, APPS), 'Open in JetBrains Rider');
    run(openOnDiskEntries(FILE, APPS), 'Default app');
    run(openOnDiskEntries(FILE, DEFAULT_APPS), 'Open');
    await settle();

    expect(fakeApi.calls()).toEqual([
      { method: 'apps.openInEditor', args: [FILE.path, 'rider'] },
      { method: 'system.openPath', args: [FILE.path] },
      { method: 'system.openPath', args: [FILE.path] },
    ]);
  });

  it('says why when the app could not open it', async () => {
    fakeApi.answer('apps.openInEditor', () => {
      throw new Error("That app isn't installed anymore.");
    });
    run(openOnDiskEntries(FILE, APPS), 'Visual Studio Code');
    await settle();
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't open it", detail: "That app isn't installed anymore." }]);
  });

  it('adds another app the user picks, offered from then on, and opens the item in it', async () => {
    queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
    fakeApi.answer('apps.pickProgram', () => '/Applications/Sublime Text.app');
    fakeApi.answer('settings.update', (changes: Partial<AppSettings>) => ({ ...DEFAULT_SETTINGS, ...changes }));
    fakeApi.answer('apps.openInEditor', () => undefined);

    run(openOnDiskEntries(FILE, APPS), 'Choose another app…');
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
    run(openOnDiskEntries(FILE, APPS), 'Choose another app…');
    await settle();
    expect(fakeApi.argsOf('apps.openInEditor')).toEqual([[FILE.path, 'custom:1']]);

    fakeApi.answer('apps.pickProgram', () => null);
    run(openOnDiskEntries(FILE, APPS), 'Choose another app…');
    await settle();
    expect(fakeApi.methods().filter((method) => method === 'apps.openInEditor')).toHaveLength(1);
  });
});

describe('openRevisionEntries', () => {
  it("opens a revision in the user's editor first, then with any editor or its default app", async () => {
    const opened: (string | null)[] = [];
    const entries = openRevisionEntries(async (editorId) => void opened.push(editorId), APPS);
    expect(reading(entries)).toEqual([
      'Open this revision in JetBrains Rider',
      'Open this revision with',
      '  Visual Studio Code',
      '  JetBrains Rider (default)',
      '  Notepad++',
      '  ---',
      '  Default app',
      '  ---',
      '  Choose another app…',
      '  Manage apps…',
    ]);
    for (const label of ['Open this revision in JetBrains Rider', 'Visual Studio Code', 'Default app']) run(entries, label);
    await settle();
    expect(opened).toEqual(['rider', 'vscode', null]);
  });

  it('opens a revision plainly with its default app when the user has no editor', async () => {
    const opened: (string | null)[] = [];
    const entries = openRevisionEntries(async (editorId) => void opened.push(editorId), DEFAULT_APPS);
    expect(reading(entries).slice(0, 2)).toEqual(['Open this revision', 'Open this revision with']);
    expect(reading(entries)).not.toContain('  Default app');
    run(entries, 'Open this revision');
    await settle();
    expect(opened).toEqual([null]);
  });
});

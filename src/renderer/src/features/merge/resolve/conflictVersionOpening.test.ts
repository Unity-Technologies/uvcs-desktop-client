import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { ExternalApps } from '@shared/domain/externalApps';
import { isSubmenu, SEPARATOR, type Action, type MenuEntry, type Submenu } from '../../../lib/actions';
import { SERVER_ROLES, WORKSPACE_ROLES, type MergeLabels } from '../mergeDescription';
import { oneClickApp, openableVersions, versionAppEntries, versionCopyName, versionsMenu, type VersionOpeningContext } from './conflictVersionOpening';
import type { FileConflictState } from './useFileConflicts';

const versions = {
  base: { kind: 'spec', spec: 'itemid:7#cs:9@game@local', fileName: '/art/hero.psd' },
  source: { kind: 'spec', spec: 'itemid:7#cs:12@game@local', fileName: '/art/hero.psd' },
  destination: { kind: 'spec', spec: 'itemid:7#cs:10@game@local', fileName: '/art/hero.psd' },
} as const;
const conflict = (more: Partial<FileConflictState['file']> = {}, isBinary = true) =>
  ({ file: { key: '/art/hero.psd', path: 'art/hero.psd', ...versions, ...more }, isBinary }) as FileConflictState;

const labels: MergeLabels = { source: '/main/task', destination: '/main', roles: WORKSPACE_ROLES };
const inWorkspace: VersionOpeningContext = { workspacePath: '/ws', labels, yoursInWorkspace: true };
const onServer: VersionOpeningContext = { workspacePath: '/ws', labels: { ...labels, roles: SERVER_ROLES }, yoursInWorkspace: false };

const APPS: ExternalApps = {
  editors: [
    { id: 'vscode', name: 'Visual Studio Code', origin: 'known', location: '/Applications/Visual Studio Code.app', opensFolders: true },
    { id: 'custom:1', name: 'Photoshop', origin: 'custom', location: '/Applications/Adobe Photoshop.app', opensFolders: false },
  ],
  terminals: [],
  editorId: 'vscode',
  terminalId: null,
};

const labelsOf = (entries: MenuEntry[]) => entries.map((entry) => (entry === SEPARATOR ? '---' : entry.label));
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('openableVersions', () => {
  it('offers yours, incoming and the base, by the names the merge gives the sides', () => {
    expect(openableVersions(conflict(), inWorkspace).map(({ version, label }) => [version, label])).toEqual([
      ['destination', 'Yours'],
      ['source', 'Incoming'],
      ['base', 'Base'],
    ]);
    expect(openableVersions(conflict(), onServer).map(({ label }) => label)).toEqual(['Destination', 'Source', 'Base']);
  });

  it('offers no base for a file added on both sides, nor a side that has no version', () => {
    expect(openableVersions(conflict({ base: { kind: 'empty' } }), inWorkspace).map(({ version }) => version)).toEqual(['destination', 'source']);
    expect(openableVersions(conflict({ source: { kind: 'empty' } }), onServer).map(({ version }) => version)).toEqual(['destination', 'base']);
  });

  it('opens yours as the workspace file, in the app picked or with its default app', async () => {
    fakeApi.answer('apps.openInEditor', () => undefined);
    fakeApi.answer('system.openPath', () => undefined);
    const yours = openableVersions(conflict(), inWorkspace)[0]!;

    await yours.open('custom:1');
    await yours.open(null);

    expect(fakeApi.argsOf('apps.openInEditor')).toEqual([['/ws/art/hero.psd', 'custom:1']]);
    expect(fakeApi.argsOf('system.openPath')).toEqual([['/ws/art/hero.psd']]);
  });

  it("saves every other version from the repository under a name that tells which it is, so two open side by side don't look alike", async () => {
    fakeApi.answer('history.openRevision', () => undefined);
    const [destination, source, base] = openableVersions(conflict(), onServer);

    await destination!.open(null);
    await source!.open('custom:1');
    await base!.open(null);

    expect(fakeApi.argsOf('history.openRevision')).toEqual([
      ['/ws', versions.destination, 'hero.DESTINATION.psd', undefined],
      ['/ws', versions.source, 'hero.SOURCE.psd', 'custom:1'],
      ['/ws', versions.base, 'hero.BASE.psd', undefined],
    ]);
  });
});

describe('oneClickApp', () => {
  it("opens a text in the user's editor, and a binary with its default app: an editor is for text", () => {
    expect(oneClickApp(conflict({}, false), APPS)).toBe('vscode');
    expect(oneClickApp(conflict({}, true), APPS)).toBeNull();
  });
});

describe('versionAppEntries', () => {
  it('lists its default app first, then every app, then another app and the apps settings, none marked as the default', () => {
    expect(labelsOf(versionAppEntries(async () => {}, APPS))).toEqual(['Open', '---', 'Visual Studio Code', 'Photoshop', '---', 'Choose another app…', 'Manage apps…']);
  });

  it('opens the version with its default app, or in the app picked', () => {
    const opened: (string | null)[] = [];
    const entries = versionAppEntries(async (editorId) => void opened.push(editorId), APPS);
    (entries[0] as Action).run();
    (entries.find((entry) => entry !== SEPARATOR && entry.label === 'Photoshop') as Action).run();
    expect(opened).toEqual([null, 'custom:1']);
  });

  it('still opens with the default app when no app was found', () => {
    expect(labelsOf(versionAppEntries(async () => {}, { editors: [], terminals: [], editorId: null, terminalId: null }))).toEqual(['Open', '---', 'Choose another app…', 'Manage apps…']);
  });
});

describe('versionsMenu', () => {
  it('holds a submenu per version, each listing the apps to open it in', async () => {
    fakeApi.answer('history.openRevision', () => undefined);
    const menu = versionsMenu(openableVersions(conflict(), inWorkspace), APPS);
    expect(labelsOf(menu)).toEqual(['Yours', 'Incoming', 'Base']);
    expect(menu.every((entry) => entry !== SEPARATOR && isSubmenu(entry))).toBe(true);

    const incoming = (menu[1] as Submenu).entries;
    expect(labelsOf(incoming)).toEqual(labelsOf(versionAppEntries(async () => {}, APPS)));
    (incoming.find((entry) => entry !== SEPARATOR && entry.label === 'Photoshop') as Action).run();
    await settle();
    expect(fakeApi.argsOf('history.openRevision')).toEqual([['/ws', versions.source, 'hero.INCOMING.psd', 'custom:1']]);
  });
});

describe('versionCopyName', () => {
  it('tags the name before its extension, keeping the extension the OS picks the app by', () => {
    expect(versionCopyName('art/hero.psd', 'Incoming')).toBe('hero.INCOMING.psd');
    expect(versionCopyName('Assets/Models/Ship.v2.fbx', 'Base')).toBe('Ship.v2.BASE.fbx');
  });

  it('keeps any character of the name, and tags names without an extension at their end', () => {
    expect(versionCopyName('arte/héroe final.psd', 'Yours')).toBe('héroe final.YOURS.psd');
    expect(versionCopyName('Makefile', 'Base')).toBe('Makefile.BASE');
    expect(versionCopyName('.gitattributes', 'Base')).toBe('.gitattributes.BASE');
  });
});

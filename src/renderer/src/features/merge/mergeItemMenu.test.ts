import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExternalApps } from '@shared/domain/externalApps';
import type { MergeTool } from '@shared/domain/mergeTools';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { queryClient } from '../../app/queryClient';
import { externalAppsKey } from '../../components/externalApps/externalApps';
import type { DirectoryConflict, MergePlan, MergeRequest } from '@shared/domain/merge';
import { isSubmenu, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import { SERVER_ROLES, WORKSPACE_ROLES, type MergeLabels } from './mergeDescription';
import { mergeProgress, type MergeItem } from './mergeItems';
import { mergeItemMenu, type MergeMenuContext } from './mergeItemMenu';
import type { FileConflictState } from './resolve/useFileConflicts';

const labels: MergeLabels = { source: '/main/task', destination: '/main', roles: WORKSPACE_ROLES };
const request: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
const plan = {
  contributors: { source: { changesetId: 12, branch: '/main/task' }, destination: { changesetId: 10, branch: '/main' } },
  fileConflicts: [{ path: '/src/a.ts', sourceChangeset: 11 }],
} as MergePlan;
const vscode: MergeTool = { id: 'vscode', name: 'Visual Studio Code', canBringToFront: true } as MergeTool;

const versions = {
  base: { kind: 'spec', spec: 'itemid:7#cs:9@game@local', fileName: '/src/a.ts' },
  source: { kind: 'spec', spec: 'itemid:7#cs:12@game@local', fileName: '/src/a.ts' },
  destination: { kind: 'spec', spec: 'itemid:7#cs:10@game@local', fileName: '/src/a.ts' },
} as const;
const conflictState = (path: string, more: Partial<FileConflictState> = {}): FileConflictState =>
  ({ file: { key: `/${path}`, path, ...versions }, status: 'ready', isBinary: false, decidedByUser: false, resolution: null, ...more }) as FileConflictState;
/** An item the menu acts on, with its state when it is a conflicting file: the page's progress holds it. */
interface Listed {
  item: MergeItem;
  state?: FileConflictState;
}
const conflict = (path: string, more: Partial<FileConflictState> = {}): Listed => {
  const state = conflictState(path, more);
  return { item: { kind: 'fileConflict', key: `file:/${path}`, path, file: state.file }, state };
};
const change = (kind: 'added' | 'changed' | 'deleted' | 'moved', path = 'src/c.ts'): Listed => ({ item: { kind: 'change', key: `change:${path}`, path, change: { kind, path: `/${path}` } } });
const directoryConflict = (type: DirectoryConflict['type']): Listed => ({
  item: {
    kind: 'directoryConflict',
    key: 'directory:0',
    path: 'src/shared',
    index: 0,
    conflict: {
      type,
      title: 'Added on both sides with the same name',
      explanation: '',
      itemId: 3,
      isDirectory: true,
      source: { operation: 'added', path: '/src/shared', description: 'Added /src/shared' },
      destination: { operation: 'added', path: '/src/shared', description: 'Added /src/shared' },
    },
  },
});

/** The menu of `listed`, its conflicting files' states the page's progress. */
function menuOf(listed: Listed[], more: Partial<MergeMenuContext> = {}): MenuEntry[] {
  const progress = mergeProgress(listed.flatMap(({ state }) => (state ? [state] : [])), []);
  return mergeItemMenu(listed.map(({ item }) => item), context({ progress, ...more }));
}

function context(more: Partial<MergeMenuContext> = {}): MergeMenuContext {
  return {
    workspacePath: '/ws',
    request,
    plan,
    progress: mergeProgress([], []),
    labels,
    itemTypeOf: () => 'file',
    preferredTool: vscode,
    running: false,
    decide: vi.fn(),
    reset: vi.fn(),
    resolveIn: vi.fn(),
    resolveDirectory: vi.fn(),
    ...more,
  };
}

const ids = (entries: MenuEntry[]) => entries.flatMap((entry) => (typeof entry === 'object' && 'id' in entry && entry.id ? [entry.id] : []));
const entry = (menu: MenuEntry[], id: string) => menu.find((item) => typeof item === 'object' && 'id' in item && item.id === id) as Action | Submenu;
const versionEntry = (menu: MenuEntry[], label: string) => (entry(menu, 'openVersion') as Submenu).entries.find((item) => (item as Action).label === label) as Action;
const settle = () => new Promise((resolve) => setTimeout(resolve));

/** The user has an editor, which "Open" uses for every file. */
const WITH_EDITOR: ExternalApps = {
  editors: [{ id: 'vscode', name: 'Visual Studio Code', origin: 'known', location: '/Applications/Visual Studio Code.app', opensFolders: true }],
  terminals: [],
  editorId: 'vscode',
  terminalId: null,
};

describe('mergeItemMenu', () => {
  afterEach(() => queryClient.removeQueries({ queryKey: externalAppsKey(DEFAULT_SETTINGS) }));

  it('offers a conflicting file what any changed file has, and the ways to settle it', () => {
    expect(ids(menuOf([conflict('src/a.ts')]))).toEqual([
      'openRevision',
      'openRevisionWith',
      'openVersion',
      'resolveIn',
      'keepDestination',
      'keepSource',
      'history',
      'annotate',
      'saveAs',
      'copy',
    ]);
  });

  it('opens a conflicting file in the preferred merge tool, and offers starting over once the user decided it', () => {
    const resolveIn = vi.fn();
    const menu = menuOf([conflict('src/a.ts', { decidedByUser: true })], { resolveIn });
    expect((entry(menu, 'resolveIn') as Action).label).toBe('Resolve in Visual Studio Code');
    (entry(menu, 'resolveIn') as Action).run();
    expect(resolveIn).toHaveBeenCalledWith('/src/a.ts', vscode);
    expect(ids(menu)).toContain('startOver');
  });

  it("offers no merge tool for a binary file, nor without one, and disables it while files resolve one by one", () => {
    expect(ids(menuOf([conflict('a.png', { isBinary: true })]))).not.toContain('resolveIn');
    expect(ids(menuOf([conflict('src/a.ts')], { preferredTool: undefined }))).not.toContain('resolveIn');
    expect((entry(menuOf([conflict('src/a.ts')], { running: true }), 'resolveIn') as Action).disabled).toBe(true);
  });

  it("opens a conflict's incoming and base versions from the repository, and yours from the workspace", async () => {
    fakeApi.answer('history.openRevision', () => undefined);
    fakeApi.answer('system.openPath', () => undefined);
    const menu = menuOf([conflict('src/a.ts')]);
    expect((entry(menu, 'openVersion') as Submenu).entries.map((item) => (item as Action).label)).toEqual(['Yours', 'Incoming', 'Base']);

    versionEntry(menu, 'Incoming').run();
    versionEntry(menu, 'Base').run();
    versionEntry(menu, 'Yours').run();
    await settle();

    expect(fakeApi.argsOf('history.openRevision').map(([, version]) => version)).toEqual([versions.source, versions.base]);
    expect(fakeApi.argsOf('system.openPath')).toEqual([['/ws/src/a.ts']]);
  });

  it("opens a text conflict's versions in the user's editor, each saved under a name that tells which it is", async () => {
    queryClient.setQueryData(externalAppsKey(DEFAULT_SETTINGS), WITH_EDITOR);
    fakeApi.answer('history.openRevision', () => undefined);
    fakeApi.answer('apps.openInEditor', () => undefined);
    const menu = menuOf([conflict('src/a.ts')]);

    versionEntry(menu, 'Incoming').run();
    versionEntry(menu, 'Yours').run();
    await settle();

    expect(fakeApi.argsOf('history.openRevision')).toEqual([['/ws', versions.source, 'a.INCOMING.ts', 'vscode']]);
    expect(fakeApi.argsOf('apps.openInEditor')).toEqual([['/ws/src/a.ts', 'vscode']]);
  });

  it("opens a binary conflict's versions with their default app, though the user has an editor: editors are for text", async () => {
    queryClient.setQueryData(externalAppsKey(DEFAULT_SETTINGS), WITH_EDITOR);
    fakeApi.answer('history.openRevision', () => undefined);
    fakeApi.answer('system.openPath', () => undefined);
    const menu = menuOf([conflict('art/hero.psd', { isBinary: true })]);

    versionEntry(menu, 'Base').run();
    versionEntry(menu, 'Yours').run();
    await settle();

    expect(fakeApi.argsOf('history.openRevision')).toEqual([['/ws', versions.base, 'hero.BASE.psd', undefined]]);
    expect(fakeApi.argsOf('system.openPath')).toEqual([['/ws/art/hero.psd']]);
  });

  it("opens a binary conflict's incoming version only from \"Open version\", where it opens with its default app, and still saves it", () => {
    const menu = menuOf([conflict('art/hero.psd', { isBinary: true })]);
    expect(ids(menu)).not.toContain('openRevision');
    expect(ids(menu)).not.toContain('openRevisionWith');
    expect(ids(menu)).toEqual(expect.arrayContaining(['openVersion', 'saveAs']));
    const knownBinary = conflict('art/hero.psd', { status: 'loading', file: { key: '/art/hero.psd', path: 'art/hero.psd', ...versions, isKnownBinary: true } });
    expect(ids(menuOf([knownBinary]))).not.toContain('openRevision');
  });

  it('opens the destination version as yours when merging into a branch on the server, where no workspace file is it', async () => {
    fakeApi.answer('history.openRevision', () => undefined);
    const serverLabels: MergeLabels = { ...labels, roles: SERVER_ROLES };
    const menu = menuOf([conflict('src/a.ts')], { labels: serverLabels, request: { ...request, destinationBranch: '/main' } });

    versionEntry(menu, 'Destination').run();
    await settle();

    expect(fakeApi.argsOf('history.openRevision').map(([, version]) => version)).toEqual([versions.destination]);
  });

  it("saves a conflict's incoming version", async () => {
    fakeApi.answer('history.saveRevisionAs', () => null);
    (entry(menuOf([conflict('src/a.ts')]), 'saveAs') as Action).run();
    await settle();
    expect(fakeApi.argsOf('history.saveRevisionAs')).toEqual([['/ws', versions.source, 'a.ts']]);
  });

  it('offers a change that applies cleanly what any changed file has, never a choice: it is no conflict', () => {
    expect(ids(menuOf([change('changed')]))).toEqual(['openRevision', 'openRevisionWith', 'history', 'saveAs', 'copy']);
  });

  it("annotates a conflicting file's incoming revision, by the changeset cm names for it", () => {
    expect(ids(menuOf([conflict('src/a.ts')]))).toContain('annotate');
    expect(ids(menuOf([conflict('src/b.ts')]))).not.toContain('annotate');
    expect(ids(menuOf([conflict('src/a.ts', { isBinary: true })]))).not.toContain('annotate');
  });

  it('opens a clean change as the source has it, by its path at the source changeset', async () => {
    fakeApi.answer('history.openRevision', () => undefined);
    (entry(menuOf([change('added')]), 'openRevision') as Action).run();
    await settle();
    expect(fakeApi.argsOf('history.openRevision').map(([, version]) => version)).toEqual([{ kind: 'repositoryPath', path: '/src/c.ts', at: 'cs:12' }]);
  });

  it('has nothing to open or save for a deleted file or a folder', () => {
    expect(ids(menuOf([change('deleted')]))).toEqual(['history', 'copy']);
    expect(ids(menuOf([change('added')]))).toEqual(['openRevision', 'openRevisionWith', 'history', 'saveAs', 'copy']);
    expect(ids(menuOf([change('changed', 'src/ui')], { itemTypeOf: () => 'directory' }))).toEqual(['history', 'copy']);
  });

  it('offers a directory conflict the choices of its panel, keeping both under the name the panel suggests', () => {
    const resolveDirectory = vi.fn();
    const menu = menuOf([directoryConflict('evilTwin')], { resolveDirectory });
    expect(ids(menu)).toEqual(['keepDestination', 'keepSource', 'keepBoth', 'history', 'copy']);
    (entry(menu, 'keepSource') as Action).run();
    (entry(menu, 'keepBoth') as Action).run();
    expect(resolveDirectory.mock.calls).toEqual([
      [0, { choice: 'source' }],
      [0, { choice: 'rename', newName: expect.stringMatching(/shared/) }],
    ]);
  });

  it("doesn't offer keeping both where the conflict can't keep both", () => {
    expect(ids(menuOf([directoryConflict('changeDelete')]))).not.toContain('keepBoth');
  });

  it('settles several conflicting files at once, leaving the changes that apply cleanly alone, and copies them all', () => {
    const decide = vi.fn();
    const menu = menuOf([conflict('a.ts'), change('changed'), conflict('b.ts')], { decide });
    expect(ids(menu)).toEqual(['keepDestination', 'keepSource', 'copy']);
    (entry(menu, 'keepSource') as Action).run();
    expect(decide.mock.calls.map(([key]) => key)).toEqual(['/a.ts', '/b.ts']);
    expect(isSubmenu(entry(menu, 'copy'))).toBe(true);
  });
});

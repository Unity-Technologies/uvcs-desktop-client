import '../../testing/fakeWindow';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceHead } from '@shared/domain/workspace';
import { useFilesViewStore } from '../../features/files/filesViewStore';
import { requestLineFocus } from '../../features/pendingChanges/changesLineFocus';
import { fakeApi } from '../../testing/fakeWindow';
import { shownToasts, whereTheWindowIs } from '../../testing/operationOutcome';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { useSession } from '../workspace/sessionStore';
import { offerNewWorkspace, pickLinkWorkspace, showLinkFailure } from './linkDialogs';
import { openLink } from './openLink';

vi.mock('./linkDialogs', () => ({ showLinkFailure: vi.fn(), pickLinkWorkspace: vi.fn(), offerNewWorkspace: vi.fn() }));
vi.mock('../home/dialogs/CreateWorkspaceDialog', () => ({ openCreateWorkspaceDialog: vi.fn() }));
vi.mock('../../features/pendingChanges/changesLineFocus', () => ({ requestLineFocus: vi.fn() }));

const GAME = join('/wk', 'game');
const GAME_TASK = join('/wk', 'game-task');
const TOOLS = join('/wk', 'tools');
const CHANGESET_12 = 'uvcs://acme.unity/repos/game/changesets/12/-/files/Assets/Player.cs#L42';

function head(repository: string | null, branch = '/main'): WorkspaceHead {
  return { repository, repositoryName: (repository ?? 'game@').split('@')[0]!, selector: { kind: 'branch', name: branch } };
}

/** The user's workspaces and their repositories, the windows showing some, and this window's workspace (none: home). */
function workspaces(heads: Record<string, WorkspaceHead>, { current = null as string | null, shown = [] as string[], recent = [] as string[] } = {}): void {
  useSession.setState({ workspacePath: current, leftWorkspacePath: null });
  fakeApi.answer('workspaces.list', async () => Object.keys(heads).map((path) => ({ path, name: path.split(/[\\/]/).at(-1), guid: path })));
  fakeApi.answer('workspaces.heads', async () => heads);
  fakeApi.answer('workspaces.info', async (path: string) => ({ path, repository: heads[path]?.repository }));
  fakeApi.answer('windows.shownWorkspaces', async () => shown);
  fakeApi.answer('settings.get', async () => ({ recentWorkspacePaths: recent, pendingChanges: {} }));
}

beforeEach(() => {
  vi.mocked(showLinkFailure).mockReset();
  vi.mocked(pickLinkWorkspace).mockReset();
  vi.mocked(offerNewWorkspace).mockReset();
  vi.mocked(openCreateWorkspaceDialog).mockReset();
  useFilesViewStore.setState({ revealRequest: null });
});

describe('a repository link', () => {
  it("opens in this window when its workspace is on the repository: the diff, on the file and its lines", async () => {
    workspaces({ [GAME]: head('game@acme@unity') }, { current: GAME });

    await openLink(CHANGESET_12);

    expect(whereTheWindowIs().pages).toEqual([
      {
        kind: 'diff',
        title: 'Changeset 12',
        target: { kind: 'changeset', changesetId: 12 },
        focusPath: 'Assets/Player.cs',
        focusLines: { side: 'new', first: 42, last: 42 },
      },
    ]);
    expect(fakeApi.methods()).not.toContain('windows.openLinkIn');
  });

  it('goes to the window showing a workspace on it, as the app writes the link', async () => {
    workspaces({ [GAME]: head('game@acme@unity'), [TOOLS]: head('tools@acme@unity') }, { current: TOOLS, shown: [TOOLS, GAME] });
    fakeApi.answer('windows.openLinkIn', async () => 'handedOver');

    await openLink('plastic://acme.unity/repos/game/changesets/12/diff');

    expect(fakeApi.argsOf('windows.openLinkIn')).toEqual([[GAME, 'uvcs://acme.unity/repos/game/changesets/12']]);
    expect(whereTheWindowIs().pages).toEqual([]);
  });

  it('opens the only workspace on it here when this window shows the home screen, then the link', async () => {
    workspaces({ [GAME]: head('game@acme@unity') });
    fakeApi.answer('windows.openLinkIn', async () => 'openHere');
    fakeApi.answer('windows.focusWorkspace', async () => false);
    fakeApi.answer('settings.rememberRecentWorkspace', async () => undefined);
    fakeApi.answer('system.addRecentDocument', async () => undefined);

    await openLink('uvcs://acme.unity/repos/game/shelves/3');

    expect(useSession.getState().workspacePath).toBe(GAME);
    expect(whereTheWindowIs().pages).toMatchObject([{ kind: 'diff', target: { kind: 'shelve', shelveId: 3 } }]);
  });

  it('asks which of several workspaces, and opens none when the user cancels', async () => {
    workspaces({ [GAME]: head('game@acme@unity'), [GAME_TASK]: head('game@acme@unity', '/main/task') }, { recent: [GAME_TASK] });
    vi.mocked(pickLinkWorkspace).mockResolvedValue(undefined);

    await openLink(CHANGESET_12);

    expect(pickLinkWorkspace).toHaveBeenCalledWith('game', [
      { path: GAME_TASK, name: 'game-task', on: '/main/task' },
      { path: GAME, name: 'game', on: '/main' },
    ]);
    expect(fakeApi.methods()).not.toContain('windows.openLinkIn');
  });

  it("asks cm about a workspace whose head names its server by an organization's id, only when its name is the link's", async () => {
    workspaces({ [GAME]: head(null), [TOOLS]: { repository: null, repositoryName: 'tools', selector: null } });
    fakeApi.answer('workspaces.repositoryOf', async () => 'game@acme@unity');
    fakeApi.answer('windows.openLinkIn', async () => 'handedOver');

    await openLink(CHANGESET_12);

    expect(fakeApi.argsOf('workspaces.repositoryOf').map(([path]) => path)).toEqual([GAME]);
    expect(fakeApi.argsOf('windows.openLinkIn')).toEqual([[GAME, CHANGESET_12]]);
  });

  it('offers to create a workspace when none is on the repository, on the server as the profiles name it', async () => {
    workspaces({ [TOOLS]: head('tools@ssl://host:8088') });
    vi.mocked(offerNewWorkspace).mockResolvedValue(true);
    fakeApi.answer('repositories.servers', async () => [{ server: 'ssl://host:8088', user: 'ana', workingMode: 'LDAPWorkingMode' }]);

    await openLink('uvcs://host:8088/repos/game/changesets/12');

    expect(offerNewWorkspace).toHaveBeenCalledWith('game');
    expect(vi.mocked(openCreateWorkspaceDialog).mock.calls[0]![0].repository).toMatchObject({ name: 'game', server: 'ssl://host:8088', spec: 'game@ssl://host:8088' });
  });

  it("opens the link in the workspace created for it as any link opens, never leaving this window's workspace", async () => {
    workspaces({ [TOOLS]: head('tools@acme@unity') }, { current: TOOLS });
    vi.mocked(offerNewWorkspace).mockResolvedValue(true);
    fakeApi.answer('repositories.servers', async () => []);
    fakeApi.answer('windows.openLinkIn', async () => 'handedOver');

    await openLink(CHANGESET_12);
    vi.mocked(openCreateWorkspaceDialog).mock.calls[0]![0].onCreated(GAME);
    // What it started settles within the task: the api answers at once.
    await new Promise((resolve) => setTimeout(resolve));

    expect(fakeApi.argsOf('windows.openLinkIn')).toEqual([[GAME, CHANGESET_12]]);
    expect(useSession.getState().workspacePath).toBe(TOOLS);
  });

  it("opens a label's diff at its changeset, or says the label isn't there", async () => {
    workspaces({ [GAME]: head('game@acme@unity') }, { current: GAME });
    fakeApi.answer('labels.get', async (_path: string, name: string) => (name === 'v1' ? { name: 'v1', changeset: 80 } : null));

    await openLink('uvcs://acme.unity/repos/game/labels/v1');
    await openLink('uvcs://acme.unity/repos/game/labels/gone');

    expect(whereTheWindowIs().pages).toMatchObject([{ title: 'Label v1', target: { kind: 'changeset', changesetId: 80 } }]);
    expect(showLinkFailure).toHaveBeenCalledWith({ kind: 'notFound', what: 'label gone', repository: 'game' });
  });

  it('says why a link it cannot read does not open', async () => {
    await openLink('uvcs://acme.unity/repos/game/changesets/x');
    await openLink('uvcs://acme.unity/repos/game/changesets/1/-/timeline');

    expect(vi.mocked(showLinkFailure).mock.calls.map(([failure]) => failure.kind)).toEqual(['malformed', 'unknown']);
  });
});

describe('a workspace link', () => {
  it('opens a file in Changes when it has a pending change, at its lines', async () => {
    workspaces({ [GAME]: head('game@acme@unity') }, { current: GAME });
    fakeApi.answer('workspaces.locate', async (path: string) => ({ root: GAME, itemPath: path.endsWith('Player.cs') ? 'Assets/Player.cs' : '' }));
    fakeApi.answer('pendingChanges.list', async () => ({ changes: [{ path: 'Assets/Player.cs' }] }));

    await openLink(`uvcs://${GAME.replaceAll('\\', '/').replace(/^(?!\/)/, '/')}/Assets/Player.cs#L42`);

    expect(whereTheWindowIs().view).toBe('changes');
    expect(requestLineFocus).toHaveBeenCalledWith(GAME, 'Assets/Player.cs', { side: 'new', first: 42, last: 42 });
  });

  it('reveals a file without changes in Files', async () => {
    workspaces({ [GAME]: head('game@acme@unity') }, { current: GAME });
    fakeApi.answer('workspaces.locate', async (path: string) => ({ root: GAME, itemPath: path.endsWith('Player.cs') ? 'Assets/Player.cs' : '' }));
    fakeApi.answer('pendingChanges.list', async () => ({ changes: [] }));

    await openLink(`uvcs://${GAME.replaceAll('\\', '/').replace(/^(?!\/)/, '/')}/Assets/Player.cs`);

    expect(whereTheWindowIs().view).toBe('files');
    expect(useFilesViewStore.getState().revealRequest).toMatchObject({ workspacePath: GAME, path: 'Assets/Player.cs' });
  });

  it('goes to the window for its workspace when this one shows another', async () => {
    workspaces({ [GAME]: head('game@acme@unity') }, { current: TOOLS });
    fakeApi.answer('workspaces.locate', async (path: string) => ({ root: GAME, itemPath: path.endsWith('Player.cs') ? 'Assets/Player.cs' : '' }));
    fakeApi.answer('windows.openLinkIn', async () => 'handedOver');

    await openLink('uvcs:///wk/game/-/incoming');

    expect(fakeApi.argsOf('windows.openLinkIn')).toEqual([[GAME, 'uvcs:///wk/game/-/incoming']]);
  });

  it("tells in a toast when the workspaces can't be read", async () => {
    fakeApi.answer('workspaces.locate', async () => {
      throw new Error('cm is gone');
    });

    await openLink('uvcs:///wk/game');

    expect(shownToasts()).toMatchObject([{ title: "Couldn't open the link" }]);
  });

  it('says so for a folder no workspace holds', async () => {
    fakeApi.answer('workspaces.locate', async () => null);

    await openLink('uvcs:///tmp/elsewhere');

    expect(showLinkFailure).toHaveBeenCalledWith({ kind: 'notInWorkspace', folder: '/tmp/elsewhere' });
  });
});

import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_SEPARATOR } from './formatRecords';
import { cmFails, fakeCmClient, type FakeCmCommand } from './testing/fakeCmClient';
import { UNITY_ORGANIZATION } from './testing/cmOutput';
import { parseWorkspaceInfo, workspaceHeadsReader } from './workspaceHeads';

/** `cm wi <path> --machinereadable --fieldseparator=<FIELD_SEPARATOR>`, as `cm` prints it. */
const wiLine = (code: string, workingObject: string, repository: string, lineEnd = '\n'): string =>
  [code, workingObject, repository].join(FIELD_SEPARATOR) + lineEnd;

describe('parseWorkspaceInfo', () => {
  it('reads a branch, smart branches included', () => {
    expect(parseWorkspaceInfo(wiLine('BR', '/main/child_branch1/diffnewerrevsinbranch2', 'viorepo2@test@cloud'))).toEqual({
      repository: 'viorepo2@test@cloud',
      repositoryName: 'viorepo2',
      selector: { kind: 'branch', name: '/main/child_branch1/diffnewerrevsinbranch2' },
    });
  });

  it('reads a changeset, a label and a shelve', () => {
    expect(parseWorkspaceInfo(wiLine('CS', '153', 'ImageDiffTest@ssl://onprem.example.com:8088'))).toEqual({
      repository: 'ImageDiffTest@ssl://onprem.example.com:8088',
      repositoryName: 'ImageDiffTest',
      selector: { kind: 'changeset', name: '153' },
    });
    expect(parseWorkspaceInfo(wiLine('LB', 'BL100', 'game@local:8087'))?.selector).toEqual({ kind: 'label', name: 'BL100' });
    expect(parseWorkspaceInfo(wiLine('SH', '2', 'uvcs-shelvews-sandbox@local'))?.selector).toEqual({ kind: 'shelve', name: '2' });
  });

  it('reads a branch pinned to a changeset (what switching to a changeset writes) as the changeset, as cm status does', () => {
    // `smartbranch "/main/task" changeset "15"` in the selector.
    expect(parseWorkspaceInfo(wiLine('CS', '15', 'game@local'))?.selector).toEqual({ kind: 'changeset', name: '15' });
  });

  it('keeps spaces, slashes and other scripts in names', () => {
    expect(parseWorkspaceInfo(wiLine('BR', '/main/tâche 1', 'Cloud Repositories/TextEditorSample@danipen_unity@unity'))).toEqual({
      repository: 'Cloud Repositories/TextEditorSample@danipen_unity@unity',
      repositoryName: 'Cloud Repositories/TextEditorSample',
      selector: { kind: 'branch', name: '/main/tâche 1' },
    });
  });

  it("takes a Unity organization's server by name, and leaves one named by its id to cm", () => {
    expect(parseWorkspaceInfo(wiLine('BR', '/main', `3dtest/game@${UNITY_ORGANIZATION.byName}`))?.repository).toBe(`3dtest/game@${UNITY_ORGANIZATION.byName}`);
    expect(parseWorkspaceInfo(wiLine('BR', '/main', `3dtest/game@${UNITY_ORGANIZATION.byId}`))).toEqual({
      repository: null,
      repositoryName: '3dtest/game',
      selector: { kind: 'branch', name: '/main' },
    });
  });

  it('keeps the repository with no selector when the branch rules differ or there is no branch rule', () => {
    // `br "/main"` and `co "/main/task"`: cm prints `:M:` for the branch.
    expect(parseWorkspaceInfo(wiLine('BR', ':M:', 'game@local'))).toEqual({ repository: 'game@local', repositoryName: 'game', selector: null });
    expect(parseWorkspaceInfo(wiLine('BR', '', 'game@local'))).toEqual({ repository: 'game@local', repositoryName: 'game', selector: null });
  });

  it('tells nothing of a selector over several repositories or rules, which names none', () => {
    // The repository is `:M:` too; `cm` puts the default server after it.
    expect(parseWorkspaceInfo(wiLine('BR', ':M:', ':M:@local'))).toBeNull();
    expect(parseWorkspaceInfo(wiLine('BR', ':M:', ':M:'))).toBeNull();
  });

  it('reads CRLF line ends and a line without one', () => {
    expect(parseWorkspaceInfo(wiLine('BR', '/main', 'game@local', '\r\n'))?.repository).toBe('game@local');
    expect(parseWorkspaceInfo(wiLine('BR', '/main', 'game@local', ''))?.repository).toBe('game@local');
  });

  it('returns null for anything else', () => {
    expect(parseWorkspaceInfo('/tmp is not in a workspace.\n')).toBeNull();
    expect(parseWorkspaceInfo('')).toBeNull();
    expect(parseWorkspaceInfo(wiLine('XX', '/main', 'game@local'))).toBeNull();
    expect(parseWorkspaceInfo(wiLine('BR', '/main', 'game'))).toBeNull();
    expect(parseWorkspaceInfo(wiLine('BR', '/main', 'game@'))).toBeNull();
    expect(parseWorkspaceInfo('BR /main@game@local\n')).toBeNull();
  });
});

describe('workspaceHeadsReader', () => {
  const workspaceFolders = async (...names: string[]): Promise<string[]> => {
    const root = await mkdtemp(join(tmpdir(), 'uvcs-heads-'));
    return Promise.all(names.map(async (name) => (await mkdir(join(root, name)), join(root, name))));
  };
  /** Each workspace works on `/main` of a repository named after its folder. */
  const wiOfFolder = ({ args }: FakeCmCommand): string => wiLine('BR', '/main', `${args[1]!.split(/[\\/]/).at(-1)}@local`);

  it('asks cm wi about each workspace, its path as given, split by a control character, in a pooled shell in any directory', async () => {
    const [game, tools] = await workspaceFolders('game', 'tools and art');
    const { cm, commands } = fakeCmClient({ wi: wiOfFolder });

    expect(await workspaceHeadsReader(cm)([game!, tools!])).toEqual({
      [game!]: { repository: 'game@local', repositoryName: 'game', selector: { kind: 'branch', name: '/main' } },
      [tools!]: { repository: 'tools and art@local', repositoryName: 'tools and art', selector: { kind: 'branch', name: '/main' } },
    });
    expect(commands.map(({ via, args, options }) => ({ via, args, options }))).toEqual([
      { via: 'query', args: ['wi', game, '--machinereadable', '--fieldseparator=\u001f'], options: { anyDirectory: true } },
      { via: 'query', args: ['wi', tools, '--machinereadable', '--fieldseparator=\u001f'], options: { anyDirectory: true } },
    ]);
  });

  it("leaves out workspaces cm can't tell, and asks nothing about a folder that is gone", async () => {
    const [game, broken, garbled] = await workspaceFolders('game', 'broken', 'garbled');
    const { cm, commands } = fakeCmClient({
      wi: (command) => {
        if (command.args[1] === broken) return cmFails(`${broken} is not in a workspace.`);
        if (command.args[1] === garbled) return 'something else\n';
        return wiOfFolder(command);
      },
    });

    expect(Object.keys(await workspaceHeadsReader(cm)([game!, broken!, garbled!, join(tmpdir(), 'no-such-workspace')]))).toEqual([game]);
    expect(commands).toHaveLength(3);
  });

  it('reads one workspace at a time, across calls too, leaving the other pooled session free', async () => {
    const folders = await workspaceFolders('a', 'b', 'c', 'd');
    let running = 0;
    let most = 0;
    const { cm } = fakeCmClient({
      wi: async (command) => {
        most = Math.max(most, ++running);
        await Promise.resolve();
        running--;
        return wiOfFolder(command);
      },
    });
    const readHeads = workspaceHeadsReader(cm);

    // Two windows on the home screen at once.
    const [first, second] = await Promise.all([readHeads(folders), readHeads(folders)]);

    expect(Object.keys(first).sort()).toEqual([...folders].sort());
    expect(second).toEqual(first);
    expect(most).toBe(1);
  });

  it('asks nothing for no workspaces', async () => {
    const { cm, commands } = fakeCmClient();
    expect(await workspaceHeadsReader(cm)([])).toEqual({});
    expect(commands).toEqual([]);
  });
});

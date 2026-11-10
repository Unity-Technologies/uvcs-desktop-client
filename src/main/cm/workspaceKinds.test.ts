import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmFails, fakeCmClient, type FakeCmCommand } from './testing/fakeCmClient';
import { formatOutput } from './testing/cmOutput';
import { workspaceHeadsReader } from './workspaceHeads';
import { workspaceKindsReader } from './workspaceKinds';
import { workspaceReadTurns } from './workspaceReadTurns';

const workspaceFolders = async (...names: string[]): Promise<string[]> => {
  const root = await mkdtemp(join(tmpdir(), 'uvcs-kinds-'));
  return Promise.all(names.map(async (name) => (await mkdir(join(root, name)), join(root, name))));
};

/** `{type}` and `{dynamic}` of each folder, as `cm getworkspacefrompath --format` prints them, by the folder's name. */
const KIND_FIELDS: Record<string, [string, string]> = {
  game: ['regular', 'static'],
  art: ['partial', 'static'],
  remote: ['regular', 'dynamic'],
};
const gwpOfFolder = ({ args }: FakeCmCommand): string => formatOutput(KIND_FIELDS[basename(args[1]!)]!);

describe('workspaceKindsReader', () => {
  it('asks getworkspacefrompath for each workspace’s type and dynamic fields, in a pooled shell in any directory', async () => {
    const [game, art, remote] = await workspaceFolders('game', 'art', 'remote');
    const { cm, commands } = fakeCmClient({ getworkspacefrompath: gwpOfFolder });

    expect(await workspaceKindsReader(cm)([game!, art!, remote!])).toEqual({ [game!]: 'standard', [art!]: 'partial', [remote!]: 'dynamic' });
    expect(commands.map(({ via, args, options, readsRecords }) => ({ via, args, options, readsRecords }))).toEqual(
      [game, art, remote].map((path) => ({
        via: 'query',
        args: ['getworkspacefrompath', path, '--format={type}\u001f{dynamic}\u001e'],
        options: { anyDirectory: true },
        readsRecords: true,
      })),
    );
  });

  it("leaves out workspaces cm can't tell, and asks nothing about a folder that is gone", async () => {
    const [game, broken] = await workspaceFolders('game', 'broken');
    const { cm, commands } = fakeCmClient({
      getworkspacefrompath: (command) => (command.args[1] === broken ? cmFails(`${broken} is not in a workspace.`) : gwpOfFolder(command)),
    });

    expect(await workspaceKindsReader(cm)([game!, broken!, join(tmpdir(), 'no-such-workspace')])).toEqual({ [game!]: 'standard' });
    expect(commands).toHaveLength(2);
  });

  it('takes the same turns as the heads, so the two reads of a list run one at a time', async () => {
    const folders = await workspaceFolders('game', 'art');
    let running = 0;
    let most = 0;
    const oneAtATime = (answer: (command: FakeCmCommand) => string) => async (command: FakeCmCommand) => {
      most = Math.max(most, ++running);
      await Promise.resolve();
      running--;
      return answer(command);
    };
    const { cm } = fakeCmClient({ getworkspacefrompath: oneAtATime(gwpOfFolder), wi: oneAtATime(() => 'BR\u001f/main\u001fgame@local\n') });
    const inTurn = workspaceReadTurns();

    await Promise.all([workspaceKindsReader(cm, inTurn)(folders), workspaceHeadsReader(cm, inTurn)(folders)]);

    expect(most).toBe(1);
  });

  it('asks nothing for no workspaces', async () => {
    const { cm, commands } = fakeCmClient();
    expect(await workspaceKindsReader(cm)([])).toEqual({});
    expect(commands).toEqual([]);
  });
});

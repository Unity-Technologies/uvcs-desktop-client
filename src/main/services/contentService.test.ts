import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { treeListingOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, optionValue, type CmAnswer, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import type { ReviewStore } from '../review/ReviewStore';
import { createContentService } from './contentService';
import { serviceContext } from './testing/serviceContext';

async function newWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'content-wk-'));
}

function content(answers: Record<string, CmAnswer>, reviews?: Partial<ReviewStore>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createContentService(serviceContext(fake.cm, { reviews: reviews as ReviewStore })) };
}

/** A `cm cat` that writes `text` to the file it is given, remembering which. */
function catWriting(text: string) {
  const written: string[] = [];
  const answer = async ({ args }: FakeCmCommand): Promise<string> => {
    const file = optionValue(args, '--file=')!;
    written.push(file);
    await writeFile(file, text, 'utf8');
    return '';
  };
  return { written, answer };
}

/** `/Assets` at a point: a glTF, its `.bin` and its `.meta`. */
const ASSETS_LISTING = treeListingOutput(
  { path: 'Assets', type: 'dir', revid: 40 },
  { path: 'Assets/Barrel.bin', revid: 41 },
  { path: 'Assets/Barrel.gltf.meta', type: 'txt', revid: 42 },
  { path: 'Assets/Barrel.gltf', type: 'txt', revid: 43 },
);

const LS_UNDER_XLINK = `<?xml version="1.0" encoding="utf-8"?>
<LsResults><LsItems>
  <LsItem><Status>Controlled</Status><Name>a.cs</Name><WkPath>/lib/a.cs</WkPath><Size>12</Size><Type>txt</Type>
    <Changeset>30</Changeset><Repository>rep:lib@local</Repository><RevId>432</RevId><ParentRevId>400</ParentRevId><ItemId>9</ItemId>
    <Branch>/main</Branch><Date>2026-09-25T09:41:47+02:00</Date></LsItem>
</LsItems></LsResults>`;

describe('reading content', () => {
  it('reads a revision with one quick cm cat into a temp file, deleted afterwards', async () => {
    const workspace = await newWorkspace();
    const { written, answer } = catWriting('class Player {}\n');
    const { service, commands } = content({ cat: answer });

    const read = await service.read(workspace, { kind: 'revision', revision: { revisionId: 45, repository: 'game@local' }, fileName: 'player.cs' });

    expect(read).toMatchObject({ text: 'class Player {}\n', isBinary: false });
    expect(commands).toMatchObject([{ via: 'query', args: ['cat', 'revid:45@game@local', `--file=${written[0]}`], options: { cwd: workspace } }]);
    expect(existsSync(written[0]!)).toBe(false);
  });

  it('reads a file under an xlink from the changeset tree, with a second command only when its repository path finds nothing', async () => {
    const workspace = await newWorkspace();
    const { answer } = catWriting('xlinked\n');
    const { service, commands } = content({
      cat: (command) => (command.args[1]!.startsWith('serverpath:') ? cmFails('Error: The specified item /lib/a.cs does not exist.') : answer(command)),
      ls: LS_UNDER_XLINK,
    });

    const read = await service.read(workspace, { kind: 'repositoryPath', path: '/lib/a.cs', at: 'cs:30' });

    expect(read.text).toBe('xlinked\n');
    expect(commands.map(({ args }) => args.filter((arg) => !arg.startsWith('--file=')))).toEqual([
      ['cat', 'serverpath:/lib/a.cs#cs:30'],
      ['ls', '/lib/a.cs', '--tree=cs:30', '--xml'],
      ['cat', 'revid:432@lib@local'],
    ]);
  });

  it('reads workspace files from disk and the empty side without asking cm', async () => {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'src', 'a.cs'), 'local edit\n');
    const { service, commands } = content({});

    expect((await service.read(workspace, { kind: 'workspaceFile', path: 'src/a.cs' })).text).toBe('local edit\n');
    expect(await service.read(workspace, { kind: 'empty' })).toEqual({ text: '', isBinary: false, size: 0 });
    expect(commands).toEqual([]);
  });

  it('reads the reviewed copy of a file from the review store', async () => {
    const snapshot = { text: 'reviewed\n', isBinary: false, size: 9 };
    const { service, commands } = content({}, { readSnapshot: async () => snapshot });

    expect(await service.read('wk', { kind: 'reviewSnapshot', path: 'a.cs' })).toBe(snapshot);
    expect(commands).toEqual([]);
  });
});

describe('writing a workspace file', () => {
  it('writes the text as the editor has it, line breaks included', async () => {
    const workspace = await newWorkspace();
    await writeFile(join(workspace, 'a.cs'), 'old\n');
    const { service } = content({});

    await service.writeWorkspaceFile(workspace, 'a.cs', 'new\r\nlines\r\n');

    expect(await readFile(join(workspace, 'a.cs'), 'utf8')).toBe('new\r\nlines\r\n');
  });
});

describe('reading the bytes of a model companion', () => {
  it("reads a glTF's .bin beside it in the workspace, from the disk", async () => {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'Assets'), { recursive: true });
    await writeFile(join(workspace, 'Assets', 'Barrel.bin'), Buffer.from([1, 2, 3]));
    const { service, commands } = content({});

    expect([...(await service.readBytes(workspace, { kind: 'workspaceFile', path: 'Assets/Barrel.bin' }))!]).toEqual([1, 2, 3]);
    expect(commands).toEqual([]);
  });

  it("reads one at a changeset or branch head by its revision there, from its folder's listing, which its other companions share", async () => {
    const workspace = await newWorkspace();
    const { written, answer } = catWriting('BIN');
    const { service, commands } = content({ cat: answer, ls: ASSETS_LISTING });

    const bytes = await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Barrel.bin', at: 'cs:12' });
    await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Barrel.gltf.meta', at: 'cs:12' });

    expect(new TextDecoder().decode(bytes!)).toBe('BIN');
    expect(commands.map(({ via, args }) => [via, args[0], args[1]])).toEqual([
      // Its children alone, never the subtree: a model in a big folder lists only that folder.
      ['query', 'ls', '/Assets'],
      ['query', 'cat', 'revid:41@eco@local'],
      ['query', 'cat', 'revid:42@eco@local'],
    ]);
    expect(written).toHaveLength(2);
  });

  it("reads a companion that isn't there as nothing, from the disk or from the tree's listing, without a failing command", async () => {
    const workspace = await newWorkspace();
    const { service, lines } = content({ ls: ASSETS_LISTING });
    expect(await service.readBytes(workspace, { kind: 'workspaceFile', path: 'Assets/Hero.fbx.meta' })).toBeNull();
    expect(await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Hero.fbx.meta', at: 'cs:4' })).toBeNull();
    expect(await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Shared/Hero.fbx.meta', at: 'cs:4', repository: 'art@local' })).toBeNull();
    expect(lines().map((line) => line.split(' --format')[0])).toEqual(['ls /Assets --tree=cs:4', 'ls /Assets/Shared --tree=cs:4']);
  });

  it('reads a companion under an xlink by its revision in the xlinked repository, as the listing names it', async () => {
    const { answer } = catWriting('META');
    const { service, lines } = content({ cat: answer, ls: treeListingOutput({ path: 'Assets/Shared', type: 'xlink', revid: 3 }, { path: 'Assets/Shared/Hero.fbx.meta', type: 'txt', revid: 77, repository: 'art@local' }) });
    expect(await service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Shared/Hero.fbx.meta', at: 'cs:3', repository: 'art@local' })).not.toBeNull();
    expect(lines()[1]).toMatch(/^cat revid:77@art@local --file=/);
  });

  describe("of the workspace's repository that isn't there", () => {
    /** As cm prints it: `serverpath:` can't tell a missing file from one under an xlink, so the tree is asked. */
    const notFound = ({ args }: FakeCmCommand) => cmFails(`The specified revision was not found ${args[1]}`);
    const notInTree = ({ args }: FakeCmCommand) =>
      cmFails([`Can't resolve the selector for the item ${args[1]}`, '<?xml version="1.0" encoding="utf-8"?>', '<LsResults>', '  <LsItems />', '</LsResults>'].join('\n'));

    it.each(['cs:3', 'br:/main'])('reads it as nothing at %s, where the tree has no such folder', async (at) => {
      const { service, lines } = content({ cat: notFound, ls: notInTree });
      expect(await service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at })).toBeNull();
      expect(lines().map((line) => line.split(' --format')[0])).toEqual([`ls /Assets --tree=${at}`]);
    });

    it.each(['sh:2', 'lb:v1.0'])("reads it as nothing at %s, whose tree cm ls can't list, from its one failing cm cat", async (at) => {
      const { service, lines } = content({ cat: notFound });
      expect(await service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at })).toBeNull();
      expect(lines()).toHaveLength(1);
    });

    it("fails when the tree can't be asked: the file may well be there", async () => {
      const { service } = content({ cat: notFound, ls: cmFails('Error: The server is unreachable.') });
      await expect(service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at: 'cs:3' })).rejects.toThrow();
    });

    it.each(['The specified changeset cs:9 does not exist.', 'Specified branch /main/old does not exist'])(
      'fails when the tree tells the point is gone (%s), which says nothing of the file',
      async (gone) => {
        const { service } = content({ cat: notFound, ls: cmFails(gone) });
        await expect(service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at: 'cs:9' })).rejects.toThrow();
        await expect(service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Shared/Crate.fbx.meta', at: 'cs:9', repository: 'art@local' })).rejects.toThrow();
      },
    );

    it('fails for a revision not found, which names one that should be there', async () => {
      const { service } = content({ cat: ({ args }) => cmFails(`The specified revision was not found ${args[1]}`) });
      await expect(service.readBytes(await newWorkspace(), { kind: 'revision', revision: { revisionId: 4, repository: 'game@local' }, fileName: 'a.bin' })).rejects.toThrow('not found');
    });
  });

  it('fails on any other error, which is no answer about the file', async () => {
    const { service } = content({ cat: () => cmFails('Error: The server is unreachable.') });
    await expect(service.readBytes(await newWorkspace(), { kind: 'revision', revision: { revisionId: 4, repository: 'game@local' }, fileName: 'a.bin' })).rejects.toThrow('unreachable');
  });

  it('refuses a workspace file outside the workspace', async () => {
    const { service } = content({});
    await expect(service.readBytes(await newWorkspace(), { kind: 'workspaceFile', path: '../../etc/passwd' })).rejects.toThrow('outside the workspace');
    await expect(service.read(await newWorkspace(), { kind: 'workspaceFile', path: '../../etc/passwd' })).rejects.toThrow('outside the workspace');
    await expect(service.writeWorkspaceFile(await newWorkspace(), '../outside.txt', 'x')).rejects.toThrow('outside the workspace');
  });

  it('reads nothing of an empty side', async () => {
    const { service } = content({});
    expect(await service.readBytes(await newWorkspace(), { kind: 'empty' })).toBeNull();
  });
});

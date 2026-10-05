import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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

  it('reads a revision of one with one quick cm cat, as any content', async () => {
    const workspace = await newWorkspace();
    const { written, answer } = catWriting('BIN');
    const { service, commands } = content({ cat: answer });

    const bytes = await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Barrel.bin', at: 'cs:12' });

    expect(new TextDecoder().decode(bytes!)).toBe('BIN');
    expect(commands).toMatchObject([{ via: 'query', args: ['cat', 'serverpath:/Assets/Barrel.bin#cs:12', `--file=${written[0]}`] }]);
  });

  it("reads a companion that isn't there as nothing, from the disk or from cm, so it is an answer", async () => {
    const workspace = await newWorkspace();
    const { service } = content({ cat: () => cmFails('Error: The specified item /Assets/Hero.fbx.meta does not exist.'), ls: '<?xml version="1.0" encoding="utf-8"?><LsResults><LsItems></LsItems></LsResults>' });
    expect(await service.readBytes(workspace, { kind: 'workspaceFile', path: 'Assets/Hero.fbx.meta' })).toBeNull();
    expect(await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Hero.fbx.meta', at: 'cs:4' })).toBeNull();
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

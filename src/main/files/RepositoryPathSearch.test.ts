import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace } from '@shared/domain/place';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, runsUntilCancelled, type CmAnswer, type CmFailure, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import { RepositoryPathSearch, type PathSearchSource } from './RepositoryPathSearch';
import { SessionFolder } from './SessionFolder';

const GAME = repositoryPlace('game@local');

/** `cm ls / -R --tree=… --format={type}␟{path}␞` as cm prints it: the root, then every item. */
const TREE = formatOutput(
  ['dir', '/'],
  ['dir', '/Assets'],
  ['txt', '/Assets/Player.cs'],
  ['txt', '/Assets/PlayerController.cs'],
  ['dir', '/Assets/Players'],
  ['bin', '/Assets/Enemy.png'],
  ['txt', '/README.md'],
);

async function setUp(answer: CmAnswer = TREE) {
  const tempFolder = await mkdtemp(join(tmpdir(), 'path-search-'));
  const fake = fakeCmClient({ ls: answer });
  const search = new RepositoryPathSearch(fake.cm, new SessionFolder({ prefix: 'uvcs-trees-', tempFolder, pid: 100, isRunning: () => false }));
  const filesIn = async () => (await readdir(tempFolder)).flatMap((folder) => (folder.startsWith('uvcs-trees-100-') ? [folder] : []));
  const treeFiles = async () => (await Promise.all((await filesIn()).map((folder) => readdir(join(tempFolder, folder))))).flat().sort();
  return { fake, search, tempFolder, treeFiles };
}

const paths = (found: { path: string }[]) => found.map((item) => item.path);

describe('finding a file in a repository explored without a workspace', () => {
  it('lists the tree once, in a process of its own, outside every workspace, naming the repository and the changeset', async () => {
    const { fake, search } = await setUp();

    expect(paths(await search.search(GAME, 12, 'player', { limit: 10 }))).toEqual(['Assets/Players', 'Assets/Player.cs', 'Assets/PlayerController.cs']);

    expect(fake.commands.map(({ via, args, options }) => ({ via, args, outsideWorkspaces: options.outsideWorkspaces }))).toEqual([
      { via: 'execute', args: ['ls', '/', '-R', '--tree=cs:12@game@local', '--format={type}\u001f{path}\u001e'], outsideWorkspaces: true },
    ]);
    expect(fake.commands[0]!.readsRecords).toBe(true);
  });

  it('reads every later search of that changeset from its file, never the server again', async () => {
    const { fake, search } = await setUp();
    await search.search(GAME, 12, 'player', { limit: 10 });

    const sources: PathSearchSource[] = [];
    expect(paths(await search.search(GAME, 12, 'readme', { limit: 10, onUpdate: (_, source) => sources.push(source) }))).toEqual(['README.md']);
    expect(fake.commands).toHaveLength(1);
    expect(sources).toEqual(['disk']);
  });

  it('tells the best results as they are found, from the server the first time', async () => {
    const { search } = await setUp();
    const updates: [string[], PathSearchSource][] = [];

    await search.search(GAME, 12, 'enemy', { limit: 10, onUpdate: (found, source) => updates.push([paths(found), source]) });

    expect(updates).toEqual([[['Assets/Enemy.png'], 'server']]);
  });

  it('writes the tree down as it arrives, one item a line, and keeps only the whole of it', async () => {
    const { search, tempFolder, treeFiles } = await setUp();
    await search.search(GAME, 12, 'player', { limit: 10 });

    const [file] = await treeFiles();
    expect(file).toMatch(/-12\.paths$/);
    const folder = (await readdir(tempFolder))[0]!;
    expect(await readFile(join(tempFolder, folder, file!), 'utf8')).toBe('dAssets\nfAssets/Player.cs\nfAssets/PlayerController.cs\ndAssets/Players\nfAssets/Enemy.png\nfREADME.md\n');
  });

  it('lists once for the searches asked while it lists', async () => {
    const { fake, search } = await setUp();

    const [players, readme] = await Promise.all([search.search(GAME, 12, 'player', { limit: 10 }), search.search(GAME, 12, 'readme', { limit: 10 })]);

    expect(paths(players)).toHaveLength(3);
    expect(paths(readme)).toEqual(['README.md']);
    expect(fake.commands).toHaveLength(1);
  });

  it('lists another changeset again, and keeps the three trees of the repository searched last', async () => {
    const { fake, search, treeFiles } = await setUp();
    for (const changesetId of [12, 13, 14, 12, 15]) await search.search(GAME, changesetId, 'player', { limit: 10 });

    expect(fake.lines().map((line) => line.split(' ')[3])).toEqual(['--tree=cs:12@game@local', '--tree=cs:13@game@local', '--tree=cs:14@game@local', '--tree=cs:15@game@local']);
    expect((await treeFiles()).map((file) => file.replace(/^.*-/, ''))).toEqual(['12.paths', '14.paths', '15.paths']);
  });

  it("keeps no tree of a listing that failed, and lists it again on the next search", async () => {
    let fails = true;
    const { fake, search, treeFiles } = await setUp(() => (fails ? cmFails('The server is not available') : TREE));

    await expect(search.search(GAME, 12, 'player', { limit: 10 })).rejects.toThrow('The server is not available');
    expect(await treeFiles()).toEqual([]);

    fails = false;
    expect(paths(await search.search(GAME, 12, 'readme', { limit: 10 }))).toEqual(['README.md']);
    expect(fake.commands).toHaveLength(2);
  });

  it("lists again a tree whose file went, as when the OS clears its temp folder", async () => {
    const { fake, search, tempFolder, treeFiles } = await setUp();
    await search.search(GAME, 12, 'player', { limit: 10 });
    const folder = (await readdir(tempFolder))[0]!;
    await rm(join(tempFolder, folder, (await treeFiles())[0]!));

    expect(paths(await search.search(GAME, 12, 'readme', { limit: 10 }))).toEqual(['README.md']);
    expect(fake.commands).toHaveLength(2);
  });

  it('lists again on the next search when the tree could not even be written', async () => {
    const tempFolder = await mkdtemp(join(tmpdir(), 'path-search-'));
    const fake = fakeCmClient({ ls: TREE });
    const search = new RepositoryPathSearch(fake.cm, new SessionFolder({ prefix: 'uvcs-trees-', tempFolder: join(tempFolder, 'missing'), pid: 100, isRunning: () => false }));

    await expect(search.search(GAME, 12, 'player', { limit: 10 })).rejects.toThrow();
    await mkdir(join(tempFolder, 'missing'));
    expect(paths(await search.search(GAME, 12, 'readme', { limit: 10 }))).toEqual(['README.md']);
  });

  it("lets a repository's trees go, stopping a listing under way, once no window explores it", async () => {
    const { search, treeFiles } = await setUp();
    await search.search(GAME, 12, 'player', { limit: 10 });

    search.forget('game@local');
    expect(await treeFiles()).toEqual([]);

    let started!: () => void;
    const listingStarted = new Promise<void>((resolve) => (started = resolve));
    const listsUntilCancelled = runsUntilCancelled('Operation cancelled') as (command: FakeCmCommand) => Promise<string | CmFailure>;
    const listing = await setUp((command) => {
      started();
      return listsUntilCancelled(command);
    });
    const searching = listing.search.search(GAME, 14, 'player', { limit: 10 });
    await listingStarted;
    listing.search.forget('game@local');
    await expect(searching).rejects.toThrow('Operation cancelled');
    expect(await listing.treeFiles()).toEqual([]);
  });

  it('stops a search whose query was replaced, with what it found so far, the tree kept for the next', async () => {
    const { fake, search } = await setUp();
    await search.search(GAME, 12, 'player', { limit: 10 });
    const stopped = new AbortController();
    stopped.abort();

    expect(await search.search(GAME, 12, 'player', { limit: 10, signal: stopped.signal })).toEqual([]);
    expect(paths(await search.search(GAME, 12, 'readme', { limit: 10 }))).toEqual(['README.md']);
    expect(fake.commands).toHaveLength(1);
  });

  it('stops a search at once while its tree is still listed, the listing going on for the next', async () => {
    let started!: () => void;
    const listingStarted = new Promise<void>((resolve) => (started = resolve));
    const listsUntilCancelled = runsUntilCancelled('cancelled');
    const { fake, search } = await setUp((command) => {
      started();
      return (listsUntilCancelled as (command: FakeCmCommand) => Promise<string | CmFailure>)(command);
    });
    const stop = new AbortController();

    const searching = search.search(GAME, 12, 'player', { limit: 10, signal: stop.signal });
    await listingStarted;
    stop.abort();
    expect(await searching).toEqual([]);
    expect(fake.commands[0]!.options.signal?.aborted).toBe(false);
    search.dispose();
  });

  it('deletes the trees a crashed session left as the app starts, before any search', async () => {
    const tempFolder = await mkdtemp(join(tmpdir(), 'path-search-'));
    await mkdir(join(tempFolder, 'uvcs-trees-200-left'));
    const search = new RepositoryPathSearch(fakeCmClient().cm, new SessionFolder({ prefix: 'uvcs-trees-', tempFolder, pid: 100, isRunning: () => false }));

    await search.removeLeftOvers();
    expect(await readdir(tempFolder)).toEqual([]);
  });

  it('deletes every tree as the app quits', async () => {
    const { search, tempFolder } = await setUp();
    await search.search(GAME, 12, 'player', { limit: 10 });

    search.dispose();
    expect((await readdir(tempFolder)).filter((name) => existsSync(join(tempFolder, name)))).toEqual([]);
  });
});

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmFails, fakeCmClient, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import { batchesOf, catArgs, MAX_BATCH_BYTES, RevisionDownloads, type RevisionFile } from './RevisionDownloads';

const md5 = (text: string) => createHash('md5').update(text).digest('base64');

/** The content of each revision on the server, by id. */
const SERVER: Record<number, string> = { 1: 'bark v1', 2: 'leaves v2', 3: 'moss v3' };

/** `cm cat <spec>;<file> …` as `cm` does it: every revision it has written to its file; one it hasn't fails the command. */
async function catAnswer(command: FakeCmCommand): Promise<string | ReturnType<typeof cmFails>> {
  const missing: string[] = [];
  for (const arg of command.args.slice(1)) {
    const [revisionSpec = '', target = ''] = arg.split(';');
    const id = Number(/^revid:(\d+)@/.exec(revisionSpec)?.[1]);
    if (SERVER[id] === undefined) missing.push(revisionSpec);
    else await writeFile(target, SERVER[id]!);
  }
  return missing.length > 0 ? cmFails(`The specified revision was not found ${missing[0]}`) : '';
}

const file = (revisionId: number, path = `Art/${revisionId}.png`, hash: string | null = null, size = -1): RevisionFile => ({ path, revision: { revisionId, repository: 'eco@local' }, hash, size });

async function setUp(maxKeptBytes?: number) {
  const workspace = await mkdtemp(join(tmpdir(), 'revisions-workspace-'));
  const sessions = await mkdtemp(join(tmpdir(), 'revisions-session-'));
  const fake = fakeCmClient({ cat: catAnswer });
  const downloads = new RevisionDownloads({ cm: fake.cm, tempFolder: sessions, pid: 100, isRunning: (pid) => pid === 200, ...(maxKeptBytes !== undefined && { maxKeptBytes }) });
  return { workspace, sessions, fake, downloads, text: async (read: Promise<Buffer>) => (await read).toString() };
}

describe('RevisionDownloads', () => {
  it('downloads the revisions asked at once in one cm cat, in a process of its own, and each only once', async () => {
    const { workspace, fake, downloads, text } = await setUp();
    expect(await Promise.all([text(downloads.read(workspace, file(1))), text(downloads.read(workspace, file(2))), text(downloads.read(workspace, file(1)))])).toEqual(['bark v1', 'leaves v2', 'bark v1']);
    expect(fake.commands.map((command) => [command.via, command.args.length])).toEqual([['execute', 3]]);
    expect(await text(downloads.read(workspace, file(2)))).toBe('leaves v2');
    expect(fake.commands).toHaveLength(1);
  });

  it("reads the workspace's file where it has the revision's content, and downloads it where it has another", async () => {
    const { workspace, fake, downloads, text } = await setUp();
    await mkdir(join(workspace, 'Art'));
    await writeFile(join(workspace, 'Art', 'same.png'), 'bark v1');
    await writeFile(join(workspace, 'Art', 'edited.png'), 'bark v9');
    expect(await text(downloads.read(workspace, file(1, 'Art/same.png', md5('bark v1'), 7)))).toBe('bark v1');
    expect(fake.commands).toEqual([]);
    expect(await text(downloads.read(workspace, file(1, 'Art/edited.png', md5('bark v1'), 7)))).toBe('bark v1');
    expect(fake.linesVia('execute')).toHaveLength(1);
  });

  it('tells each revision of a batch apart: one cm has not fails alone', async () => {
    const { workspace, downloads, text } = await setUp();
    const [found, gone] = await Promise.allSettled([text(downloads.read(workspace, file(3))), text(downloads.read(workspace, file(404)))]);
    expect(found).toEqual({ status: 'fulfilled', value: 'moss v3' });
    expect(gone).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('revid:404@eco@local') } });
  });

  it('keeps the latest downloads up to its size, downloading again one it let go', async () => {
    const { workspace, fake, downloads, text } = await setUp('bark v1'.length + 'leaves v2'.length);
    await text(downloads.read(workspace, file(1)));
    await text(downloads.read(workspace, file(2)));
    await text(downloads.read(workspace, file(3)));
    await text(downloads.read(workspace, file(3)));
    expect(fake.commands).toHaveLength(3);
    await text(downloads.read(workspace, file(1)));
    expect(fake.commands).toHaveLength(4);
  });

  it("deletes the folders a crashed session left before making its own, never another running app's, and its own as the app quits", async () => {
    const { workspace, sessions, downloads, text } = await setUp();
    // Process 300 crashed; 200 is another app running now (a development build beside the installed one).
    await mkdir(join(sessions, 'uvcs-revisions-300-left'));
    await mkdir(join(sessions, 'uvcs-revisions-200-inUse'));
    await mkdir(join(sessions, 'uvcs-1E3ke9'));
    // At startup and on the first download at once: the folders left go first, then the session's own is made.
    const startup = downloads.removeLeftOvers();
    await text(downloads.read(workspace, file(1)));
    await startup;
    await downloads.removeLeftOvers();
    const folders = (await readdir(sessions)).sort();
    expect(folders).toEqual(['uvcs-1E3ke9', expect.stringMatching(/^uvcs-revisions-100-/), 'uvcs-revisions-200-inUse']);
    expect(await text(downloads.read(workspace, file(1)))).toBe('bark v1');

    downloads.dispose();
    expect(existsSync(join(sessions, folders[1]!))).toBe(false);
  });
});

describe('batchesOf', () => {
  const waiting = (revisionId: number, size: number, workspacePath = '/w') => ({ workspacePath, key: `${revisionId}@eco@local`, file: { revision: { revisionId, repository: 'eco@local' }, size } });

  it('batches by workspace and by bytes, a revision past the limit alone', () => {
    const half = MAX_BATCH_BYTES / 2;
    const batches = batchesOf([waiting(1, half), waiting(2, half), waiting(3, 1), waiting(4, MAX_BATCH_BYTES * 2), waiting(5, 1, '/other')], '/tmp/s');
    expect(batches.map((batch) => batch.map((one) => one.file.revision.revisionId))).toEqual([[1, 2], [3], [4], [5]]);
  });

  it('fits each command line Windows can start', () => {
    const many = Array.from({ length: 2000 }, (_, i) => waiting(i, 1));
    const batches = batchesOf(many, join('C:', 'Users', 'Jo Smith', 'AppData', 'Local', 'Temp', 'uvcs-revisions-x'));
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toHaveLength(2000);
  });

  it('downloads each revision alone, as --file, into a folder whose path holds a ;', () => {
    const batches = batchesOf([waiting(1, 1), waiting(2, 1)], '/tmp/a;b');
    expect(batches).toHaveLength(2);
    expect(catArgs(batches[0]!, '/tmp/a;b')).toEqual(['cat', 'revid:1@eco@local', `--file=${join('/tmp/a;b', createHash('sha1').update('1@eco@local').digest('hex'))}`]);
  });
});

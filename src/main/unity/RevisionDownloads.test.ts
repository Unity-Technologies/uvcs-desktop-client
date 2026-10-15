import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catReadsOf, fakeCat } from '../cm/testing/fakeCat';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import { formatOutput } from '../cm/testing/cmOutput';
import { WorkspaceCopies, type RevisionFile } from '../files/WorkspaceCopies';
import { batchesOf, MAX_BATCH_BYTES, RevisionDownloads } from './RevisionDownloads';

const md5 = (text: string) => createHash('md5').update(text).digest('base64');

/** The content of each revision on the server, by id. */
const SERVER: Record<number, string> = { 1: 'bark v1', 2: 'leaves v2', 3: 'moss v3' };

/** `cm cat` as `cm` does it, of the revisions on the server. */
const catAnswer = fakeCat((revisionSpec) => SERVER[Number(/^revid:(\d+)@/.exec(revisionSpec)?.[1])]);

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

  it("reads a texture of a diff's side before (its hash unknown) from the disk where the workspace holds that revision unchanged", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'revisions-workspace-'));
    await mkdir(join(workspace, 'Art'));
    await writeFile(join(workspace, 'Art', 'bark.png'), 'bark v1');
    const fake = fakeCmClient({ ls: formatOutput(['Art/bark.png', 'bin', 1, md5('bark v1'), 7, 'rep:eco@local']), cat: catAnswer });
    const downloads = new RevisionDownloads({ cm: fake.cm, copies: new WorkspaceCopies({ cm: fake.cm }), tempFolder: await mkdtemp(join(tmpdir(), 'revisions-session-')), pid: 100, isRunning: () => false });

    expect((await downloads.read(workspace, file(1, 'Art/bark.png'))).toString()).toBe('bark v1');
    expect(fake.lines().map((line) => line.split(' ')[0])).toEqual(['ls']);
  });

  it('tells each revision of a batch apart: one cm has not fails alone', async () => {
    const { workspace, downloads, text } = await setUp();
    const [found, gone] = await Promise.allSettled([text(downloads.read(workspace, file(3))), text(downloads.read(workspace, file(404)))]);
    expect(found).toEqual({ status: 'fulfilled', value: 'moss v3' });
    expect(gone).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('revid:404@eco@local') } });
  });

  it("keeps no file cut short by a cm cat that failed: one whose size or hash isn't the listed one goes", async () => {
    const { workspace, sessions, text } = await setUp();
    const cut = new RevisionDownloads({
      cm: fakeCmClient({
        cat: async ({ args }) => {
          for (const { target } of catReadsOf(args)) await writeFile(target, 'bark v');
          return cmFails('The connection was closed');
        },
      }).cm,
      tempFolder: sessions,
      pid: 100,
      isRunning: () => false,
    });
    await expect(cut.read(workspace, file(1, 'Art/1.png', md5('bark v1'), 7))).rejects.toThrow('closed');
    // A whole one in the same failed command stays, its size and hash as listed.
    const whole = new RevisionDownloads({ cm: fakeCmClient({ cat: async ({ args }) => (await writeFile(catReadsOf(args)[0]!.target, 'bark v1'), cmFails('The connection was closed')) }).cm, tempFolder: sessions, pid: 100, isRunning: () => false });
    expect(await text(whole.read(workspace, file(1, 'Art/1.png', md5('bark v1'), 7)))).toBe('bark v1');
  });

  it('reads each revision of a batch bigger than what is kept: one let go meanwhile is downloaded again', async () => {
    const { workspace, downloads, text } = await setUp('leaves v2'.length);
    expect(await Promise.all([text(downloads.read(workspace, file(1))), text(downloads.read(workspace, file(2)))])).toEqual(['bark v1', 'leaves v2']);
  });

  it("downloads again alone a revision a failed batch can't tell whole (its size and hash unknown)", async () => {
    const { workspace, fake, downloads, text } = await setUp();
    const [found] = await Promise.allSettled([text(downloads.read(workspace, file(3))), text(downloads.read(workspace, file(404)))]);
    expect(found).toEqual({ status: 'fulfilled', value: 'moss v3' });
    expect(fake.commands.map((command) => catReadsOf(command.args).length)).toEqual([2, 1]);
  });

  it("downloads again, together in one more batch, the revisions a failed batch can't tell whole: never one process each", async () => {
    const { workspace, fake, downloads, text } = await setUp();
    const reads = [file(1), file(2), file(3), file(404)].map((asked) => text(downloads.read(workspace, asked)));
    const results = await Promise.allSettled(reads);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'rejected']);
    expect(fake.commands.map((command) => catReadsOf(command.args).length)).toEqual([4, 3]);
  });

  it('refuses unread a revision listed past what is read', async () => {
    const { workspace, fake, downloads } = await setUp();
    await expect(downloads.read(workspace, file(1, 'Art/huge.psd', null, 200 * 1024 * 1024))).rejects.toThrow('too large');
    expect(fake.commands).toEqual([]);
  });

  it('makes its folder again when the OS cleaned it away during the session', async () => {
    const { workspace, sessions, downloads, text } = await setUp();
    await text(downloads.read(workspace, file(1)));
    const [folder] = (await readdir(sessions)).filter((name) => name.startsWith('uvcs-revisions-100-'));
    await rm(join(sessions, folder!), { recursive: true });
    expect(await text(downloads.read(workspace, file(1)))).toBe('bark v1');
    expect(await text(downloads.read(workspace, file(2)))).toBe('leaves v2');
  });

  it("quits even when the folder can't be deleted (a file Windows holds): the next session deletes it", async () => {
    const { workspace, sessions, fake } = await setUp();
    const held = new RevisionDownloads({ cm: fake.cm, tempFolder: sessions, pid: 100, isRunning: () => false, removeFolder: () => { throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); } });
    await held.read(workspace, file(1));
    expect(() => held.dispose()).not.toThrow();
  });

  it('waits for every read asked at once to check the disk, so a slow check never splits the batch', async () => {
    const { workspace, fake, downloads, text } = await setUp();
    await mkdir(join(workspace, 'Art'), { recursive: true });
    // Same size as listed but other content: hashed (read in full) before it is known to need a download.
    await writeFile(join(workspace, 'Art', 'big.png'), Buffer.alloc(4 * 1024 * 1024, 1));
    const reads = [text(downloads.read(workspace, file(2))), text(downloads.read(workspace, file(1, 'Art/big.png', md5('bark v1'), 4 * 1024 * 1024)))];
    await Promise.allSettled(reads);
    expect(fake.commands).toHaveLength(1);
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
  const waiting = (revisionId: number, size: number, workspacePath = '/w', repository = 'eco@local') => ({ workspacePath, target: `t${revisionId}`, file: { revision: { revisionId, repository }, size } });

  it('batches by workspace, by repository and by bytes, a revision past the limit alone', () => {
    const half = MAX_BATCH_BYTES / 2;
    const batches = batchesOf([waiting(1, half), waiting(2, half), waiting(3, 1), waiting(4, MAX_BATCH_BYTES * 2), waiting(5, 1, '/other'), waiting(6, 1, '/w', 'art@local')], '/tmp/s');
    expect(batches.map((batch) => batch.map((one) => one.file.revision.revisionId))).toEqual([[1, 2], [3], [4], [6], [5]]);
  });
});

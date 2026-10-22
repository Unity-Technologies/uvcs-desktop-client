import { mkdtemp, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { DiskDetails, MAX_READS_AT_ONCE, type ReadLinkStats } from './DiskDetails';

const pending = (path: string, kinds: PendingChange['kinds'] = ['private'], itemType: PendingChange['itemType'] = 'file'): PendingChange => ({ path, kinds, itemType, size: 0, lastModified: '' });

/** An `lstat` that answers when the test says (`answerAll`), counting the reads asked and how many ran at once. */
function heldLinkStats(link = new Set<string>()) {
  const waiting: (() => void)[] = [];
  const asked: string[] = [];
  let running = 0;
  let mostAtOnce = 0;
  const readLinkStats: ReadLinkStats = (path, done) => {
    asked.push(path);
    mostAtOnce = Math.max(mostAtOnce, ++running);
    waiting.push(() => {
      running--;
      done(null, { size: path.length, mtimeMs: Date.UTC(2026, 9, 22), isSymbolicLink: () => link.has(path) });
    });
  };
  const answerAll = (): void => {
    while (waiting.length > 0) waiting.shift()!();
  };
  return { readLinkStats, asked, answerAll, mostAtOnce: () => mostAtOnce };
}

describe('DiskDetails', () => {
  it('reads the size and date of each file on disk, and tells links apart', async () => {
    const { readLinkStats, answerAll } = heldLinkStats(new Set(['/w/link']));
    const details = new DiskDetails(readLinkStats);
    const [file, link] = [pending('a.txt'), pending('link', ['changed'])];
    details.add(file, '/w/a.txt');
    details.add(link, '/w/link');
    const finished = details.finished();
    answerAll();
    await finished;

    expect(file).toEqual({ path: 'a.txt', kinds: ['private'], itemType: 'file', size: 8, lastModified: '2026-10-22T00:00:00.000Z' });
    expect(link).toMatchObject({ itemType: 'symlink', size: 7 });
  });

  it('reads nothing of folders and of items gone from the disk', async () => {
    const { readLinkStats, asked } = heldLinkStats();
    const details = new DiskDetails(readLinkStats);
    details.add(pending('assets', ['added'], 'directory'), '/w/assets');
    details.add(pending('gone.txt', ['locallyDeleted']), '/w/gone.txt');
    details.add(pending('removed.txt', ['deleted']), '/w/removed.txt');

    await details.finished();
    expect(asked).toEqual([]);
  });

  it('reads thousands of files a few at a time, each once, and finishes once the last is read', async () => {
    const { readLinkStats, asked, answerAll, mostAtOnce } = heldLinkStats();
    const details = new DiskDetails(readLinkStats);
    const changes = Array.from({ length: 2_000 }, (_, index) => pending(`f${index}.txt`));
    for (const change of changes) details.add(change, `/w/${change.path}`);
    let done = false;
    const finished = details.finished().then(() => (done = true));

    expect(asked).toHaveLength(MAX_READS_AT_ONCE);
    answerAll();
    await finished;
    expect(done).toBe(true);
    expect(asked).toHaveLength(2_000);
    expect(mostAtOnce()).toBe(MAX_READS_AT_ONCE);
    expect(changes.every((change) => change.size > 0)).toBe(true);
  });

  it('reads the disk itself, and leaves a file that vanished meanwhile without details', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'uvcs-disk-details-'));
    const file = join(folder, 'a.txt');
    await writeFile(file, 'four');
    await utimes(file, new Date('2026-10-22T10:00:00Z'), new Date('2026-10-22T10:00:00Z'));
    const [found, vanished] = [pending('a.txt'), pending('b.txt')];
    const details = new DiskDetails();
    details.add(found, file);
    details.add(vanished, join(folder, 'b.txt'));
    await details.finished();

    expect(found).toMatchObject({ itemType: 'file', size: 4, lastModified: '2026-10-22T10:00:00.000Z' });
    expect(vanished).toMatchObject({ size: 0, lastModified: '' });
  });
});

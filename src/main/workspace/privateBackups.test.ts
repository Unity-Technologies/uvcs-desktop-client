import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { moveAside, putBack } from './privateBackups';

let workspace: string;
let backup: string;

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'uvcs-backups-'));
  workspace = join(root, 'wk');
  backup = join(root, 'backup');
  await mkdir(workspace);
});

async function write(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

const read = (root: string, path: string): Promise<string> => readFile(join(root, path), 'utf8');

describe('putBack', () => {
  it('moves the items back where nothing took their place, and removes the backup', async () => {
    await write(workspace, 'src/new.txt', 'added');
    await write(workspace, 'assets/new/a.txt', 'a');
    await moveAside(workspace, ['src/new.txt', 'assets/new'], backup);
    expect(existsSync(join(workspace, 'src/new.txt'))).toBe(false);

    expect(await putBack(workspace, { directory: backup, paths: ['src/new.txt', 'assets/new'] })).toBe(true);
    expect(await read(workspace, 'src/new.txt')).toBe('added');
    expect(await read(workspace, 'assets/new/a.txt')).toBe('a');
    expect(existsSync(backup)).toBe(false);
  });

  it('drops a file the shelve already brought back with the same content', async () => {
    await write(workspace, 'src/new.txt', 'added');
    await moveAside(workspace, ['src/new.txt'], backup);
    await write(workspace, 'src/new.txt', 'added');

    expect(await putBack(workspace, { directory: backup, paths: ['src/new.txt'] })).toBe(true);
    expect(existsSync(backup)).toBe(false);
  });

  it('puts a folder back item by item: private files inside an added folder come back once the shelve recreated it', async () => {
    await write(workspace, 'assets/new/a.txt', 'a');
    await write(workspace, 'assets/new/notes.log', 'private');
    await moveAside(workspace, ['assets/new'], backup);
    await write(workspace, 'assets/new/a.txt', 'a');

    expect(await putBack(workspace, { directory: backup, paths: ['assets/new'] })).toBe(true);
    expect(await read(workspace, 'assets/new/notes.log')).toBe('private');
    expect(existsSync(backup)).toBe(false);
  });

  it('never overwrites a different file that took the place: it stays in the backup', async () => {
    await write(workspace, 'src/new.txt', 'added');
    await write(workspace, 'src/other.txt', 'other');
    await moveAside(workspace, ['src/new.txt', 'src/other.txt'], backup);
    await write(workspace, 'src/new.txt', 'a private file made meanwhile');

    expect(await putBack(workspace, { directory: backup, paths: ['src/new.txt', 'src/other.txt'] })).toBe(false);
    expect(await read(workspace, 'src/new.txt')).toBe('a private file made meanwhile');
    expect(await read(workspace, 'src/other.txt')).toBe('other');
    expect(await read(backup, 'src/new.txt')).toBe('added');
    expect(existsSync(join(backup, 'src/other.txt'))).toBe(false);
  });
});

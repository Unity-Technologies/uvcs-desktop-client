import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import { CmError } from '../cm/CmError';
import { statusRecordsArgs } from '../cm/pendingChangesRecords';
import { change, pendingStatus, recordsOutput } from '../cm/testing/cmOutput';
import { catReadsOf, fakeCat } from '../cm/testing/fakeCat';
import { cmFails, fakeCmClient, runsUntilCancelled, type CmAnswer, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import { TREE_ITEMS } from '../cm/treeItems';
import { DiskDetails } from '../files/DiskDetails';
import { OperationTracker } from '../operations/OperationTracker';
import { createPendingChangesService } from './pendingChangesService';
import type { SwitchContext } from './ServiceContext';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const at = (...parts: string[]): string => join(WORKSPACE, ...parts);

function pendingChanges(answers: Record<string, CmAnswer>, operations?: OperationTracker) {
  const fake = fakeCmClient(answers);
  const context = serviceContext(fake.cm, operations ? { operations } : {});
  return { ...fake, service: createPendingChangesService(context, {} as SwitchContext), operations: context.operations };
}

// As the server formats ITEMS_ALREADY_LOCKED: the header, then one line per item.
const LOCKED_OUTPUT = 'These items are exclusively checked out by: \n/art/Hero.fbx (wk:ana-wk owner:ana)\n';

const NO_FILTER: PendingChangesFilter = {
  detectLocalMoves: false,
  moveSimilarityPercent: 90,
  showPrivate: false,
  showIgnored: false,
  showCloaked: false,
  showHiddenChanged: false,
};

describe('pending changes list', () => {
  it('reads the pending changes with one local cm status in the workspace, as records read as they arrive', async () => {
    const { service, commands } = pendingChanges({ status: pendingStatus(WORKSPACE, change('CH', 'src/player.cs')) });

    const snapshot = await service.list(WORKSPACE, NO_FILTER);

    expect(commands).toMatchObject([
      {
        via: 'query',
        args: statusRecordsArgs('--iscochanged', '--changelists', '--controlledchanged', '--changed', '--localdeleted'),
        options: { cwd: WORKSPACE },
        readsRecords: true,
      },
    ]);
    expect(snapshot.changes.map((change) => [change.path, change.kinds])).toEqual([['src/player.cs', ['changed']]]);
  });

  it("reads each file's size and date from the disk, which cm status records don't hold, and none of a deleted one", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'uvcs-pending-'));
    await writeFile(join(workspace, 'new.txt'), 'twelve bytes');
    const { service } = pendingChanges({ status: pendingStatus(workspace, change('PR', 'new.txt'), change('LD', 'gone.txt')) });

    const { changes } = await service.list(workspace, NO_FILTER);

    expect(changes[0]).toMatchObject({ path: 'new.txt', size: 12 });
    expect(Date.parse(changes[0]!.lastModified)).toBeGreaterThan(0);
    expect(changes[1]).toEqual({ path: 'gone.txt', kinds: ['locallyDeleted'], itemType: 'file', size: 0, lastModified: '' });
  });

  // A junction, so Windows makes it without Developer Mode; on macOS `/tmp` is such a link to `/private/tmp`.
  it('reads a workspace reached through a link, whose paths cm prints from the folder the link resolves to', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uvcs-linked-'));
    const target = join(root, 'target');
    const link = join(root, 'link');
    await mkdir(target);
    await symlink(target, link, 'junction');
    const { service } = pendingChanges({ status: pendingStatus(await realpath(link), change('CH', 'src/a.ts')) });

    const { changes } = await service.list(link, NO_FILTER);

    expect(changes.map((item) => item.path)).toEqual(['src/a.ts']);
  });

  it('stops reading files from the disk once cm status fails', async () => {
    const stop = vi.spyOn(DiskDetails.prototype, 'stop');
    onTestFinished(() => stop.mockRestore());
    const { service } = pendingChanges({ status: cmFails('Error: the workspace is locked') });

    await expect(service.list(WORKSPACE, NO_FILTER)).rejects.toThrow('the workspace is locked');
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe('checkin', () => {
  it('checks the paths in with one cm checkin of its own process, the comment in a file deleted afterwards', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', 'CI_START\nCHANGESET cs:43@br:/main/task1@game@local\n');
    const { service, commands } = pendingChanges({ checkin: answer });

    const result = await service.checkin(WORKSPACE, { paths: ['src/player.cs', 'assets/hero.png'], comment: 'Jump higher\n\nTuned for the new level', addsPrivate: true }, 'op-1');

    expect(result).toEqual({ kind: 'created', changesetId: 43, branch: '/main/task1' });
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      via: 'execute',
      args: ['checkin', at('src', 'player.cs'), at('assets', 'hero.png'), '--all', '--dependencies', '--private', `-commentsfile=${seen.file}`, '--machinereadable', '--symlink'],
      options: { cwd: WORKSPACE },
    });
    expect(seen.content).toBe('Jump higher\n\nTuned for the new level');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('reports a checkin that found nothing left to record', async () => {
    const { service } = pendingChanges({ checkin: 'CI_START\nNO_CHANGES_APPLIED\n' });

    expect(await service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c', addsPrivate: false }, 'op-1')).toEqual({ kind: 'noChanges' });
  });

  it('deletes the comment file when the checkin fails', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', cmFails('Error: The server is unreachable.'));
    const { service } = pendingChanges({ checkin: answer });

    await expect(service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c', addsPrivate: false }, 'op-1')).rejects.toThrow('The server is unreachable.');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('names who holds the lock when a checkin meets items locked by someone else', async () => {
    const { service } = pendingChanges({ checkin: cmFails(LOCKED_OUTPUT) });

    const error = await service.checkin(WORKSPACE, { paths: ['art/Hero.fbx'], comment: 'c', addsPrivate: false }, 'op-1').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CmError);
    expect((error as CmError).message).toBe("Hero.fbx is locked by ana (workspace ana-wk), so it can't be checked in until the lock is released.");
  });

  it("stops the checkin's process when the operation is cancelled", async () => {
    const { service, operations } = pendingChanges({
      checkin: runsUntilCancelled('Operation aborted'),
    });

    const checkin = service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c', addsPrivate: false }, 'op-7');
    operations.cancel('op-7');

    await expect(checkin).rejects.toThrow('Operation aborted');
  });

  it("reports the checkin's upload as the operation's progress", async () => {
    const progress: OperationProgress[] = [];
    const operations = new OperationTracker((_id, report) => progress.push(report), () => undefined);
    const { service } = pendingChanges(
      {
        checkin: ({ options }) => {
          ['CI_START', 'STAGE Uploading file data 1 MB/4 MB'].forEach((line) => options.onOutputLine?.(line));
          return 'CHANGESET cs:43@br:/main@game@local\n';
        },
      },
      operations,
    );

    await service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c', addsPrivate: false }, 'op-1');

    expect(progress.at(-1)).toMatchObject({ stage: 'uploading', fraction: 0.25 });
  });
});

describe('checkout', () => {
  it('checks the links themselves out with one quick command', async () => {
    const { service, commands } = pendingChanges({ checkout: '' });

    await service.checkout(WORKSPACE, ['art/Hero.fbx', 'link']);

    expect(commands).toMatchObject([{ via: 'query', args: ['checkout', at('art', 'Hero.fbx'), at('link'), '--symlink'] }]);
  });

  it('names who holds the lock when the items are locked by someone else', async () => {
    const { service } = pendingChanges({ checkout: cmFails(LOCKED_OUTPUT) });

    await expect(service.checkout(WORKSPACE, ['art/Hero.fbx'])).rejects.toThrow(
      "Hero.fbx is locked by ana (workspace ana-wk), so it can't be checked out until the lock is released.",
    );
  });

  it('keeps any other failure as cm reported it', async () => {
    const { service } = pendingChanges({ checkout: cmFails('Error: The item /art/Hero.fbx is not in the workspace.') });

    await expect(service.checkout(WORKSPACE, ['art/Hero.fbx'])).rejects.toThrow('The item /art/Hero.fbx is not in the workspace.');
  });
});

describe('undo, add and remove', () => {
  it('undoes the chosen items, links themselves, with one command', async () => {
    const { service, commands } = pendingChanges({ undo: '' });

    await service.undo(WORKSPACE, ['src/a.cs', 'src/b.cs']);

    expect(commands).toMatchObject([{ via: 'query', args: ['undo', at('src', 'a.cs'), at('src', 'b.cs'), '--symlink'], options: { cwd: WORKSPACE } }]);
  });

  it('undoes unchanged checkouts of the chosen items, or of the whole workspace', async () => {
    const { service, commands } = pendingChanges({ undo: '' });

    await service.undoUnchanged(WORKSPACE, ['src/a.cs']);
    await service.undoUnchanged(WORKSPACE);

    expect(commands.map((command) => command.args)).toEqual([
      ['undo', '--unchanged', at('src', 'a.cs')],
      ['undo', '--unchanged', '-r', WORKSPACE],
    ]);
  });

  it('adds items with their parents, and removes items, one command each', async () => {
    const { service, commands } = pendingChanges({ add: '', remove: '' });

    await service.add(WORKSPACE, ['new/a.cs', 'new/b.cs']);
    await service.remove(WORKSPACE, ['old.cs']);

    expect(commands.map((command) => command.args)).toEqual([
      ['add', '--coparent', at('new', 'a.cs'), at('new', 'b.cs')],
      ['remove', at('old.cs')],
    ]);
  });
});

describe('recording a move', () => {
  it('moves the item deleted from disk onto the new one with one quick cm move', async () => {
    const { service, commands } = pendingChanges({ move: 'src/a.cs has been moved to src/b.cs' });

    await service.recordMove(WORKSPACE, 'src/a.cs', 'src/b.cs');

    expect(commands).toMatchObject([{ via: 'query', args: ['move', at('src', 'a.cs'), at('src', 'b.cs')], options: { cwd: WORKSPACE } }]);
  });

  it("fails as cm refuses: the new item's folder isn't under version control", async () => {
    const { service } = pendingChanges({ move: cmFails("newdir is a private directory. It can't be moved.") });

    await expect(service.recordMove(WORKSPACE, 'src/a.cs', 'newdir/a.cs')).rejects.toThrow(/private directory/);
  });
});

describe('how alike the items of a move are', () => {
  /** A workspace on disk holding the new files, and `cm` answering for the deleted ones as it would. */
  async function measuring(deleted: Record<string, { type: 'txt' | 'bin'; content: Buffer | string }>, added: Record<string, Buffer | string>) {
    const workspace = await mkdtemp(join(tmpdir(), 'similar-'));
    for (const [path, content] of Object.entries(added)) {
      await mkdir(join(workspace, ...path.split('/').slice(0, -1)), { recursive: true });
      await writeFile(join(workspace, ...path.split('/')), content);
    }
    const listed = Object.entries(deleted).map(([path, { type, content }], index) => ({ path, type, content, revid: 10 + index }));
    const absolute = (path: string) => join(workspace, ...path.split('/'));
    // `cm ls` prints the path relative to the workspace, in the OS's separators, and fails on one it can't find, as
    // it prints it, having listed the others.
    const ls = ({ args }: FakeCmCommand) => {
      const records = recordsOutput(
        TREE_ITEMS,
        ...listed
          .filter(({ path }) => args.includes(absolute(path)))
          .map(({ path, type, content, revid }) => ({ name: path.split('/').pop()!, wkpath: path.split('/').join(sep), type, size: content.length, revid, repspec: 'rep:game@local', changeset: 3 })),
      );
      const unknown = args.slice(1, -1).filter((arg) => !listed.some(({ path }) => absolute(path) === arg));
      // As cm prints a path it can't find on Windows: the drive letter in lower case, the rest as asked.
      const printed = (path: string) => path.replace(/^[A-Z]:/, (drive) => drive.toLowerCase());
      return unknown.length > 0 ? cmFails(`${unknown.map((path) => `Item ${printed(path)} not found.`).join('\n')}\n${records}`) : records;
    };
    const cat = fakeCat((catSpec) => listed.find(({ revid }) => catSpec === `revid:${revid}@game@local`)?.content);
    return { workspace, ...pendingChanges({ ls, cat }) };
  }

  it("lists again without a path cm ls couldn't find, and measures the others", async () => {
    const { workspace, service, commands } = await measuring({ 'src/Player.cs': { type: 'txt', content: 'a\n' } }, { 'src/Hero.cs': 'a\n' });

    const similarities = await service.moveSimilarities(workspace, [
      { deleted: 'src/Archive/Old2.cs', added: 'src/Hero.cs' },
      { deleted: 'src/Player.cs', added: 'src/Hero.cs' },
    ]);

    expect(similarities).toEqual(['notMeasured', 1]);
    expect(commands.map(({ args }) => args.slice(0, -1))).toEqual([
      ['ls', join(workspace, 'src', 'Archive', 'Old2.cs'), join(workspace, 'src', 'Player.cs')],
      ['ls', join(workspace, 'src', 'Player.cs')],
      ['cat', 'revid:10@game@local'],
    ]);
  });

  it('lists the deleted files with one cm ls, reads only the text ones by revision, and the new ones from disk', async () => {
    const { workspace, service, commands } = await measuring(
      { 'src/Player.cs': { type: 'txt', content: 'a\nb\nc\nx\n' }, 'src/Enemy.cs': { type: 'txt', content: 'q\nr\n' }, 'art/hero.png': { type: 'bin', content: Buffer.alloc(1000, 0) } },
      { 'src/Hero.cs': 'a\nb\nc\nd\n', 'art/new.png': Buffer.alloc(900, 0) },
    );

    const similarities = await service.moveSimilarities(workspace, [
      { deleted: 'src/Player.cs', added: 'src/Hero.cs' },
      { deleted: 'src/Enemy.cs', added: 'src/Hero.cs' },
      { deleted: 'art/hero.png', added: 'art/new.png' },
      { deleted: 'src/Player.cs', added: 'art/new.png' },
    ]);

    expect(similarities[0]).toBeCloseTo(0.5);
    expect(similarities[1]).toBe(0);
    expect(similarities[2]).toBeCloseTo(0.9);
    expect(similarities[3]).toBe('notPairable');
    expect(commands.map(({ args, via }) => [args[0], via])).toEqual([
      ['ls', 'query'],
      ['cat', 'query'],
    ]);
    expect(commands[0]!.args.slice(1, -1)).toEqual([join(workspace, 'src', 'Player.cs'), join(workspace, 'src', 'Enemy.cs'), join(workspace, 'art', 'hero.png')]);
    expect(catReadsOf(commands[1]!.args).map((read) => read.spec)).toEqual(['revid:10@game@local', 'revid:11@game@local']);
  });

  // `RevisionCat` reads up to `MAX_QUICK_CAT` revisions in a pooled shell, one such command after another.
  it('reads six deleted text files with two quick cm cats', async () => {
    const deleted = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`src/Old${index}.cs`, { type: 'txt' as const, content: `line ${index}\n` }]));
    const { workspace, service, commands } = await measuring(deleted, { 'src/New.cs': 'line 0\n' });

    const similarities = await service.moveSimilarities(workspace, Object.keys(deleted).map((path) => ({ deleted: path, added: 'src/New.cs' })));

    expect(similarities).toEqual([1, 0, 0, 0, 0, 0]);
    expect(commands.map(({ args, via }) => [args[0], via])).toEqual([
      ['ls', 'query'],
      ['cat', 'query'],
      ['cat', 'query'],
    ]);
  });

  it("refuses a path outside the workspace: the window isn't trusted", async () => {
    const { workspace, service, commands } = await measuring({}, {});

    await expect(service.moveSimilarities(workspace, [{ deleted: '../secret.cs', added: 'a.cs' }])).resolves.toEqual(['notMeasured']);
    await expect(service.moveSimilarities(workspace, [{ deleted: 'a.cs', added: '../../etc/passwd' }])).resolves.toEqual(['notMeasured']);
    expect(commands.filter(({ args }) => args.some((arg) => arg.includes('secret')))).toEqual([]);
  });
});

describe('shelve', () => {
  it('shelves the paths with one cm shelveset of its own process and returns the new shelve', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', 'sh:12@game@local\n');
    const { service, commands } = pendingChanges({ 'shelveset create': answer });

    const shelveId = await service.shelve(WORKSPACE, ['src/a.cs'], 'Half done', 'op-1');

    expect(shelveId).toBe(12);
    expect(commands).toMatchObject([
      { via: 'execute', args: ['shelveset', 'create', at('src', 'a.cs'), '--all', '--dependencies', `-commentsfile=${seen.file}`, '--summaryformat'] },
    ]);
    expect(seen.content).toBe('Half done');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('fails when cm reports no shelve', async () => {
    const { service } = pendingChanges({ 'shelveset create': '\n' });

    await expect(service.shelve(WORKSPACE, ['src/a.cs'], 'c', 'op-1')).rejects.toThrow('no shelve id was reported');
  });
});

describe('changelists', () => {
  it('creates a persistent changelist', async () => {
    const { service, lines } = pendingChanges({ changelist: '' });

    await service.createChangelist(WORKSPACE, { name: 'UI', description: 'Polish' });

    expect(lines()).toEqual(['changelist create UI Polish --persistent']);
  });

  it('sends only what the edit changes: renaming a described changelist leaves its description alone', async () => {
    const { service, lines } = pendingChanges({ changelist: '' });

    await service.editChangelist(WORKSPACE, 'UI', { description: 'More polish' });
    await service.editChangelist(WORKSPACE, 'UI', { name: 'Menus' });
    await service.editChangelist(WORKSPACE, 'UI', { name: 'UI' });

    expect(lines()).toEqual(['changelist edit UI description More polish', 'changelist edit UI rename Menus']);
  });

  it('moves items to a changelist, or back to the default one', async () => {
    const { service, commands } = pendingChanges({ changelist: '' });

    await service.moveToChangelist(WORKSPACE, 'UI', ['a.cs']);
    await service.moveToChangelist(WORKSPACE, null, ['a.cs']);
    await service.deleteChangelist(WORKSPACE, 'UI');

    expect(commands.map((command) => command.args)).toEqual([
      ['changelist', 'UI', 'add', at('a.cs')],
      ['changelist', 'Default', 'add', at('a.cs')],
      ['changelist', 'delete', 'UI'],
    ]);
  });
});

describe('filter rules', () => {
  it("adds a rule to the workspace's own rule file, keeping the rules there", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'rules-'));
    await writeFile(join(workspace, 'ignore.conf'), 'Library\n', 'utf8');
    const { service, commands } = pendingChanges({});

    await service.addFilterRules(workspace, 'ignore', ['Temp', 'Library', 'Logs']);
    await service.addFilterRules(workspace, 'cloaked', ['Assets/Big']);

    expect(await readFile(join(workspace, 'ignore.conf'), 'utf8')).toBe('Library\nTemp\nLogs\n');
    expect(await readFile(join(workspace, 'cloaked.conf'), 'utf8')).toContain('Assets/Big');
    expect(commands).toEqual([]);
  });
});

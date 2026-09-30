import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import { CmError } from '../cm/CmError';
import { cmFails, fakeCmClient, optionValue, runsUntilCancelled, type CmAnswer, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import { OperationTracker } from '../operations/OperationTracker';
import { createPendingChangesService } from './pendingChangesService';
import type { SwitchContext } from './ServiceContext';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const at = (...parts: string[]): string => join(WORKSPACE, ...parts);

function pendingChanges(answers: Record<string, CmAnswer>, operations?: OperationTracker) {
  const fake = fakeCmClient(answers);
  const context = serviceContext(fake.cm, operations ? { operations } : {});
  return { ...fake, service: createPendingChangesService(context, {} as SwitchContext), operations: context.operations };
}

/** Answers with `output`, keeping what the command's comment file held while it ran. */
function readingComment(output: string) {
  const seen = { commentsFile: '', comment: '' };
  const answer = ({ args }: FakeCmCommand): string => {
    seen.commentsFile = optionValue(args, '-commentsfile=') ?? '';
    seen.comment = readFileSync(seen.commentsFile, 'utf8');
    return output;
  };
  return { seen, answer };
}

const STATUS_XML = `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><Changeset>7</Changeset></Status></WorkspaceStatus>
  <Changes>
    <Change><Type>CH</Type><Path>src/player.cs</Path><OldPath /><MergesInfo /><SimilarityPerUnit>0</SimilarityPerUnit><Size>3</Size><RevisionType>enTextFile</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change>
  </Changes>
</StatusOutput>`;

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
  it('reads the pending changes with one local cm status in the workspace', async () => {
    const { service, commands } = pendingChanges({ status: STATUS_XML });

    const snapshot = await service.list(WORKSPACE, NO_FILTER);

    expect(commands).toMatchObject([
      {
        via: 'query',
        line: 'status --xml --iscochanged --changelists --controlledchanged --changed --localdeleted',
        options: { cwd: WORKSPACE },
      },
    ]);
    expect(snapshot.changes.map((change) => [change.path, change.kinds])).toEqual([['src/player.cs', ['changed']]]);
  });

  it('asks cm for each kind of change the filter shows', async () => {
    const { service, lines } = pendingChanges({ status: STATUS_XML });

    await service.list(WORKSPACE, {
      detectLocalMoves: true,
      moveSimilarityPercent: 80,
      showPrivate: true,
      showIgnored: true,
      showCloaked: true,
      showHiddenChanged: true,
    });

    expect(lines()).toEqual([
      'status --xml --iscochanged --changelists --controlledchanged --changed --localdeleted --localmoved --percentofsimilarity=80 --private --ignored --cloaked --hiddenchanged',
    ]);
  });
});

describe('checkin', () => {
  it('checks the paths in with one cm checkin of its own process, the comment in a file deleted afterwards', async () => {
    const { seen, answer } = readingComment('CI_START\nCHANGESET cs:43@br:/main/task1@game@local\n');
    const { service, commands } = pendingChanges({ checkin: answer });

    const result = await service.checkin(WORKSPACE, { paths: ['src/player.cs', 'assets/hero.png'], comment: 'Jump higher\n\nTuned for the new level' }, 'op-1');

    expect(result).toEqual({ kind: 'created', changesetId: 43, branch: '/main/task1' });
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      via: 'execute',
      args: ['checkin', at('src', 'player.cs'), at('assets', 'hero.png'), '--all', '--private', `-commentsfile=${seen.commentsFile}`, '--machinereadable', '--symlink'],
      options: { cwd: WORKSPACE },
    });
    expect(seen.comment).toBe('Jump higher\n\nTuned for the new level');
    expect(existsSync(seen.commentsFile)).toBe(false);
  });

  it('reports a checkin that found nothing left to record', async () => {
    const { service } = pendingChanges({ checkin: 'CI_START\nNO_CHANGES_APPLIED\n' });

    expect(await service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c' }, 'op-1')).toEqual({ kind: 'noChanges' });
  });

  it('deletes the comment file when the checkin fails', async () => {
    let commentsFile = '';
    const { service } = pendingChanges({
      checkin: ({ args }) => {
        commentsFile = optionValue(args, '-commentsfile=')!;
        return cmFails('Error: The server is unreachable.');
      },
    });

    await expect(service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c' }, 'op-1')).rejects.toThrow('The server is unreachable.');
    expect(existsSync(commentsFile)).toBe(false);
  });

  it('names who holds the lock when a checkin meets items locked by someone else', async () => {
    const { service } = pendingChanges({ checkin: cmFails(LOCKED_OUTPUT) });

    const error = await service.checkin(WORKSPACE, { paths: ['art/Hero.fbx'], comment: 'c' }, 'op-1').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CmError);
    expect((error as CmError).message).toBe("Hero.fbx is locked by ana (workspace ana-wk), so it can't be checked in until the lock is released.");
  });

  it("stops the checkin's process when the operation is cancelled", async () => {
    const { service, operations } = pendingChanges({
      checkin: runsUntilCancelled('Operation aborted'),
    });

    const checkin = service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c' }, 'op-7');
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

    await service.checkin(WORKSPACE, { paths: ['a.txt'], comment: 'c' }, 'op-1');

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

describe('shelve', () => {
  it('shelves the paths with one cm shelveset of its own process and returns the new shelve', async () => {
    const { seen, answer } = readingComment('sh:12@game@local\n');
    const { service, commands } = pendingChanges({ 'shelveset create': answer });

    const shelveId = await service.shelve(WORKSPACE, ['src/a.cs'], 'Half done', 'op-1');

    expect(shelveId).toBe(12);
    expect(commands).toMatchObject([
      { via: 'execute', args: ['shelveset', 'create', at('src', 'a.cs'), '--all', `-commentsfile=${seen.commentsFile}`, '--summaryformat'] },
    ]);
    expect(seen.comment).toBe('Half done');
    expect(existsSync(seen.commentsFile)).toBe(false);
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

  it('edits only what changed: the description, the name, or both', async () => {
    const { service, lines } = pendingChanges({ changelist: '' });

    await service.editChangelist(WORKSPACE, 'UI', { name: 'UI', description: 'More polish' });
    await service.editChangelist(WORKSPACE, 'UI', { name: 'Menus', description: '' });
    await service.editChangelist(WORKSPACE, 'UI', { name: 'UI', description: '' });

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

    await service.addFilterRule(workspace, 'ignore', 'Temp');
    await service.addFilterRule(workspace, 'cloaked', 'Assets/Big');

    expect(await readFile(join(workspace, 'ignore.conf'), 'utf8')).toMatch(/^Library\r?\nTemp/);
    expect(await readFile(join(workspace, 'cloaked.conf'), 'utf8')).toContain('Assets/Big');
    expect(commands).toEqual([]);
  });
});

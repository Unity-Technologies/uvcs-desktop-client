import { mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { change, formatOutput, pendingStatus, statusHeader } from './testing/cmOutput';
import { fakeCmClient } from './testing/fakeCmClient';
import { statusRecordsArgs } from './pendingChangesRecords';
import { readWorkspaceGlance } from './workspaceGlance';

const WORKSPACE = join('/', 'wkspaces', 'game');

function glancing(...changes: ReturnType<typeof change>[]) {
  return fakeCmClient({
    'status --header --xml': statusHeader('/main/task-12', { repository: 'acme', server: 'acme@cloud', changeset: 42 }),
    [`status ${WORKSPACE}`]: pendingStatus(WORKSPACE, ...changes),
  });
}

describe('readWorkspaceGlance', () => {
  it("reads the branch and counts the pending files with two local reads, the changes as records, from any directory", async () => {
    const { cm, commands } = glancing(change('CH', 'a.txt'), change('PR', 'new.txt'));

    expect(await readWorkspaceGlance(cm, WORKSPACE)).toEqual({ selector: { kind: 'branch', name: '/main/task-12' }, pendingCount: 2 });
    expect(commands).toMatchObject([
      { via: 'query', args: ['status', '--header', '--xml', WORKSPACE], options: { anyDirectory: true }, readsRecords: false },
      { via: 'query', args: statusRecordsArgs(WORKSPACE), options: { anyDirectory: true }, readsRecords: true },
    ]);
  });

  it('counts a moved and changed file once, and leaves out what Changes leaves out', () => {
    const { cm } = glancing(change('CH+MV', 'b.txt', { oldPath: 'a.txt' }), change('CL', 'cloaked', { folder: true }));
    return expect(readWorkspaceGlance(cm, WORKSPACE)).resolves.toMatchObject({ pendingCount: 1 });
  });

  it('counts a moved and changed file once, as cm prints it twice: a change, then a move', () => {
    const { cm } = glancing(change('CH', 'b.txt'), change('MV', 'b.txt', { oldPath: 'a.txt' }));
    return expect(readWorkspaceGlance(cm, WORKSPACE)).resolves.toMatchObject({ pendingCount: 1 });
  });

  it('keeps the branch when the changes can not be counted, the count unknown', async () => {
    const { cm } = fakeCmClient({
      'status --header --xml': statusHeader('/main/task-12', { repository: 'acme' }),
      [`status ${WORKSPACE}`]: formatOutput(['PR', join('/', 'elsewhere', 'a.txt'), 'False', 'NO_MERGES']),
    });
    expect(await readWorkspaceGlance(cm, WORKSPACE)).toEqual({ selector: { kind: 'branch', name: '/main/task-12' }, pendingCount: null });
  });

  it('counts the changes of a workspace reached through a link, whose paths cm prints from where it resolves', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uvcs-glance-'));
    const [target, link] = [join(root, 'target'), join(root, 'link')];
    await mkdir(target);
    await symlink(target, link, 'junction');
    const { cm } = fakeCmClient({
      'status --header --xml': statusHeader('/main', { repository: 'acme' }),
      [`status ${link}`]: pendingStatus(await realpath(link), change('CH', 'a.txt')),
    });
    expect(await readWorkspaceGlance(cm, link)).toMatchObject({ pendingCount: 1 });
  });

  it('reads a clean workspace', () => {
    return expect(readWorkspaceGlance(glancing().cm, WORKSPACE)).resolves.toMatchObject({ pendingCount: 0 });
  });
});

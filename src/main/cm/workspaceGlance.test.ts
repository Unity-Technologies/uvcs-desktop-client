import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { change, pendingStatus, statusHeader } from './testing/cmOutput';
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

  it('reads a clean workspace', () => {
    return expect(readWorkspaceGlance(glancing().cm, WORKSPACE)).resolves.toMatchObject({ pendingCount: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { findQueryArgs } from './findQuery';
import { FOUND_BRANCHES, FOUND_CHANGESETS, FOUND_LABELS } from './foundObjects';
import { recordsOutput } from './testing/cmOutput';
import { fakeCmClient } from './testing/fakeCmClient';
import { readWorkingObjectComment, workingObjectFindArgs } from './workingObjectComment';
import type { WorkspaceSelector } from '@shared/domain/workspace';

/** The comment read when `cm find` prints `found`, as one record read as it arrives. */
function workingObjectCommentIn(found: string, selector: WorkspaceSelector): Promise<string> {
  return readWorkingObjectComment(fakeCmClient({ find: found }).cm, '/wk', selector);
}

const branches = recordsOutput(FOUND_BRANCHES, { name: '/main/task', comment: 'Old task' }, { name: '/main/fixes/task', comment: 'Report exceptions via telemetry' });

describe('workingObjectFindArgs', () => {
  it('finds a branch by its last segment', () => {
    expect(workingObjectFindArgs({ kind: 'branch', name: '/main/fixes/task' })).toEqual(findQueryArgs(FOUND_BRANCHES, "where name = 'task'"));
  });

  it('finds labels by name and changesets and shelves by number', () => {
    expect(workingObjectFindArgs({ kind: 'label', name: "v1 'rc'" })[2]).toBe("where name like 'v1 %rc%'");
    expect(workingObjectFindArgs({ kind: 'changeset', name: '42' })[2]).toBe('where changesetid = 42');
    expect(workingObjectFindArgs({ kind: 'shelve', name: '3' })[2]).toBe('where shelveid = 3');
  });
});

describe('readWorkingObjectComment', () => {
  it('picks the branch with the full name among those sharing the last segment', async () => {
    await expect(
      workingObjectCommentIn(branches, {
        kind: 'branch',
        name: '/main/fixes/task',
      }),
    ).resolves.toBe('Report exceptions via telemetry');
  });

  it('takes only the label of that very name, not another the wildcard for a quote matched', async () => {
    const labels = recordsOutput(FOUND_LABELS, { name: 'v1-rc', comment: 'Another' });
    await expect(workingObjectCommentIn(labels, { kind: 'label', name: "v1'rc" })).resolves.toBe('');
    await expect(workingObjectCommentIn(labels, { kind: 'label', name: 'v1-rc' })).resolves.toBe('Another');
  });

  it('is empty when the object is not found', async () => {
    await expect(workingObjectCommentIn(branches, { kind: 'branch', name: '/main/other/task' })).resolves.toBe('');
    await expect(workingObjectCommentIn('', { kind: 'label', name: 'v1' })).resolves.toBe('');
  });
});

describe('the comment of a changeset', () => {
  it('reads the one changeset found, its comment as cm keeps it', async () => {
    const output = recordsOutput(FOUND_CHANGESETS, { changesetid: 42, comment: '"Quoted"\nand multi-line' });
    await expect(workingObjectCommentIn(output, { kind: 'changeset', name: '42' })).resolves.toBe('"Quoted"\nand multi-line');
  });
});

import { describe, expect, it } from 'vitest';
import { findWhereArgs } from './findQuery';
import { FOUND_BRANCHES, FOUND_CHANGESETS, FOUND_LABELS } from './foundObjects';
import { foundOutput } from './testing/cmOutput';
import { workingObjectCommentIn, workingObjectFindArgs } from './workingObjectComment';

const branches = foundOutput(FOUND_BRANCHES, { name: '/main/task', comment: 'Old task' }, { name: '/main/fixes/task', comment: 'Report exceptions via telemetry' });

describe('workingObjectFindArgs', () => {
  it('finds a branch by its last segment', () => {
    expect(workingObjectFindArgs({ kind: 'branch', name: '/main/fixes/task' })).toEqual(findWhereArgs(FOUND_BRANCHES, "where name = 'task'"));
  });

  it('finds labels by name and changesets and shelves by number', () => {
    expect(workingObjectFindArgs({ kind: 'label', name: "v1 'rc'" })[2]).toBe("where name like 'v1 %rc%'");
    expect(workingObjectFindArgs({ kind: 'changeset', name: '42' })[2]).toBe('where changesetid = 42');
    expect(workingObjectFindArgs({ kind: 'shelve', name: '3' })[2]).toBe('where shelveid = 3');
  });
});

describe('workingObjectCommentIn', () => {
  it('picks the branch with the full name among those sharing the last segment', () => {
    expect(
      workingObjectCommentIn(branches, {
        kind: 'branch',
        name: '/main/fixes/task',
      }),
    ).toBe('Report exceptions via telemetry');
  });

  it('takes only the label of that very name, not another the wildcard for a quote matched', () => {
    const labels = foundOutput(FOUND_LABELS, { name: 'v1-rc', comment: 'Another' });
    expect(workingObjectCommentIn(labels, { kind: 'label', name: "v1'rc" })).toBe('');
    expect(workingObjectCommentIn(labels, { kind: 'label', name: 'v1-rc' })).toBe('Another');
  });

  it('is empty when the object is not found', () => {
    expect(
      workingObjectCommentIn(branches, {
        kind: 'branch',
        name: '/main/other/task',
      }),
    ).toBe('');
    expect(
      workingObjectCommentIn('', {
        kind: 'label',
        name: 'v1',
      }),
    ).toBe('');
  });
});

describe('the comment of a changeset', () => {
  it('reads the one changeset found, its comment as cm keeps it', () => {
    const output = foundOutput(FOUND_CHANGESETS, { changesetid: 42, comment: '"Quoted"\nand multi-line' });
    expect(workingObjectCommentIn(output, { kind: 'changeset', name: '42' })).toBe('"Quoted"\nand multi-line');
  });
});

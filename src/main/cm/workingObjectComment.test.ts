import { describe, expect, it } from 'vitest';
import { workingObjectCommentIn, workingObjectFindArgs } from './workingObjectComment';

const branches = `<?xml version="1.0" encoding="utf-8" ?>
<PLASTICQUERY>
  <BRANCH><NAME>/main/task</NAME><COMMENT>Old task</COMMENT></BRANCH>
  <BRANCH><NAME>/main/fixes/task</NAME><COMMENT>Report exceptions via telemetry</COMMENT></BRANCH>
</PLASTICQUERY>`;

describe('workingObjectFindArgs', () => {
  it('finds a branch by its last segment', () => {
    expect(workingObjectFindArgs({ kind: 'branch', name: '/main/fixes/task' })).toEqual([
      'find',
      'branch',
      "where name = 'task'",
      '--xml',
      '--nototal',
    ]);
  });

  it('finds labels by name and changesets and shelves by number', () => {
    expect(workingObjectFindArgs({ kind: 'label', name: "v1 'rc'" })[2]).toBe("where name = 'v1 ''rc'''");
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

  it('is empty when the object is not found', () => {
    expect(
      workingObjectCommentIn(branches, {
        kind: 'branch',
        name: '/main/other/task',
      }),
    ).toBe('');
    expect(
      workingObjectCommentIn('<PLASTICQUERY></PLASTICQUERY>', {
        kind: 'label',
        name: 'v1',
      }),
    ).toBe('');
  });
});

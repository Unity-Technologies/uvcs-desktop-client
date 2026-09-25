import { describe, expect, it } from 'vitest';
import { describeMergeProgress, directoryConflictIdentity, MERGE_FIELD_SEPARATOR, parseCreatedChangeset, parseMergePlan } from './mergeOutput';

/** Real `cm merge --machinereadable --printcontributors` output, written with `|` for readability. */
function output(...lines: string[]): string {
  return lines.map((line) => line.split('|').join(MERGE_FIELD_SEPARATOR)).join('\n');
}

const PREVIEW = output(
  'CONTRIBUTOR|SRC|3|cs:3@sandbox-merge@local|/main/task',
  'CONTRIBUTOR|DST|4|cs:4@sandbox-merge@local|/main',
  'CONTRIBUTOR|BASE|1|cs:1@sandbox-merge@local|/main',
  'DIR_CONFLICT|DIV_MV|Divergent move conflict|An item was moved on source and destination to two different locations.|Moved from /src/div.txt to /src/div-src.txt|Moved from /src/div.txt to /src/div-dst.txt|26|False|MV|/src/div.txt|/src/div-src.txt|MV|/src/div.txt|/src/div-dst.txt',
  'DIR_CONFLICT|EVIL|Evil twin conflict|An item has been added on the source and on the destination with the same name, and they are different items.|Added /src/twin.txt|Added /src/twin.txt|45|False|ADD|/src/twin.txt|ADD|/src/twin.txt',
  'DIR_CONFLICT|RM_MV|Delete/Move conflict|An item has been deleted on the source and it was moved on the destination.|Deleted /src/md.txt|Moved from /src/md.txt to /src/md-moved.txt|28|False|RM|/src/md.txt|MV|/src/md.txt|/src/md-moved.txt',
  'DIR_CONFLICT|CHG_RM|Change/Delete conflict|An item has been modified on the source, and the destination has deleted the item or its parent|Modified /src/cd.txt|Deleted /src/cd.txt|29|False|CHG|/src/cd.txt|RM|/src/cd.txt',
  'FILE_SRC|/src/clean.txt|1|2|31',
  'APPLY|ADD|/docs/extra.md',
  'APPLY|MV|/old/name.txt|/new/name.txt',
  'APPLY|RM|/gone.txt',
  'FILE_CONFLICT|/data.bin|1|2|4|21',
  'FILE_CONFLICT|/src/conflict.txt|1|2|4|30',
  'RM_RM_WARN|/src|/src/cd.txt',
  'DIS_OP_WARN|CHG|/src/auto.txt',
  'PATH_CONFLICT_WARN|/src/a.txt|/src/a-renamed.txt',
);

describe('parseMergePlan', () => {
  const plan = parseMergePlan(PREVIEW);

  it('reads the three contributors', () => {
    expect(plan.status).toBe('ready');
    expect(plan.contributors).toEqual({
      source: { changesetId: 3, branch: '/main/task' },
      destination: { changesetId: 4, branch: '/main' },
      base: { changesetId: 1, branch: '/main' },
    });
  });

  it('reads file conflicts with the changesets of each contributor', () => {
    expect(plan.fileConflicts).toEqual([
      { path: '/data.bin', baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 4, itemId: 21 },
      { path: '/src/conflict.txt', baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 4, itemId: 30 },
    ]);
  });

  it('reads the changes that apply cleanly, including moves', () => {
    expect(plan.changes).toEqual([
      { kind: 'changed', path: '/src/clean.txt' },
      { kind: 'added', path: '/docs/extra.md' },
      { kind: 'moved', path: '/new/name.txt', oldPath: '/old/name.txt' },
      { kind: 'deleted', path: '/gone.txt' },
    ]);
  });

  it('reads both sides of directory conflicts, with old and new paths for moves', () => {
    expect(plan.directoryConflicts.map((conflict) => conflict.type)).toEqual(['divergentMove', 'evilTwin', 'deleteMove', 'changeDelete']);
    expect(plan.directoryConflicts[0]).toMatchObject({
      itemId: 26,
      isDirectory: false,
      source: { operation: 'moved', oldPath: '/src/div.txt', path: '/src/div-src.txt', description: 'Moved from /src/div.txt to /src/div-src.txt' },
      destination: { operation: 'moved', oldPath: '/src/div.txt', path: '/src/div-dst.txt' },
    });
    expect(plan.directoryConflicts[2]).toMatchObject({
      source: { operation: 'deleted', path: '/src/md.txt' },
      destination: { operation: 'moved', path: '/src/md-moved.txt' },
    });
  });

  it('only warns about what needs attention', () => {
    expect(plan.warnings).toEqual(['/src/a.txt will be renamed to /src/a-renamed.txt to avoid a name clash.']);
  });

  it('recognizes merges that are already done', () => {
    const done = parseMergePlan(output('STATUS|ALREADY_CONNECTED|No merges detected', 'CONTRIBUTOR|SRC|1|cs:1@r@s|/main', 'CONTRIBUTOR|DST|4|cs:4@r@s|/main'));
    expect(done.status).toBe('alreadyMerged');
    expect(done.contributors?.base).toBeUndefined();
  });

  it('ignores progress lines printed while merging', () => {
    const run = parseMergePlan(output('DO_MERGE|/private/tmp/w/src/a.txt', 'Some plain text line'));
    expect(run).toEqual({ status: 'ready', changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] });
  });
});

describe('directoryConflictIdentity', () => {
  it('stays the same for the same conflict listed again', () => {
    const [first] = parseMergePlan(PREVIEW).directoryConflicts;
    const [again] = parseMergePlan(PREVIEW).directoryConflicts;
    expect(directoryConflictIdentity(first!)).toBe(directoryConflictIdentity(again!));
  });
});

describe('describeMergeProgress', () => {
  it('describes the files being merged', () => {
    expect(describeMergeProgress(output('DO_MERGE|/private/tmp/w/src/auto.txt'))).toBe('Merging auto.txt');
    expect(describeMergeProgress(output('DO_MOVED|/w/a.txt|/w/b.txt'))).toBe('Moving a.txt');
  });

  it('skips preview records', () => {
    expect(describeMergeProgress(output('FILE_CONFLICT|/a|1|2|3|4'))).toBeNull();
  });
});

describe('parseCreatedChangeset', () => {
  it('reads the changeset created by a merge into a server branch', () => {
    expect(parseCreatedChangeset(output("CHANGESET|cs:7@/main/t3@sandbox-merge@local (mount:'/')"))).toBe(7);
    expect(parseCreatedChangeset('nothing')).toBeUndefined();
  });
});

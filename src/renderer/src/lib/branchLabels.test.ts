import { describe, expect, it } from 'vitest';
import { branchLabel, branchLabels, distinctBranchNames, MAX_BRANCH_LABEL_CHARS } from './branchLabels';

const ONE_SEGMENT = 'ThisBranchNameHasOneLongSegmentWithNoSlashToBreakAtAsSomeTeamsNameBranchesAfterTheirWholeTicketTitle';

describe('branchLabel', () => {
  it('names a branch by its own name', () => {
    expect(branchLabel('/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test')).toBe('merge-test');
    expect(branchLabel('/main')).toBe('main');
  });

  it('cuts a name longer than the limit in its middle, so both ends still tell it apart', () => {
    const label = branchLabel(`/main/${ONE_SEGMENT}`);
    expect(label).toBe('ThisBranchNameHasOne…eirWholeTicketTitle');
    expect(Array.from(label)).toHaveLength(MAX_BRANCH_LABEL_CHARS);
  });

  it('keeps a name exactly at the limit whole', () => {
    const name = 'a'.repeat(MAX_BRANCH_LABEL_CHARS);
    expect(branchLabel(`/main/${name}`)).toBe(name);
  });

  it('counts and cuts non-ASCII names by character, never inside one', () => {
    expect(branchLabel('/main/características-del-niño/日本語のブランチ名-テスト')).toBe('日本語のブランチ名-テスト');
    expect(branchLabel('/main/😀😀😀😀😀😀', 5)).toBe('😀😀…😀😀');
  });
});

describe('branchLabels', () => {
  it('names two branches as briefly as tells them apart', () => {
    expect(branchLabels('/main/child_1/subtask/merge-test', '/main/child_1/subtask')).toEqual(['merge-test', 'subtask']);
    expect(branchLabels('/main/a/fix', '/main/b/fix')).toEqual(['a/fix', 'b/fix']);
  });

  it('cuts each long name in its middle', () => {
    const [source, destination] = branchLabels(`/main/${ONE_SEGMENT}`, '/main');
    expect(Array.from(source)).toHaveLength(MAX_BRANCH_LABEL_CHARS);
    expect(source).toContain('…');
    expect(destination).toBe('main');
  });
});

describe('distinctBranchNames', () => {
  it('names each branch by its last segment', () => {
    expect(distinctBranchNames('/main/child-br-cr-sample/empty-branch2/child_1/subtask', '/main/child-br-cr-sample/empty-branch2/child_1')).toEqual([
      'subtask',
      'child_1',
    ]);
    expect(distinctBranchNames('/main/task001', '/main')).toEqual(['task001', 'main']);
  });

  it('keeps more segments while the names are the same', () => {
    expect(distinctBranchNames('/main/task/task', '/main/task')).toEqual(['task/task', 'main/task']);
    expect(distinctBranchNames('/main/a/fix', '/main/b/fix')).toEqual(['a/fix', 'b/fix']);
  });

  it('gives the whole names when nothing shorter tells them apart', () => {
    expect(distinctBranchNames('/main', '/main')).toEqual(['/main', '/main']);
  });
});

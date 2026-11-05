import { describe, expect, it } from 'vitest';
import { branchDiffBase, readStartOutcome } from './branchDiffUpTo';

// /main/task starts from changeset 8 on /main and holds 9 to 13, 13 merging /main into it.
const TASK_START = { firstChangeset: 9, base: 8 };
const onTask = (id: number) => ({ id, branch: '/main/task' });

describe('the branch diff up to a changeset', () => {
  it("diffs a middle changeset and the head from the branch's base", () => {
    expect(branchDiffBase(onTask(12), TASK_START)).toEqual({ kind: 'from', base: 8 });
    expect(branchDiffBase(onTask(10), TASK_START)).toEqual({ kind: 'from', base: 8 });
  });

  it("keeps the original base after a merge from the parent, as the branch's start doesn't move", () => {
    expect(branchDiffBase(onTask(13), TASK_START)).toEqual({ kind: 'from', base: 8 });
  });

  it("isn't offered on the branch's first changeset, where it would be the changeset's own diff", () => {
    expect(branchDiffBase(onTask(9), TASK_START)).toEqual({ kind: 'none' });
  });

  it("isn't offered on /main, the root branch, which starts from no other", () => {
    expect(branchDiffBase({ id: 6, branch: '/main' }, { firstChangeset: 0, base: -1 })).toEqual({ kind: 'none' });
    expect(branchDiffBase({ id: 6, branch: '/main' }, null)).toEqual({ kind: 'none' });
  });

  // The app creates top-level branches from a changeset or a label ("Top-level branch" in New branch).
  it('diffs a top-level branch made from a changeset from its base, as any other', () => {
    expect(branchDiffBase({ id: 30, branch: '/release' }, { firstChangeset: 21, base: 20 })).toEqual({ kind: 'from', base: 20 });
    expect(branchDiffBase({ id: 30, branch: '/release' }, null)).toEqual({ kind: 'unknown' });
  });

  it("is offered on a branch whose start isn't known, nested and non-ASCII names too, to be read when chosen", () => {
    expect(branchDiffBase(onTask(12), null)).toEqual({ kind: 'unknown' });
    expect(branchDiffBase({ id: 40, branch: '/main/características/日本語' }, null)).toEqual({ kind: 'unknown' });
  });

  it("isn't offered where the branch starts nowhere", () => {
    expect(branchDiffBase(onTask(12), { firstChangeset: 9, base: -1 })).toEqual({ kind: 'none' });
  });
});

describe('the start read when the entry is chosen', () => {
  it('opens from the parent of the first changeset', () => {
    expect(readStartOutcome(TASK_START)).toEqual({ kind: 'from', base: 8 });
    expect(readStartOutcome({ firstChangeset: 0, base: 0 })).toEqual({ kind: 'from', base: 0 });
  });

  it('tells a root branch, which starts from no other, from a branch with no changesets', () => {
    expect(readStartOutcome({ firstChangeset: 0, base: -1 })).toEqual({ kind: 'root' });
    expect(readStartOutcome(null)).toEqual({ kind: 'empty' });
  });
});

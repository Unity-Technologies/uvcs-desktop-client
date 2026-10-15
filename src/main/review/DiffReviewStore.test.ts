import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiffReviewStore } from './DiffReviewStore';

/** Diffs the stores of these tests remember per repository: a few, as each one is a write to the disk. */
const KEPT = 3;

describe('DiffReviewStore', () => {
  let root: string;
  let clock: number;
  const store = (): DiffReviewStore => new DiffReviewStore(root, () => clock++, KEPT);

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'diff-review-'));
    clock = 0;
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  it('remembers the revision reviewed of each file, per diff and repository', async () => {
    const reviews = store();
    await reviews.mark('repo@local', 'br:/main/task', [{ path: 'a.ts', revisionId: 10 }]);
    await reviews.mark('repo@local', 'br:/main/task', [{ path: 'b.ts', revisionId: 11 }]);
    await reviews.mark('other@local', 'br:/main/task', [{ path: 'c.ts', revisionId: 12 }]);

    expect(await store().marks('repo@local', 'br:/main/task')).toEqual([
      { path: 'a.ts', revisionId: 10 },
      { path: 'b.ts', revisionId: 11 },
    ]);
    expect(await store().marks('repo@local', 'cs:4')).toEqual([]);
  });

  it('replaces a mark with the revision reviewed last, and forgets unmarked files', async () => {
    const reviews = store();
    await reviews.mark('repo@local', 'cs:4', [{ path: 'a.ts', revisionId: 10 }, { path: 'b.ts', revisionId: 11 }]);
    await reviews.mark('repo@local', 'cs:4', [{ path: 'a.ts', revisionId: 20 }]);
    await reviews.unmark('repo@local', 'cs:4', ['b.ts']);
    expect(await store().marks('repo@local', 'cs:4')).toEqual([{ path: 'a.ts', revisionId: 20 }]);
  });

  it('forgets the least recently reviewed diffs beyond the limit', async () => {
    const reviews = store();
    for (let changeset = 0; changeset <= KEPT; changeset++) {
      await reviews.mark('repo@local', `cs:${changeset}`, [{ path: 'a.ts', revisionId: changeset }]);
    }
    expect(await store().marks('repo@local', 'cs:0')).toEqual([]);
    expect(await store().marks('repo@local', `cs:${KEPT}`)).toHaveLength(1);
    expect(await store().marks('repo@local', 'cs:1')).toHaveLength(1);
  });
});

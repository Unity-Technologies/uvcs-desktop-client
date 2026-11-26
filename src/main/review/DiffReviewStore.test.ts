import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { DiffReviewStore } from './DiffReviewStore';

const REPO = repositoryGuidFor(1);
const OTHER = repositoryGuidFor(2);

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
    await reviews.mark(REPO, 'br:/main/task', [{ path: 'a.ts', revisionId: 10 }]);
    await reviews.mark(REPO, 'br:/main/task', [{ path: 'b.ts', revisionId: 11 }]);
    await reviews.mark(OTHER, 'br:/main/task', [{ path: 'c.ts', revisionId: 12 }]);

    expect(await store().marks(REPO, 'br:/main/task')).toEqual([
      { path: 'a.ts', revisionId: 10 },
      { path: 'b.ts', revisionId: 11 },
    ]);
    expect(await store().marks(REPO, 'cs:4')).toEqual([]);
  });

  it('replaces a mark with the revision reviewed last, and forgets unmarked files', async () => {
    const reviews = store();
    await reviews.mark(REPO, 'cs:4', [{ path: 'a.ts', revisionId: 10 }, { path: 'b.ts', revisionId: 11 }]);
    await reviews.mark(REPO, 'cs:4', [{ path: 'a.ts', revisionId: 20 }]);
    await reviews.unmark(REPO, 'cs:4', ['b.ts']);
    expect(await store().marks(REPO, 'cs:4')).toEqual([{ path: 'a.ts', revisionId: 20 }]);
  });

  it('forgets the least recently reviewed diffs beyond the limit', async () => {
    const reviews = store();
    for (let changeset = 0; changeset <= KEPT; changeset++) {
      await reviews.mark(REPO, `cs:${changeset}`, [{ path: 'a.ts', revisionId: changeset }]);
    }
    expect(await store().marks(REPO, 'cs:0')).toEqual([]);
    expect(await store().marks(REPO, `cs:${KEPT}`)).toHaveLength(1);
    expect(await store().marks(REPO, 'cs:1')).toHaveLength(1);
  });

  it('moves a diff’s marks kept by its former name under its name, once, while it keeps none: a branch’s, by its GUID now', async () => {
    const reviews = store();
    await reviews.mark(REPO, 'br:/main/task', [{ path: 'a.ts', revisionId: 10 }]);

    expect(await reviews.marks(REPO, 'br:guid-of-task', 'br:/main/task')).toEqual([{ path: 'a.ts', revisionId: 10 }]);
    expect(await store().marks(REPO, 'br:/main/task')).toEqual([]);
    expect(await store().marks(REPO, 'br:guid-of-task')).toEqual([{ path: 'a.ts', revisionId: 10 }]);
  });

  it('moves a diff’s marks kept by its former name when the first thing done is marking or unmarking', async () => {
    const reviews = store();
    await reviews.mark(REPO, 'br:/main/task', [{ path: 'a.ts', revisionId: 10 }, { path: 'c.ts', revisionId: 12 }]);

    await reviews.mark(REPO, 'br:guid-of-task', [{ path: 'b.ts', revisionId: 11 }], 'br:/main/task');
    await reviews.unmark(REPO, 'br:guid-of-task', ['c.ts'], 'br:/main/task');

    expect(await store().marks(REPO, 'br:guid-of-task')).toEqual([
      { path: 'a.ts', revisionId: 10 },
      { path: 'b.ts', revisionId: 11 },
    ]);
    expect(await store().marks(REPO, 'br:/main/task')).toEqual([]);
  });

  it('takes the file of marks kept by the repository’s spec as its GUID’s, once the GUID is known', async () => {
    const bySpec = join(root, `${createHash('sha1').update('game@acme@unity').digest('hex').slice(0, 16)}.json`);
    await writeFile(bySpec, JSON.stringify({ 'cs:4': { usedAt: 1, marks: { 'a.ts': 10 } } }));

    await store().keepRepositoryByGuid('game@acme@unity', REPO);

    expect(await store().marks(REPO, 'cs:4')).toEqual([{ path: 'a.ts', revisionId: 10 }]);
    expect(await readdir(root)).toEqual([`${REPO}.json`]);
  });

  it('keeps the GUID’s own marks over those kept by the repository’s spec', async () => {
    const bySpec = join(root, `${createHash('sha1').update('game@acme@unity').digest('hex').slice(0, 16)}.json`);
    await writeFile(bySpec, JSON.stringify({ 'cs:4': { usedAt: 1, marks: { 'a.ts': 10 } } }));
    await store().mark(REPO, 'cs:5', [{ path: 'b.ts', revisionId: 11 }]);

    await store().keepRepositoryByGuid('game@acme@unity', REPO);

    expect(await store().marks(REPO, 'cs:4')).toEqual([]);
    expect(await store().marks(REPO, 'cs:5')).toEqual([{ path: 'b.ts', revisionId: 11 }]);
  });
});

import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { Page } from '../navigation/pages';
import { asMovablePage, asPage, isMovablePage, pageWindowOpening } from './movablePages';

const BRANCH_TARGET = { kind: 'branch', branch: '/main/task' } as const;
const DIFF: Page = { kind: 'diff', title: 'Branch /main/task', target: BRANCH_TARGET, branchHead: 42 };
const HISTORY: Page = { kind: 'history', path: 'src/player.cs' };
const MERGE: Page = { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task' } };
const PLAYER: DiffEntry = { status: 'changed', path: 'src/player.cs', itemType: 'file', baseRevisionId: 13, revisionId: 37, repository: 'game@local' };

describe('the pages that open in a window of their own', () => {
  it('are the documents about one object: diffs, histories, code reviews and a repository browsed; never a merge', () => {
    expect([DIFF, HISTORY, { kind: 'codeReview', reviewId: 3 } as Page, { kind: 'browseRepository', changesetId: 7 } as Page].every(isMovablePage)).toBe(true);
    expect(isMovablePage(MERGE)).toBe(false);
  });

  it('come back as pages from the address or a followed selection, and nothing else does', () => {
    expect(asMovablePage(DIFF)).toEqual(DIFF);
    expect(asMovablePage(MERGE)).toBeNull();
    expect(asMovablePage({ kind: 'settings' })).toBeNull();
  });

  it('come back to the workspace window as any page it shows, a merge too', () => {
    expect(asPage(MERGE)).toEqual(MERGE);
    expect(asPage(HISTORY)).toEqual(HISTORY);
    expect(asPage({ kind: 'settings' })).toBeNull();
  });
});

describe('opening a page in a window of its own', () => {
  it("hands a diff's files already read to its window, read at the same branch head", () => {
    const asked: unknown[] = [];
    const opening = pageWindowOpening('/work/game', DIFF, (diff) => (asked.push(diff.branchHead), [PLAYER]));

    expect(opening).toEqual({ workspacePath: '/work/game', page: DIFF, diff: { target: BRANCH_TARGET, entries: [PLAYER] } });
    expect(asked).toEqual([42]);
  });

  it("hands nothing when the diff's files weren't read, nor for another page", () => {
    expect(pageWindowOpening('/work/game', DIFF, () => undefined)).toEqual({ workspacePath: '/work/game', page: DIFF });
    expect(pageWindowOpening('/work/game', HISTORY, () => [PLAYER])).toEqual({ workspacePath: '/work/game', page: HISTORY });
  });
});

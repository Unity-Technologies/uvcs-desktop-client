import { describe, expect, it } from 'vitest';
import { isSameMerge, mergeAwaiting, pagesWithoutMerge, showsMerge, type MergeInProgress } from './mergeInProgress';
import type { Page, PageOf } from './pages';

const page: PageOf<'merge'> = { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task' } };
const merge: MergeInProgress = { id: 1, page, settled: false };
const history: Page = { kind: 'history', path: 'src/a.cs' };

describe('mergeAwaiting', () => {
  it('is the merge while it holds work, none once settled', () => {
    expect(mergeAwaiting(merge)).toBe(merge);
    expect(mergeAwaiting({ ...merge, settled: true })).toBeNull();
    expect(mergeAwaiting(null)).toBeNull();
  });
});

describe('isSameMerge', () => {
  it('matches the same request and task, and nothing else', () => {
    expect(isSameMerge(merge, { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task' } })).toBe(true);
    expect(isSameMerge(merge, { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' } })).toBe(false);
    expect(isSameMerge(merge, { kind: 'merge', request: { kind: 'cherryPick', sourceSpec: 'br:/main/task' } })).toBe(false);
  });
});

describe('showsMerge', () => {
  it('is the merge on top, not under a page about it', () => {
    expect(showsMerge(merge, [page])).toBe(true);
    expect(showsMerge(merge, [page, history])).toBe(false);
    expect(showsMerge(null, [history])).toBe(false);
  });
});

describe('pagesWithoutMerge', () => {
  it('keeps the pages under the merge, dropping those about it', () => {
    expect(pagesWithoutMerge(merge, [history, page, history])).toEqual([history]);
  });

  it('keeps every page when the merge was set aside', () => {
    expect(pagesWithoutMerge(merge, [history])).toEqual([history]);
  });
});

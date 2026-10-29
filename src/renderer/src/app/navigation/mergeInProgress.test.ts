import { describe, expect, it } from 'vitest';
import { isSameMerge, mergeAfterLeaving, mergeAwaiting, pagesWithoutMerge, showsMerge, type MergeInProgress } from './mergeInProgress';
import type { Page, PageOf } from './pages';

const page: PageOf<'merge'> = { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task' } };
const merge: MergeInProgress = { id: 1, page, workspacePath: '/ws', settled: false };
const history: Page = { kind: 'history', path: 'src/a.cs' };

describe('mergeAwaiting', () => {
  it('is the merge while it holds work, none once settled', () => {
    expect(mergeAwaiting(merge)).toBe(merge);
    expect(mergeAwaiting({ ...merge, settled: true })).toBeNull();
    expect(mergeAwaiting(null)).toBeNull();
  });
});

describe('mergeAfterLeaving', () => {
  it('sets a merge aside, and drops a settled one only once it was seen', () => {
    const settled = { ...merge, settled: true };
    expect(mergeAfterLeaving(merge, [page])).toBe(merge);
    expect(mergeAfterLeaving(settled, [page])).toBeNull();
    expect(mergeAfterLeaving(settled, [history])).toBe(settled);
  });
});

describe('isSameMerge', () => {
  it('matches the same task merge whatever the choices it carries', () => {
    const branch = { id: 7, name: '/main/task', parent: '/main', comment: '' };
    const task = (markReviewed: boolean): PageOf<'merge'> => ({ ...page, task: { branch, choices: { markReviewed, hideBranch: false } } });
    expect(isSameMerge({ ...merge, page: task(true) }, task(false))).toBe(true);
    expect(isSameMerge({ ...merge, page: task(true) }, page)).toBe(false);
  });

  it('matches the same request and task, and nothing else', () => {
    expect(isSameMerge(merge, { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task' } })).toBe(true);
    expect(isSameMerge(merge, { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' } })).toBe(false);
    expect(isSameMerge(merge, { kind: 'merge', request: { kind: 'cherryPick', sourceSpec: 'br:/main/task' } })).toBe(false);
    expect(isSameMerge(merge, { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task', deleteShelve: true } })).toBe(false);
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

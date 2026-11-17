import { describe, expect, it } from 'vitest';
import { MOUNTED_VIEWS, mountedViews, NO_KEPT_VIEWS, switchedViews, viewLayers, type KeptViews } from './keptViews';
import type { Page } from './pages';

const review: Page = { kind: 'codeReview', reviewId: 41, tab: 'changes', focusChangeset: 120 };
const history: Page = { kind: 'history', path: 'src/a.cs' };

describe('switchedViews', () => {
  it('keeps the pages of the view left, and shows them again on returning to it', () => {
    const left = switchedViews(NO_KEPT_VIEWS, { from: 'codeReviews', pages: [review], to: 'branchExplorer', shows: 'asLeft' });

    expect(left.pages).toEqual([]);

    const back = switchedViews(left.kept, { from: 'branchExplorer', pages: left.pages, to: 'codeReviews', shows: 'asLeft' });

    expect(back.pages).toEqual([review]);
    expect(back.kept.stacks).toEqual({ branchExplorer: [] });
  });

  it('keeps every page of a stack, in the order they stacked', () => {
    const left = switchedViews(NO_KEPT_VIEWS, { from: 'changesets', pages: [history, review], to: 'labels', shows: 'asLeft' });
    const back = switchedViews(left.kept, { from: 'labels', pages: [], to: 'changesets', shows: 'asLeft' });

    expect(back.pages).toEqual([history, review]);
  });

  it("shows the view's list when going to it rather than returning to it, closing the pages it was left with", () => {
    // What every way into a view but the sidebar and its shortcut does: "View changes", "Show in Locks"…
    const left = switchedViews(NO_KEPT_VIEWS, { from: 'codeReviews', pages: [review], to: 'branchExplorer', shows: 'asLeft' });
    const toList = switchedViews(left.kept, { from: 'branchExplorer', pages: [], to: 'codeReviews', shows: 'list' });

    expect(toList.pages).toEqual([]);
    expect(toList.kept.stacks.codeReviews).toBeUndefined();
  });

  it('closes the pages of the view shown when switching to it: back to its list', () => {
    const kept: KeptViews = { stacks: { labels: [history] }, recent: ['codeReviews', 'labels'] };

    expect(switchedViews(kept, { from: 'codeReviews', pages: [review], to: 'codeReviews', shows: 'asLeft' })).toEqual({ kept, pages: [] });
  });

  it('shows a view never left at its list', () => {
    expect(switchedViews(NO_KEPT_VIEWS, { from: 'changes', pages: [], to: 'locks', shows: 'asLeft' }).pages).toEqual([]);
  });

  it('orders the views by when they were shown, the latest first, each once', () => {
    let kept = NO_KEPT_VIEWS;
    let from: KeptViews['recent'][number] = 'changes';
    for (const to of ['branches', 'labels', 'changes', 'branches'] as const) {
      kept = switchedViews(kept, { from, pages: [], to, shows: 'asLeft' }).kept;
      from = to;
    }

    expect(kept.recent).toEqual(['branches', 'changes', 'labels']);
  });

  it('gives the pages it shows as a copy, never the kept stack itself', () => {
    const stack = [history];
    const kept: KeptViews = { stacks: { labels: stack }, recent: ['labels'] };

    expect(switchedViews(kept, { from: 'changes', pages: [], to: 'labels', shows: 'asLeft' }).pages).not.toBe(stack);
  });
});

describe('mountedViews', () => {
  it('mounts the view shown and the latest others, up to the limit', () => {
    expect(MOUNTED_VIEWS).toBe(3);
    expect(mountedViews('labels', ['labels', 'branches', 'changes', 'locks'])).toEqual(['changes', 'branches', 'labels']);
  });

  it("mounts the view shown even before it's among the recent ones: the first view of a place", () => {
    expect(mountedViews('changes', [])).toEqual(['changes']);
    expect(mountedViews('locks', ['branches', 'changes', 'labels'])).toEqual(['changes', 'branches', 'locks']);
  });

  it("lists them in the sidebar's order, whatever the order they were shown in, so none moves as another comes forward", () => {
    expect(mountedViews('codeReviews', ['codeReviews', 'branchExplorer', 'changes'])).toEqual(mountedViews('changes', ['changes', 'codeReviews', 'branchExplorer']));
  });
});

describe('viewLayers', () => {
  const merge: Page = { kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task' } };
  const kept: KeptViews = { stacks: { codeReviews: [review] }, recent: ['branchExplorer', 'codeReviews', 'labels'] };

  it('draws the view shown with its pages, and the others hidden with the pages they were left with', () => {
    expect(viewLayers('branchExplorer', [history], kept, false)).toEqual([
      { view: 'branchExplorer', shown: true, pages: [history], drawsTop: true },
      { view: 'labels', shown: false, pages: [], drawsTop: true },
      { view: 'codeReviews', shown: false, pages: [review], drawsTop: true },
    ]);
  });

  it('leaves the merge in progress shown to its own layer: the view under it draws no page', () => {
    expect(viewLayers('branchExplorer', [history, merge], kept, true)[0]).toEqual({ view: 'branchExplorer', shown: true, pages: [history, merge], drawsTop: false });
  });

  it('draws the page opened over a merge set aside, as any page', () => {
    expect(viewLayers('branchExplorer', [merge, history], kept, false)[0]?.drawsTop).toBe(true);
  });

  it("gives a view left at its list the same pages each time, so its hidden layer isn't drawn again", () => {
    expect(viewLayers('branchExplorer', [], kept, false)[1]?.pages).toBe(viewLayers('codeReviews', [], kept, false)[1]?.pages);
  });
});

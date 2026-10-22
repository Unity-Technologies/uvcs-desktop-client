import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { LINK_VIEWS } from '@shared/links/link';
import { VIEW_IDS } from '../navigation/views';
import { LINK_VIEW_IDS, linkLookup, linkNavigation, type LinkTarget } from './linkNavigation';

const LINE_42 = { side: 'new', first: 42, last: 42 } as const;

describe('linkNavigation', () => {
  it("opens an object's diff, on a file and its lines", () => {
    expect(linkNavigation({ object: { kind: 'changeset', id: 12 }, page: { kind: 'diffFile', path: '/Assets/Player.cs' }, lines: LINE_42 }, null)).toEqual({
      kind: 'page',
      page: { kind: 'diff', title: 'Changeset 12', target: { kind: 'changeset', changesetId: 12 }, focusPath: 'Assets/Player.cs', focusLines: LINE_42 },
    });
  });

  it.each<[LinkTarget, object]>([
    [{ object: { kind: 'changesetRange', from: 4200, to: 4207 } }, { kind: 'diff', target: { kind: 'range', fromSpec: 'cs:4200', toSpec: 'cs:4207' } }],
    [{ object: { kind: 'branch', name: '/main/task' } }, { kind: 'diff', title: 'Branch task', target: { kind: 'branch', branch: '/main/task' } }],
    [{ object: { kind: 'labelRange', from: 'v1', to: 'v2' } }, { kind: 'diff', target: { kind: 'range', fromSpec: 'lb:v1', toSpec: 'lb:v2' } }],
    [{ object: { kind: 'shelve', id: 3 } }, { kind: 'diff', target: { kind: 'shelve', shelveId: 3 } }],
    [{ object: { kind: 'codeReview', id: 311 }, page: { kind: 'diffFile', path: '/a.cs' } }, { kind: 'codeReview', reviewId: 311, focusPath: 'a.cs' }],
  ])('opens %j as its page', (target, page) => {
    expect(linkNavigation(target, null)).toMatchObject({ kind: 'page', page });
  });

  it("opens a label's diff at the changeset its lookup read", () => {
    const target: LinkTarget = { object: { kind: 'label', name: 'v1.2' } };
    expect(linkLookup(target)).toEqual({ kind: 'label', name: 'v1.2' });
    expect(linkNavigation(target, { changesetId: 80 })).toMatchObject({ kind: 'page', page: { title: 'Label v1.2', target: { kind: 'changeset', changesetId: 80 } } });
    expect(() => linkNavigation(target, null)).toThrow();
  });

  it('browses the repository at the changeset, the label, the head of a branch, or of /main', () => {
    const browse = { kind: 'browse', path: '/src/a.cs' } as const;
    expect(linkNavigation({ object: { kind: 'changeset', id: 12 }, page: browse, lines: LINE_42 }, null)).toEqual({
      kind: 'page',
      page: { kind: 'browseRepository', changesetId: 12, focusPath: 'src/a.cs', focusLines: LINE_42 },
    });
    expect(linkLookup({ object: { kind: 'branch', name: '/main/task' }, page: browse })).toEqual({ kind: 'branchHead', name: '/main/task' });
    expect(linkLookup({ page: browse })).toEqual({ kind: 'branchHead', name: '/main' });
    expect(linkNavigation({ page: { kind: 'browse', path: '/' } }, { changesetId: 90 })).toEqual({ kind: 'page', page: { kind: 'browseRepository', changesetId: 90 } });
  });

  it("opens an item's history or annotations from the changeset, a branch's from its latest", () => {
    expect(linkNavigation({ object: { kind: 'changeset', id: 12 }, page: { kind: 'annotate', path: '/a.cs' }, lines: LINE_42 }, null)).toEqual({
      kind: 'page',
      page: { kind: 'history', path: 'a.cs', select: { changesetId: 12 }, view: 'annotate', focusLines: LINE_42 },
    });
    expect(linkLookup({ object: { kind: 'branch', name: '/main' }, page: { kind: 'history', path: '/a.cs' } })).toBeNull();
    expect(linkNavigation({ object: { kind: 'branch', name: '/main' }, page: { kind: 'history', path: '/a.cs' } }, null)).toEqual({ kind: 'page', page: { kind: 'history', path: 'a.cs' } });
  });

  it('shows a changeset, a branch or a label in the Branch Explorer', () => {
    const explorer = { kind: 'view', view: 'branch-explorer' } as const;
    expect(linkNavigation({ object: { kind: 'branch', name: '/main/task' }, page: explorer }, null)).toEqual({
      kind: 'view',
      view: 'branchExplorer',
      show: { kind: 'branchExplorer', target: { kind: 'branch', name: '/main/task' } },
    });
    expect(linkNavigation({ object: { kind: 'label', name: 'v1' }, page: explorer }, { changesetId: 7 })).toMatchObject({ show: { target: { kind: 'label', name: 'v1', changeset: 7 } } });
  });

  it("opens a workspace's view, an item revealed in Files or a change selected in Changes, on its lines", () => {
    expect(linkNavigation({}, null)).toEqual({ kind: 'view', view: 'changes' });
    expect(linkNavigation({ page: { kind: 'view', view: 'code-reviews' } }, null)).toEqual({ kind: 'view', view: 'codeReviews' });
    expect(linkNavigation({ page: { kind: 'view', view: 'files', path: '/Assets' } }, null)).toEqual({ kind: 'view', view: 'files', show: { kind: 'files', path: 'Assets' } });
    expect(linkNavigation({ page: { kind: 'view', view: 'changes', path: '/a.cs' }, lines: LINE_42 }, null)).toEqual({
      kind: 'view',
      view: 'changes',
      show: { kind: 'change', path: 'a.cs', lines: LINE_42 },
    });
  });
});

describe('LINK_VIEW_IDS', () => {
  // A view added to the sidebar gets its link name (docs/features/deep-links.md), and every link view opens one.
  it('names every view of the sidebar, each once', () => {
    expect(Object.keys(LINK_VIEW_IDS).sort()).toEqual([...LINK_VIEWS].sort());
    expect(Object.values(LINK_VIEW_IDS).sort()).toEqual([...VIEW_IDS].sort());
  });
});

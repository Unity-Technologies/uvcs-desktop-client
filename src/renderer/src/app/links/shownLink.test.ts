import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { VIEW_IDS } from '../navigation/views';
import { copyLinkLabel, hasLinkToCopy, linkToCopy, pageLinkTarget, shownFileOf, viewLinkTarget } from './shownLink';

const LINES = { side: 'new', first: 40, last: 52 } as const;

describe('pageLinkTarget', () => {
  it("names a diff's object, and the lines selected in its file, else the file it opened on", () => {
    const page = { kind: 'diff', title: 'Changeset 12', target: { kind: 'changeset', changesetId: 12 }, focusPath: 'a.cs' } as const;
    expect(pageLinkTarget(page, { path: 'src/b.cs', lines: LINES })).toEqual({ object: { kind: 'changeset', id: 12 }, page: { kind: 'diffFile', path: '/src/b.cs' }, lines: LINES });
    expect(pageLinkTarget(page, null)).toEqual({ object: { kind: 'changeset', id: 12 }, page: { kind: 'diffFile', path: '/a.cs' } });
  });

  it('names the diff alone when the file shown is one a link could not carry, a quote in its name', () => {
    expect(pageLinkTarget({ kind: 'diff', title: 'Changeset 12', target: { kind: 'changeset', changesetId: 12 } }, { path: 'docs/say "hi".md' })).toEqual({ object: { kind: 'changeset', id: 12 } });
    expect(pageLinkTarget({ kind: 'browseRepository', changesetId: 7 }, { path: 'say "hi".md' })).toBeNull();
  });

  it("names no diff of two branches' heads, nor a merge", () => {
    expect(pageLinkTarget({ kind: 'diff', title: 'a → b', target: { kind: 'range', fromSpec: 'cs:3', toSpec: 'br:/main' } }, null)).toBeNull();
    expect(pageLinkTarget({ kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task' } } as never, null)).toBeNull();
  });

  it('names a review and its file', () => {
    expect(pageLinkTarget({ kind: 'codeReview', reviewId: 311 }, { path: 'a.cs', lines: LINES })).toEqual({
      object: { kind: 'codeReview', id: 311 },
      page: { kind: 'diffFile', path: '/a.cs' },
      lines: LINES,
    });
  });

  it('names a history or its annotations from the changeset it opened on, with the lines selected', () => {
    expect(pageLinkTarget({ kind: 'history', path: 'a.cs', select: { changesetId: 9 }, view: 'annotate' }, { path: 'a.cs', lines: LINES })).toEqual({
      object: { kind: 'changeset', id: 9 },
      page: { kind: 'annotate', path: '/a.cs' },
      lines: LINES,
    });
    expect(pageLinkTarget({ kind: 'history', path: 'a.cs' }, null)).toEqual({ page: { kind: 'history', path: '/a.cs' } });
  });

  describe('a history', () => {
    const shown = (changesetId: number, view: 'history' | 'annotate', otherRepository = false) => ({ path: 'a.cs', changesetId, view, otherRepository });

    it('names the revision it shows, not the one it opened on', () => {
      const page = { kind: 'history', path: 'a.cs', select: { changesetId: 9 } } as const;
      expect(pageLinkTarget(page, { path: 'a.cs', revision: shown(4, 'history') })).toEqual({ object: { kind: 'changeset', id: 4 }, page: { kind: 'history', path: '/a.cs' } });
    });

    it('names the revision selected in a history opened on none', () => {
      expect(pageLinkTarget({ kind: 'history', path: 'a.cs' }, { path: 'a.cs', revision: shown(6, 'history') })).toEqual({ object: { kind: 'changeset', id: 6 }, page: { kind: 'history', path: '/a.cs' } });
    });

    it('names the view it shows, the lines selected only annotated', () => {
      const opened = { kind: 'history', path: 'a.cs', view: 'annotate' } as const;
      expect(pageLinkTarget(opened, { path: 'a.cs', lines: LINES, revision: shown(6, 'history') })).toEqual({ object: { kind: 'changeset', id: 6 }, page: { kind: 'history', path: '/a.cs' } });
      expect(pageLinkTarget({ kind: 'history', path: 'a.cs' }, { path: 'a.cs', lines: LINES, revision: shown(6, 'annotate') })).toEqual({
        object: { kind: 'changeset', id: 6 },
        page: { kind: 'annotate', path: '/a.cs' },
        lines: LINES,
      });
    });

    it("names nothing for an item of another repository: a link's changeset would be the workspace's", () => {
      expect(pageLinkTarget({ kind: 'history', path: 'lib/a.cs' }, { path: 'lib/a.cs', revision: shown(3, 'history', true) })).toBeNull();
    });

    it("takes the revision the history on screen shows, with the lines selected in it", () => {
      const selected = { path: 'a.cs', lines: LINES };
      expect(shownFileOf({ kind: 'history', path: 'a.cs' }, null, selected, shown(6, 'annotate'))).toEqual({ ...selected, revision: shown(6, 'annotate') });
      expect(shownFileOf({ kind: 'history', path: 'a.cs' }, null, null, shown(6, 'history'))).toEqual({ path: 'a.cs', revision: shown(6, 'history') });
      expect(shownFileOf({ kind: 'history', path: 'b.cs' }, null, null, shown(6, 'history'))).toBeNull();
    });
  });

  it('names a browsed changeset and the item selected in it', () => {
    expect(pageLinkTarget({ kind: 'browseRepository', changesetId: 7, focusPath: 'Assets' }, null)).toEqual({ object: { kind: 'changeset', id: 7 }, page: { kind: 'browse', path: '/Assets' } });
    expect(pageLinkTarget({ kind: 'browseRepository', changesetId: 7 }, null)).toEqual({ object: { kind: 'changeset', id: 7 }, page: { kind: 'browse', path: '/' } });
  });
});

describe('shownFileOf', () => {
  const target = { kind: 'changeset', changesetId: 12 } as const;

  it("takes the file of the diff on screen when it is the page's, a review's whatever it compares", () => {
    expect(shownFileOf({ kind: 'diff', title: 'Changeset 12', target }, { target, path: 'a.cs' }, null)).toEqual({ path: 'a.cs' });
    expect(shownFileOf({ kind: 'codeReview', reviewId: 3 }, { target, path: 'b.cs' }, null)).toEqual({ path: 'b.cs' });
  });

  it('takes the lines selected in the file shown, or in an annotation or a browsed file', () => {
    const selected = { path: 'a.cs', lines: LINES };
    expect(shownFileOf({ kind: 'diff', title: 'Changeset 12', target }, { target, path: 'a.cs' }, selected)).toEqual(selected);
    expect(shownFileOf({ kind: 'diff', title: 'Changeset 12', target }, { target, path: 'b.cs' }, selected)).toEqual({ path: 'b.cs' });
    expect(shownFileOf({ kind: 'history', path: 'a.cs', view: 'annotate' }, null, selected)).toEqual(selected);
    expect(shownFileOf({ kind: 'browseRepository', changesetId: 3 }, null, null)).toBeNull();
  });

  it("takes none from another page's diff, or for a page with none", () => {
    expect(shownFileOf({ kind: 'diff', title: 'Changeset 13', target: { kind: 'changeset', changesetId: 13 } }, { target, path: 'a.cs' }, null)).toBeNull();
    expect(shownFileOf({ kind: 'history', path: 'a.cs' }, { target, path: 'a.cs' }, null)).toBeNull();
    expect(shownFileOf(undefined, { target, path: 'a.cs' }, null)).toBeNull();
  });
});

describe('viewLinkTarget', () => {
  it('names every view showing what the repository holds', () => {
    for (const view of VIEW_IDS.filter((view) => view !== 'changes' && view !== 'files')) expect(viewLinkTarget(view)?.page).toMatchObject({ kind: 'view' });
    expect(viewLinkTarget('codeReviews')).toEqual({ page: { kind: 'view', view: 'code-reviews' } });
  });

  it('names none for Changes and Files: what they show is only on this computer', () => {
    expect(viewLinkTarget('changes')).toBeNull();
    expect(viewLinkTarget('files')).toBeNull();
  });
});

describe('copyLinkLabel', () => {
  it('says which file and lines it copies a link to', () => {
    expect(copyLinkLabel({ page: { kind: 'diffFile', path: '/src/Player.cs' }, lines: LINES })).toBe('Copy link to lines 40–52 of Player.cs');
    expect(copyLinkLabel({ page: { kind: 'diffFile', path: '/src/Player.cs' }, lines: { side: 'old', first: 7, last: 7 } })).toBe('Copy link to line 7 of Player.cs');
    expect(copyLinkLabel({ page: { kind: 'diffFile', path: '/src/Player.cs' } })).toBe('Copy link to Player.cs');
    expect(copyLinkLabel({ object: { kind: 'changeset', id: 1 } })).toBe('Copy link');
  });
});

describe('linkToCopy', () => {
  const diff = { kind: 'diff', title: 'Changeset 12', target: { kind: 'changeset', changesetId: 12 } } as const;

  it('copies the page in front, with the file and lines it shows, whatever the view has selected', () => {
    expect(linkToCopy({ top: diff, shown: { path: 'a.cs', lines: LINES }, hasSelectedObject: true, view: 'branches' })).toEqual({
      kind: 'target',
      target: { object: { kind: 'changeset', id: 12 }, page: { kind: 'diffFile', path: '/a.cs' }, lines: LINES },
    });
  });

  it("copies the view's selected object, else the view, and nothing for Changes and Files or a page no link names", () => {
    expect(linkToCopy({ top: undefined, shown: null, hasSelectedObject: true, view: 'branches' })).toEqual({ kind: 'selectedObject' });
    expect(linkToCopy({ top: undefined, shown: null, hasSelectedObject: false, view: 'locks' })).toEqual({ kind: 'target', target: { page: { kind: 'view', view: 'locks' } } });
    expect(linkToCopy({ top: undefined, shown: null, hasSelectedObject: false, view: 'changes' })).toBeNull();
    expect(linkToCopy({ top: { kind: 'diff', title: 'a → b', target: { kind: 'range', fromSpec: 'cs:3', toSpec: 'br:/main' } }, shown: null, hasSelectedObject: true, view: 'branches' })).toBeNull();
  });
});

describe('hasLinkToCopy', () => {
  it("has none for a history showing a revision of another repository (under an xlink), whose link it can't name", () => {
    const history = { kind: 'history', path: 'lib/a.cs' } as const;
    expect(hasLinkToCopy({ top: history, hasSelectedObject: false, view: 'files', shownOfOtherRepository: true })).toBe(false);
    expect(hasLinkToCopy({ top: history, hasSelectedObject: false, view: 'files', shownOfOtherRepository: false })).toBe(true);
  });

  it("has the view's selected object's, else the view's", () => {
    expect(hasLinkToCopy({ top: undefined, hasSelectedObject: true, view: 'changes', shownOfOtherRepository: false })).toBe(true);
    expect(hasLinkToCopy({ top: undefined, hasSelectedObject: false, view: 'changes', shownOfOtherRepository: false })).toBe(false);
  });
});

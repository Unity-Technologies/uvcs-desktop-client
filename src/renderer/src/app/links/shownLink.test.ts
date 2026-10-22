import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { VIEW_IDS } from '../navigation/views';
import { copyLinkLabel, pageLinkTarget, viewLinkTarget } from './shownLink';

const LINES = { side: 'new', first: 40, last: 52 } as const;

describe('pageLinkTarget', () => {
  it("names a diff's object, and the lines selected in its file, else the file it opened on", () => {
    const page = { kind: 'diff', title: 'Changeset 12', target: { kind: 'changeset', changesetId: 12 }, focusPath: 'a.cs' } as const;
    expect(pageLinkTarget(page, { path: 'src/b.cs', lines: LINES })).toEqual({ object: { kind: 'changeset', id: 12 }, page: { kind: 'diffFile', path: '/src/b.cs' }, lines: LINES });
    expect(pageLinkTarget(page, null)).toEqual({ object: { kind: 'changeset', id: 12 }, page: { kind: 'diffFile', path: '/a.cs' } });
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

  it('names a browsed changeset and the item selected in it', () => {
    expect(pageLinkTarget({ kind: 'browseRepository', changesetId: 7, focusPath: 'Assets' }, null)).toEqual({ object: { kind: 'changeset', id: 7 }, page: { kind: 'browse', path: '/Assets' } });
    expect(pageLinkTarget({ kind: 'browseRepository', changesetId: 7 }, null)).toEqual({ object: { kind: 'changeset', id: 7 }, page: { kind: 'browse', path: '/' } });
  });
});

describe('viewLinkTarget', () => {
  it('names every view', () => {
    for (const view of VIEW_IDS) expect(viewLinkTarget(view).page).toMatchObject({ kind: 'view' });
    expect(viewLinkTarget('codeReviews')).toEqual({ page: { kind: 'view', view: 'code-reviews' } });
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

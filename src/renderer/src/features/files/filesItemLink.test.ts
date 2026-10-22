import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { filesItemLink, filesLinesPublished, filesShownLink } from './filesItemLink';

const ON_TASK = { repository: 'game@local', selector: { kind: 'branch', name: '/main/task' }, loadedChangeset: 28 } as const;
const PLAYER = { path: 'Assets/Player.cs', repository: 'game@local' };
const LINES = { side: 'new', first: 40, last: 52 } as const;

describe('filesItemLink', () => {
  it('names the item on the branch the workspace is on, which stays useful as the branch moves on', () => {
    expect(filesItemLink(ON_TASK, PLAYER)).toEqual({ object: { kind: 'branch', name: '/main/task' }, page: { kind: 'browse', path: '/Assets/Player.cs' } });
  });

  it('pins its lines to the changeset the workspace has loaded, as line numbers shift along a branch', () => {
    expect(filesItemLink(ON_TASK, PLAYER, LINES)).toEqual({ object: { kind: 'changeset', id: 28 }, page: { kind: 'browse', path: '/Assets/Player.cs' }, lines: LINES });
  });

  it('names what a workspace not on a branch is on: a label, a changeset', () => {
    expect(filesItemLink({ ...ON_TASK, selector: { kind: 'label', name: 'v1' } }, PLAYER)?.object).toEqual({ kind: 'label', name: 'v1' });
    expect(filesItemLink({ ...ON_TASK, selector: { kind: 'changeset', name: '28' } }, PLAYER)?.object).toEqual({ kind: 'changeset', id: 28 });
  });

  it('names the root as the repository browsed there', () => {
    expect(filesItemLink(ON_TASK, { path: '', repository: 'game@local' })?.page).toEqual({ kind: 'browse', path: '/' });
  });

  it("names nothing the repository doesn't hold, another repository's item, a shelve's, or an older version's lines", () => {
    expect(filesItemLink(ON_TASK, { path: 'notes.txt', repository: '' })).toBeNull();
    expect(filesItemLink(ON_TASK, { path: 'lib/a.cs', repository: 'lib@local' })).toBeNull();
    expect(filesItemLink({ ...ON_TASK, selector: { kind: 'shelve', name: '3' }, loadedChangeset: null }, PLAYER)).toBeNull();
    expect(filesItemLink(ON_TASK, PLAYER, { side: 'old', first: 4, last: 4 })).toBeNull();
  });

  it("names no lines of an item with pending changes, whose viewer shows the workspace's own lines", () => {
    expect(filesItemLink(ON_TASK, PLAYER, LINES, { changed: true })).toBeNull();
    expect(filesShownLink(ON_TASK, PLAYER, { path: 'Assets/Player.cs', lines: LINES }, { changed: true })).toEqual(filesItemLink(ON_TASK, PLAYER));
  });
});

describe('filesShownLink', () => {
  it("names the lines selected in the item's viewer, else the item", () => {
    expect(filesShownLink(ON_TASK, PLAYER, { path: 'Assets/Player.cs', lines: LINES })?.lines).toEqual(LINES);
    expect(filesShownLink(ON_TASK, PLAYER, { path: 'Other.cs', lines: LINES })).toEqual(filesItemLink(ON_TASK, PLAYER));
    expect(filesShownLink(ON_TASK, PLAYER, { path: 'Assets/Player.cs', lines: { side: 'old', first: 1, last: 1 } })).toEqual(filesItemLink(ON_TASK, PLAYER));
  });
});

describe('filesLinesPublished', () => {
  it("publishes a linkable item's lines while the view is in front", () => {
    expect(filesLinesPublished({ linkable: true, changed: false, covered: false })).toBe(true);
  });

  it("publishes none for a changed item, one no link names, or under a page, whose lines a link names then", () => {
    expect(filesLinesPublished({ linkable: true, changed: true, covered: false })).toBe(false);
    expect(filesLinesPublished({ linkable: false, changed: false, covered: false })).toBe(false);
    expect(filesLinesPublished({ linkable: true, changed: false, covered: true })).toBe(false);
  });
});

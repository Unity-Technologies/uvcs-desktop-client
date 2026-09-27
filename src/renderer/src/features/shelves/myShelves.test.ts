import { describe, expect, it } from 'vitest';
import type { Shelve } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { matchesShelveFilter, myShelves, myShelvesLabel, withFoundShelves } from './myShelves';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const MINE = { everyone: false, me: 'me' };
const EVERYONE = { everyone: true, me: 'Me' };

const shelve = (id: number, comment: string, repository = 'eco@local', owner = 'me'): Shelve => ({
  id,
  guid: `guid-${id}`,
  comment,
  owner,
  date: '2026-09-27T10:00:00Z',
  parentChangeset: 4,
  repository,
});

const record = (shelveId: number, reason?: SwitchShelveRecord['reason']): SwitchShelveRecord => ({
  workspaceGuid: 'w',
  shelveId,
  repository: 'eco@local',
  source: { spec: 'br:/main/task', name: '/main/task', objectRef: 'br:7' },
  target: { spec: 'br:/main', name: '/main' },
  mode: 'leave',
  reason,
  createdAt: '2026-09-27T10:00:00Z',
  paths: ['a.txt', 'b.txt', 'c.txt'],
  changelists: [],
});

const automatic = 'Automatic shelve created during switch operation (from br:7)';

describe('myShelves', () => {
  it('names a shelve by its comment, keeping the order it is listed in', () => {
    expect(myShelves([shelve(12, 'Half-done login\n\nMore words'), shelve(3, '')], [], MINE, NOW)).toEqual([
      expect.objectContaining({ title: 'Half-done login', detail: 'sh:12 · 2 hours ago', left: false }),
      expect.objectContaining({ title: '(no comment)', left: false }),
    ]);
  });

  it('names the changes a switch or an update left by where they were, and counts what this app recorded', () => {
    const [switched, updated] = myShelves([shelve(12, automatic), shelve(11, automatic)], [record(12), record(11, 'update')], MINE, NOW);
    expect(switched).toMatchObject({ title: 'Left on /main/task', detail: 'sh:12 · 2 hours ago · 3 changes', left: true });
    expect(updated).toMatchObject({ title: 'Put aside to update /main/task', left: true });
  });

  it("recognizes another app's automatic shelves as left changes", () => {
    expect(myShelves([shelve(12, automatic)], [], MINE, NOW)[0]).toMatchObject({ title: 'Left when switching', left: true });
  });

  it('keeps the comment of changes the user shelved away, which apply like any shelve', () => {
    expect(myShelves([shelve(12, 'Spike')], [record(12, 'shelve')], MINE, NOW)[0]).toMatchObject({ title: 'Spike', detail: 'sh:12 · 2 hours ago · 3 changes', left: false });
  });

  it("matches records by repository too: shelve numbers repeat across repositories", () => {
    expect(myShelves([shelve(12, 'Other repo', 'other@local')], [record(12)], MINE, NOW)[0]).toMatchObject({ title: 'Other repo', left: false });
  });

  it("names nobody while the list is the user's own", () => {
    expect(myShelves([shelve(12, 'Spike')], [], MINE, NOW)[0]).toMatchObject({ author: null, mine: true });
  });

  it("names the author of everyone's shelves, the user's own as You, in any case", () => {
    const [theirs, own] = myShelves([shelve(13, 'Spike', 'eco@local', 'jane.doe@unity3d.com'), shelve(12, 'Mine')], [], EVERYONE, NOW);
    expect(theirs).toMatchObject({ author: 'Jane Doe', mine: false });
    expect(own).toMatchObject({ author: 'You', mine: true });
  });

  it("applies someone else's left changes like any shelve: theirs to restore, and this app's records are the user's", () => {
    const [theirs] = myShelves([shelve(12, automatic, 'eco@local', 'jane.doe@unity3d.com')], [record(12)], EVERYONE, NOW);
    expect(theirs).toMatchObject({ title: 'Left when switching', detail: 'sh:12 · 2 hours ago', left: false, mine: false });
  });

  it('takes no shelve for the user\'s while it is not known who they are', () => {
    expect(myShelves([shelve(12, 'Spike')], [], { everyone: true, me: undefined }, NOW)[0]).toMatchObject({ author: 'Me', mine: false });
  });
});

describe('matchesShelveFilter', () => {
  const [row] = myShelves([shelve(12, 'Half-done Login\n\nWith the new form')], [], MINE, NOW);

  it('finds a shelve by its comment in any case, or by its number', () => {
    expect(matchesShelveFilter(row!, 'login')).toBe(true);
    expect(matchesShelveFilter(row!, 'NEW FORM')).toBe(true);
    expect(matchesShelveFilter(row!, 'sh:12')).toBe(true);
    expect(matchesShelveFilter(row!, 'logout')).toBe(false);
  });

  it('finds changes a switch left by where they were left', () => {
    const [left] = myShelves([shelve(12, automatic)], [record(12)], MINE, NOW);
    expect(matchesShelveFilter(left!, 'main/task')).toBe(true);
  });

  it("finds everyone's shelves by author, by name or by user", () => {
    const [theirs] = myShelves([shelve(12, 'Spike', 'eco@local', 'jane.doe@unity3d.com')], [], EVERYONE, NOW);
    expect(matchesShelveFilter(theirs!, 'jane d')).toBe(true);
    expect(matchesShelveFilter(theirs!, 'jane.doe@')).toBe(true);
  });

  it("leaves the author out of the user's own list, where every shelve would match their name", () => {
    const [own] = myShelves([shelve(12, 'Spike', 'eco@local', 'jane.doe@unity3d.com')], [], MINE, NOW);
    expect(matchesShelveFilter(own!, 'jane')).toBe(false);
  });
});

describe('withFoundShelves', () => {
  it('adds the older shelves a search found, once each, newest first', () => {
    const ids = withFoundShelves([shelve(30, 'a'), shelve(20, 'b')], [shelve(20, 'b'), shelve(3, 'c'), shelve(31, 'd')]).map((found) => found.id);
    expect(ids).toEqual([31, 30, 20, 3]);
  });
});

describe('myShelvesLabel', () => {
  it('counts shelves', () => {
    expect(myShelvesLabel(1)).toBe('1 shelve');
    expect(myShelvesLabel(3)).toBe('3 shelves');
  });

  it("says just Shelves while open on everyone's with none of the user's", () => {
    expect(myShelvesLabel(0)).toBe('Shelves');
  });
});

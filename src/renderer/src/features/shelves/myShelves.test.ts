import { describe, expect, it } from 'vitest';
import type { Shelve } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { matchesShelveFilter, myShelves, myShelvesLabel, withFoundShelves } from './myShelves';

const NOW = Date.parse('2026-09-27T12:00:00Z');

const shelve = (id: number, comment: string, repository = 'eco@local'): Shelve => ({
  id,
  guid: `guid-${id}`,
  comment,
  owner: 'me',
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
    expect(myShelves([shelve(12, 'Half-done login\n\nMore words'), shelve(3, '')], [], NOW)).toEqual([
      expect.objectContaining({ title: 'Half-done login', detail: 'sh:12 · 2 hours ago', left: false }),
      expect.objectContaining({ title: '(no comment)', left: false }),
    ]);
  });

  it('names the changes a switch or an update left by where they were, and counts what this app recorded', () => {
    const [switched, updated] = myShelves([shelve(12, automatic), shelve(11, automatic)], [record(12), record(11, 'update')], NOW);
    expect(switched).toMatchObject({ title: 'Left on /main/task', detail: 'sh:12 · 2 hours ago · 3 changes', left: true });
    expect(updated).toMatchObject({ title: 'Put aside to update /main/task', left: true });
  });

  it("recognizes another app's automatic shelves as left changes", () => {
    expect(myShelves([shelve(12, automatic)], [], NOW)[0]).toMatchObject({ title: 'Left when switching', left: true });
  });

  it('keeps the comment of changes the user shelved away, which apply like any shelve', () => {
    expect(myShelves([shelve(12, 'Spike')], [record(12, 'shelve')], NOW)[0]).toMatchObject({ title: 'Spike', detail: 'sh:12 · 2 hours ago · 3 changes', left: false });
  });

  it("matches records by repository too: shelve numbers repeat across repositories", () => {
    expect(myShelves([shelve(12, 'Other repo', 'other@local')], [record(12)], NOW)[0]).toMatchObject({ title: 'Other repo', left: false });
  });
});

describe('matchesShelveFilter', () => {
  const [row] = myShelves([shelve(12, 'Half-done Login\n\nWith the new form')], [], NOW);

  it('finds a shelve by its comment in any case, or by its number', () => {
    expect(matchesShelveFilter(row!, 'login')).toBe(true);
    expect(matchesShelveFilter(row!, 'NEW FORM')).toBe(true);
    expect(matchesShelveFilter(row!, 'sh:12')).toBe(true);
    expect(matchesShelveFilter(row!, 'logout')).toBe(false);
  });

  it('finds changes a switch left by where they were left', () => {
    const [left] = myShelves([shelve(12, automatic)], [record(12)], NOW);
    expect(matchesShelveFilter(left!, 'main/task')).toBe(true);
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
});

import { describe, expect, it } from 'vitest';
import { listedFrom, suggestionCue, suggestionReads, type ListRead } from './suggestionSource';

const pending: ListRead<string> = { data: undefined, isPending: true, isError: false };
const failed: ListRead<string> = { data: undefined, isPending: false, isError: true };
const read = (data: string[]): ListRead<string> => ({ data, isPending: false, isError: false });

describe('listedFrom', () => {
  it('answers from the whole list once it is read, whatever a search found', () => {
    expect(listedFrom(read(['/main', '/main/a']), read(['/main/a']))).toEqual({ items: ['/main', '/main/a'], reading: false, failed: false });
  });

  it('answers from the server’s search of what is typed while the whole list is still being read', () => {
    expect(listedFrom(pending, read(['/main/fix-1009']))).toEqual({ items: ['/main/fix-1009'], reading: false, failed: false });
    expect(listedFrom(pending, pending)).toEqual({ items: [], reading: true, failed: false });
    expect(listedFrom(pending, null)).toEqual({ items: [], reading: true, failed: false });
  });

  it('says a read failed only once neither the list nor the search can answer, never as an empty repository', () => {
    expect(listedFrom(failed, read(['/main/a']))).toEqual({ items: ['/main/a'], reading: false, failed: false });
    expect(listedFrom(failed, pending)).toEqual({ items: [], reading: true, failed: false });
    expect(listedFrom(failed, failed)).toEqual({ items: [], reading: false, failed: true });
    expect(listedFrom(failed, null)).toEqual({ items: [], reading: false, failed: true });
  });
});

describe('suggestionCue', () => {
  it('marks the word typed once its trigger is read, pulsing while its list is read, and nothing once closed', () => {
    expect(suggestionCue({ recognized: true, dismissed: false, reading: true })).toBe('reading');
    expect(suggestionCue({ recognized: true, dismissed: false, reading: false })).toBe('ready');
    expect(suggestionCue({ recognized: true, dismissed: true, reading: true })).toBeNull();
    expect(suggestionCue({ recognized: false, dismissed: false, reading: false })).toBeNull();
  });
});

describe('listedFrom, render after render', () => {
  it('gives back the very list it was given, and one shared empty list, so what ranks them is built once per read', () => {
    const branches = ['/main', '/main/fix-1009'];
    expect(listedFrom(read(branches), null).items).toBe(branches);
    expect(listedFrom(pending, null).items).toBe(listedFrom(failed, pending).items);
  });
});

describe('suggestionReads', () => {
  const none = { paletteChangesetsRead: false, everyBranchRead: false, everyLabelRead: false };
  const reads = (kind: Parameters<typeof suggestionReads>[0]['kind'], typed: string, settled: string, lists = none) => suggestionReads({ kind, typed, settled, ...lists });

  it('reads nothing before a trigger is typed, nor for emoji', () => {
    expect(Object.values(reads(undefined, '', '')).some(Boolean)).toBe(false);
    expect(Object.values(reads('emoji', 'ta', 'ta')).some(Boolean)).toBe(false);
  });

  it('never searches this repository for another repository’s branch or label', () => {
    expect(reads('branch', '/main@art', '/main@art')).toMatchObject({ searchBranches: false });
    expect(reads('label', 'v1@art@build.example.com:8087', 'v1@art@build.example.com:8087')).toMatchObject({ searchLabels: false });
  });

  it('reads the newest 50 changesets for `cs:` and a mention, unless the palette’s 2,000 are already read', () => {
    expect(reads('changeset', '', '')).toMatchObject({ fewChangesets: true });
    expect(reads('person', 'an', 'an')).toMatchObject({ fewChangesets: true });
    expect(reads('changeset', '', '', { ...none, paletteChangesetsRead: true })).toMatchObject({ fewChangesets: false });
  });

  it('searches the server for a branch or label typed only once the text settles, and only until every one is read', () => {
    expect(reads('branch', 'fix-10', 'fix-10')).toMatchObject({ everyBranch: true, searchBranches: true });
    expect(reads('branch', 'fix-10', 'fix-1')).toMatchObject({ everyBranch: true, searchBranches: false });
    expect(reads('branch', '', '')).toMatchObject({ searchBranches: false });
    expect(reads('branch', 'fix-10', 'fix-10', { ...none, everyBranchRead: true })).toMatchObject({ searchBranches: false });
    expect(reads('label', 'v1', 'v1')).toMatchObject({ everyLabel: true, searchLabels: true, searchBranches: false });
  });

  it('searches the server’s users for a mention once the text settles: no list holds someone who never owned anything', () => {
    expect(reads('person', 'manuel', 'manuel')).toMatchObject({ searchPeople: true });
    expect(reads('person', 'manuel', 'manu')).toMatchObject({ searchPeople: false });
    expect(reads('person', '', '')).toMatchObject({ searchPeople: false });
    expect(reads('branch', 'manuel', 'manuel')).toMatchObject({ searchPeople: false });
  });
});

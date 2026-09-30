import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

// The results' menus import feature modules that read the platform as they load.

import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Label } from '@shared/domain/label';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { Shelve } from '@shared/domain/shelve';
import { createFuzzyIndex } from '../../lib/fuzzyIndex';
import type { ResultContext } from './objectResults';
import {
  changesetNumberIn,
  lacksServerMatch,
  MAX_PER_SECTION,
  paletteGroups,
  searchesServerFor,
  type CachedLists,
  type ChangesetSearch,
  type IndexedList,
  type PaletteGroupsInput,
  type ServerMatches,
} from './paletteGroups';
import type { PaletteScope } from './paletteScope';
import type { SearchGroup } from './searchResults';

const branch = (id: number, name: string, guid = `guid-${id}`): Branch => ({
  id,
  name,
  guid,
  parent: '',
  comment: '',
  owner: 'ana',
  date: '2026-01-01T00:00:00Z',
  headChangeset: 1,
  repository: 'repo@server',
});
const label = (id: number, name: string): Label => ({ id, name, changeset: 1, branch: '/main', comment: '', owner: 'ana', date: '2026-01-01T00:00:00Z', repository: 'repo@server' });
const changeset = (id: number, comment: string): Changeset => ({ id, comment, guid: `cs-${id}`, branch: '/main', owner: 'ana', date: '2026-01-01T00:00:00Z', parent: id - 1, repository: 'repo@server' });
const shelve = (id: number, comment: string): Shelve => ({ id, comment, guid: `sh-${id}`, owner: 'ana', date: '2026-01-01T00:00:00Z', parentChangeset: 1, repository: 'repo@server' });
const review = (id: number, title: string): CodeReviewSummary => ({ id, title, status: 'Under review', owner: 'ana', assignee: '', date: '2026-01-01T00:00:00Z' });
const change = (path: string): PendingChange => ({ path, kinds: ['changed'], itemType: 'file', size: 1, lastModified: '2026-01-01T00:00:00Z' });

function indexed<T>(items: T[], nameOf: (item: T) => string): IndexedList<T> {
  return { items, index: createFuzzyIndex(items.map(nameOf)) };
}
const branches = (...items: Branch[]) => indexed(items, (item) => item.name);
const labels = (...items: Label[]) => indexed(items, (item) => item.name);
const files = (...paths: string[]) => indexed(paths.map((path) => ({ path, isDirectory: false })), (entry) => entry.path);

interface Search {
  term?: string;
  scope?: PaletteScope;
  currentBranch?: string;
  lists?: Partial<CachedLists>;
  server?: Partial<ServerMatches>;
  changesetSearch?: Partial<ChangesetSearch>;
}

/** The palette's groups for what is typed; the server answered for the same term unless told otherwise. */
function groupsFor({ term = '', scope = 'all', currentBranch, lists, server, changesetSearch }: Search): SearchGroup[] {
  const context: ResultContext = { workspacePath: '/ws', term, currentBranch, loadedChangeset: 1, changelists: [], changeAt: () => undefined };
  const input: PaletteGroupsInput = {
    scope,
    context,
    lists: { changes: [], recentBranchGuids: [], ...lists },
    server: { term, ...server },
    changesetSearch: { isFetching: false, error: null, start: () => {}, ...changesetSearch },
  };
  return paletteGroups(input);
}

function labelsIn(groups: SearchGroup[], section: string): string[] {
  return groups.find((group) => group.section === section)?.results.map((result) => result.label) ?? [];
}

const sections = (groups: SearchGroup[]) => groups.map((group) => group.section);

describe('paletteGroups without a search', () => {
  it('lists the current branch, then the ones switched to lately (most recent first), then the rest in the newest-first order read', () => {
    const lists = {
      branches: branches(branch(1, '/main/new'), branch(2, '/main/older'), branch(3, '/main/recent', 'GUID-3'), branch(4, '/main'), branch(5, '/main/lately')),
      recentBranchGuids: ['guid-5', 'guid-3'],
    };

    expect(labelsIn(groupsFor({ lists, currentBranch: '/main' }), 'branches')).toEqual(['/main', '/main/lately', '/main/recent', '/main/new', '/main/older']);
  });

  it('lists the pending changes, the latest changesets and the shelves newest first', () => {
    const groups = groupsFor({
      lists: { changes: [change('src/a.ts')], changesets: [changeset(9, 'Fix'), changeset(8, 'Add')], shelves: [shelve(2, 'Two'), shelve(7, 'Seven')] },
    });

    expect(groups.map((group) => [group.heading, group.results.map((result) => result.label)])).toEqual([
      ['Pending changes', ['a.ts']],
      ['Changesets', ['Fix', 'Add']],
      ['Shelves', ['Seven', 'Two']],
    ]);
  });

  it('lists labels only when asked for them (@)', () => {
    const lists = { labels: labels(label(1, 'v1')), branches: branches(branch(1, '/main')) };

    expect(sections(groupsFor({ lists }))).toEqual(['branches']);
    expect(sections(groupsFor({ lists, scope: 'refs' }))).toEqual(['branches', 'labels']);
  });

  it('caps each section at MAX_PER_SECTION rows', () => {
    const many = Array.from({ length: MAX_PER_SECTION + 10 }, (_, index) => changeset(index + 1, `Change ${index}`));

    expect(labelsIn(groupsFor({ lists: { changesets: many } }), 'changesets')).toHaveLength(MAX_PER_SECTION);
  });

  it('leaves out the sections outside the scope and the empty ones', () => {
    const lists = { branches: branches(branch(1, '/main')), changesets: [changeset(1, 'Fix')], changes: [] };

    expect(sections(groupsFor({ lists }))).toEqual(['branches', 'changesets']);
    expect(sections(groupsFor({ lists, scope: 'changesets' }))).toEqual(['changesets']);
    expect(sections(groupsFor({ lists, scope: 'files' }))).toEqual([]);
  });

  it('lists nothing while the lists are still loading', () => {
    expect(groupsFor({})).toEqual([]);
  });
});

describe('paletteGroups with a search', () => {
  it('finds files, branches and labels fuzzily and comments, shelves and reviews by every word typed', () => {
    const groups = groupsFor({
      term: 'login',
      lists: {
        files: files('src/login.ts', 'src/other.ts'),
        branches: branches(branch(1, '/main/login-fix'), branch(2, '/main/other')),
        labels: labels(label(1, 'login-v2'), label(2, 'v3')),
        changesets: [changeset(10, 'Fix the login screen'), changeset(11, 'Unrelated')],
        shelves: [shelve(3, 'login wip'), shelve(4, 'other')],
        codeReviews: [review(5, 'Review login'), review(6, 'Other')],
      },
    });

    expect(groups.map((group) => [group.section, group.results.map((result) => result.label)])).toEqual([
      ['files', ['login.ts']],
      ['branches', ['/main/login-fix']],
      ['labels', ['login-v2']],
      ['changesets', ['Fix the login screen', 'Search all changesets for “login”']],
      ['shelves', ['login wip']],
      ['codeReviews', ['Review login']],
    ]);
  });

  it('matches changesets and shelves by their spec too', () => {
    const groups = groupsFor({ term: 'sh:4', lists: { shelves: [shelve(3, 'Three'), shelve(4, 'Four')] } });

    expect(labelsIn(groups, 'shelves')).toEqual(['Four']);
  });
});

describe('paletteGroups for a changeset number', () => {
  it('opens a recent changeset typed by number (123 or cs:123) with its comment, first and as a full match', () => {
    const lists = { changesets: [changeset(1234, 'Recent work'), changeset(12345, 'Mentions 1234')] };

    for (const term of ['1234', 'cs:1234', 'CS:1234']) {
      const results = groupsFor({ term, lists }).find((group) => group.section === 'changesets')!.results;
      expect(results.map((result) => [result.label, result.quality])).toEqual([
        ['Recent work', 1],
        ['Mentions 1234', expect.any(Number)],
      ]);
    }
  });

  it('opens an older changeset by number alone, and offers no search of every comment', () => {
    expect(labelsIn(groupsFor({ term: '77', lists: { changesets: [] } }), 'changesets')).toEqual(['Changeset 77']);
  });
});

describe('paletteGroups with what the server found', () => {
  it('adds what the cached list misses after its own matches, never twice', () => {
    const groups = groupsFor({
      term: 'task',
      lists: { branches: branches(branch(1, '/main/task-1')) },
      server: { branches: [branch(1, '/main/task-1'), branch(2, '/main/task-2')] },
    });

    expect(labelsIn(groups, 'branches')).toEqual(['/main/task-1', '/main/task-2']);
  });

  it('adds at most three', () => {
    const found = [2, 3, 4, 5, 6].map((id) => label(id, `release-${id}`));

    expect(labelsIn(groupsFor({ term: 'release', lists: { labels: labels() }, server: { labels: found } }), 'labels')).toHaveLength(3);
  });

  it('adds only those with every word typed (the server search is looser)', () => {
    const found = [shelve(1, 'fix the login'), shelve(2, 'fix the logout')];

    expect(labelsIn(groupsFor({ term: 'fix login', lists: { shelves: [] }, server: { shelves: found } }), 'shelves')).toEqual(['fix the login']);
  });

  it('ignores an answer for an older term, which would not fit what is typed now', () => {
    const groups = groupsFor({ term: 'task-2', lists: { codeReviews: [] }, server: { term: 'task', codeReviews: [review(1, 'task-2 review')] } });

    expect(sections(groups)).not.toContain('codeReviews');
  });
});

describe('paletteGroups search of every changeset', () => {
  const searchAll = (search: Partial<ChangesetSearch>, term = 'crash', changesets: Changeset[] = []) =>
    groupsFor({ term, lists: { changesets }, changesetSearch: search }).find((group) => group.section === 'changesets')?.results.at(-1);

  it('is offered for a term of three letters or more, pinned, and runs for that term without closing the palette', () => {
    const start = vi.fn();
    const offer = searchAll({ start });

    expect(offer).toMatchObject({ label: 'Search all changesets for “crash”', pinned: true, keepOpen: true });
    offer!.run();
    expect(start).toHaveBeenCalledWith('crash');
    expect(searchAll({}, 'cr')).toBeUndefined();
  });

  it('is offered again once the term changes after a search', () => {
    expect(searchAll({ term: 'cras', found: [] })?.label).toBe('Search all changesets for “crash”');
  });

  it('spins while searching', () => {
    expect(searchAll({ term: 'crash', isFetching: true })).toMatchObject({ label: 'Searching all changesets…', busy: true });
  });

  it('says why it failed', () => {
    expect(searchAll({ term: 'crash', error: new Error('timed out') })).toMatchObject({ label: 'Could not search changesets: timed out', disabled: true });
  });

  it('lists the older changesets found, without the recent ones already shown', () => {
    const recent = [changeset(900, 'crash on start')];
    const found = [changeset(900, 'crash on start'), changeset(12, 'old crash'), changeset(11, 'unrelated')];
    const results = groupsFor({ term: 'crash', lists: { changesets: recent }, changesetSearch: { term: 'crash', found } }).find(
      (group) => group.section === 'changesets',
    )!.results;

    expect(results.map((result) => result.label)).toEqual(['crash on start', 'old crash']);
  });

  it('says when no other changeset mentions the term', () => {
    const recent = [changeset(900, 'crash on start')];

    expect(searchAll({ term: 'crash', found: recent }, 'crash', recent)).toMatchObject({ label: 'No other changesets mention “crash”', disabled: true });
  });
});

describe('searchesServerFor', () => {
  it('asks the server from three letters on, and never for a changeset number', () => {
    expect(searchesServerFor('ab')).toBe(false);
    expect(searchesServerFor('abc')).toBe(true);
    expect(searchesServerFor('1234')).toBe(false);
    expect(searchesServerFor('cs:1234')).toBe(false);
  });
});

describe('changesetNumberIn', () => {
  it('reads 123 and cs:123 in any case, and nothing else', () => {
    expect([changesetNumberIn('123'), changesetNumberIn('Cs:123'), changesetNumberIn('cs:12a'), changesetNumberIn('sh:3')]).toEqual(['123', '123', undefined, undefined]);
  });
});

describe('lacksServerMatch', () => {
  it('tells a fully cached list is out of date when the server found an object it lacks', () => {
    expect(lacksServerMatch([{ id: 1 }, { id: 2 }], [{ id: 1 }])).toBe(true);
    expect(lacksServerMatch([{ id: 1 }], [{ id: 1 }, { id: 2 }])).toBe(false);
  });

  it('decides nothing until both lists are read', () => {
    expect(lacksServerMatch(undefined, [{ id: 1 }])).toBe(false);
    expect(lacksServerMatch([{ id: 1 }], undefined)).toBe(false);
  });
});

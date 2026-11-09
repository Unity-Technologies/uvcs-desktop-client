import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { contextRailOf, isShown, otherFilesHeading, shownFileOf, shownOf, type RailItem } from './contextRail';
import type { LineThread } from './fileThreads';

const REPOSITORY = 'game@local';

function threadOn(fields: Partial<ReviewComment> = {}): LineThread {
  const root: ReviewComment = {
    id: 1,
    guid: 'g1',
    author: 'ana',
    date: '2026-11-06T10:00:00Z',
    text: 'Rename it',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId: 20, itemId: 7, path: '/src/Player.cs', line: 12 },
    ...fields,
  };
  return threadsOf([root])[0] as LineThread;
}

function entry(path: string, fields: Partial<DiffEntry> = {}): DiffEntry {
  return { status: 'changed', path, itemType: 'file', baseRevisionId: 20, revisionId: 25, repository: REPOSITORY, ...fields };
}

const APPLIED = threadOn({ appliedInChangeset: 15 });
const COMMENTED = entry('src/Player.cs');
const TESTS = entry('tests/PlayerTests.cs');
const DOCS = entry('docs/player.md', { status: 'added', baseRevisionId: -1 });

const pathsOf = (items: RailItem[]) => items.map((item) => (item.kind === 'view' ? item.view : item.entry.path));

describe('contextRailOf', () => {
  it("lists the thread's two views, then what else the changeset that applied it changed, in its diff's order", () => {
    const rail = contextRailOf(APPLIED, [TESTS, COMMENTED, DOCS]);
    expect(pathsOf(rail)).toEqual(['commented', 'since', 'tests/PlayerTests.cs', 'docs/player.md']);
    expect(rail.slice(0, 2)).toEqual([
      { kind: 'view', view: 'commented', label: 'When commented' },
      { kind: 'view', view: 'since', label: 'How it was applied' },
    ]);
  });

  it('leaves the commented file out by the path it moved from too', () => {
    const moved = entry('src/game/Player.cs', { status: 'moved', oldPath: 'src/Player.cs' });
    expect(pathsOf(contextRailOf(APPLIED, [moved, TESTS]))).toEqual(['commented', 'since', 'tests/PlayerTests.cs']);
  });

  it("lists a moved file, an xlink, a deleted file and a binary one, but not a folder, whose diff says no more than its row", () => {
    const others = [
      entry('src', { itemType: 'directory' }),
      entry('art/hero.png', { itemType: 'binaryFile' }),
      entry('lib/engine', { itemType: 'xlink' }),
      entry('old/Legacy.cs', { status: 'deleted', revisionId: -1 }),
    ];
    expect(pathsOf(contextRailOf(APPLIED, [COMMENTED, ...others]))).toEqual(['commented', 'since', 'art/hero.png', 'lib/engine', 'old/Legacy.cs']);
  });

  it('has no rail when the changeset changed only the commented file, or folders besides it: the views stay a switch', () => {
    expect(contextRailOf(APPLIED, [COMMENTED])).toEqual([]);
    expect(contextRailOf(APPLIED, [COMMENTED, entry('src', { itemType: 'directory' })])).toEqual([]);
  });

  it('has a rail for a request marked applied by hand, whose changeset changed other files but not this one', () => {
    expect(pathsOf(contextRailOf(APPLIED, [TESTS]))).toEqual(['commented', 'since', 'tests/PlayerTests.cs']);
  });

  it('has no rail for a thread not applied, nor before the changeset is read', () => {
    expect(contextRailOf(threadOn(), [COMMENTED, TESTS])).toEqual([]);
    expect(contextRailOf(APPLIED, undefined)).toEqual([]);
  });
});

describe('picking in the rail', () => {
  const [commented, since, tests] = contextRailOf(APPLIED, [COMMENTED, TESTS]) as [RailItem, RailItem, RailItem];

  it('shows the view or the file picked, and marks it alone', () => {
    expect(shownOf(since)).toEqual({ kind: 'view', view: 'since' });
    expect(shownOf(tests)).toEqual({ kind: 'file', path: 'tests/PlayerTests.cs' });
    expect([commented, since, tests].map((item) => isShown(item, shownOf(tests)))).toEqual([false, false, true]);
    expect([commented, since, tests].map((item) => isShown(item, shownOf(commented)))).toEqual([true, false, false]);
  });

  it("finds a file's entry by its path, also one under an xlink, which has no row of its own", () => {
    const underXlink = entry('lib/engine/Core.cs', { repository: 'engine@local' });
    expect(shownFileOf({ kind: 'file', path: 'tests/PlayerTests.cs' }, [COMMENTED, TESTS])).toBe(TESTS);
    expect(shownFileOf({ kind: 'file', path: 'lib/engine/Core.cs' }, [COMMENTED, underXlink])).toBe(underXlink);
  });

  it('finds none for a view, or a file the diff no longer holds', () => {
    expect(shownFileOf({ kind: 'view', view: 'since' }, [COMMENTED, TESTS])).toBeUndefined();
    expect(shownFileOf({ kind: 'file', path: 'gone.cs' }, [COMMENTED, TESTS])).toBeUndefined();
  });
});

describe('otherFilesHeading', () => {
  it('names the changeset the other files were changed in', () => {
    expect(otherFilesHeading(APPLIED)).toBe('Also in changeset 15');
  });
});

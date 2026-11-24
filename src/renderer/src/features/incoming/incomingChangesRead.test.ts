import { fakeApi } from '../../testing/fakeWindow';
import { focusManager, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { showOnce } from '../../testing/queryProbes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../app/queryClient';
import type { DiffEntry } from '@shared/domain/diff';
import type { BranchIncoming, BranchIncomingChanges, IncomingChanges, IncomingSummary, NothingIncoming, PartialIncomingChanges } from '@shared/domain/incoming';
import type { PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import {
  incomingChangesFor,
  incomingChangesKey,
  incomingChangesQuery,
  incomingChangesReadFor,
  readsOncePerHead,
  withLocalCollisions,
} from './incomingChangesRead';

const NOTHING: NothingIncoming = { branch: null, changesetCount: 0, countCapped: false, authors: [] };
const checked: BranchIncoming = { branch: '/main', loadedChangeset: 41, headChangeset: 43, changesetCount: 2, countCapped: false, authors: ['ana'] };
const partialChecked: IncomingSummary = { branch: '/main', partial: true, headChangeset: 7, itemCount: 2 };

function file(path: string, status: DiffEntry['status'], extra: Partial<DiffEntry> = {}): DiffEntry {
  return { path, status, itemType: 'file', baseRevisionId: 10, revisionId: 20, repository: 'game@local', ...extra };
}

function local(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

/** Changes' pending changes, as their query holds them. */
function pending(...changes: PendingChange[]): PendingChangesSnapshot {
  return { changes, changelists: [], mergeLinks: [] };
}

const read: BranchIncomingChanges = {
  ...checked,
  changesets: [],
  moreChangesets: false,
  files: [file('src/a.txt', 'changed'), file('src/b.txt', 'changed'), file('src/gone.txt', 'deleted')],
  conflicts: [{ path: 'src/a.txt', isBinary: false, baseRevisionId: 10, incomingRevisionId: 20, repository: 'game@local' }],
  blockedPaths: [],
};

describe('what the incoming changes are read for', () => {
  it("is the head the check saw, with the branch and the loaded changeset, and nothing of the check's counts", () => {
    expect(incomingChangesFor(checked, false)).toEqual({ branch: '/main', loadedChangeset: 41, headChangeset: 43 });
  });

  it('waits for the check: read before it answers, they would be read again under the head it tells', () => {
    expect(incomingChangesFor(undefined, false)).toBeUndefined();
  });

  it('reads them anyway while the check fails, so Incoming says what went wrong', () => {
    expect(incomingChangesFor(undefined, true)).toBe('unchecked');
  });

  it("is a partial workspace's branch alone, which its check compares as the head moves", () => {
    expect(incomingChangesFor(partialChecked, false)).toEqual({ branch: '/main', partial: true });
  });

  it('is off a branch when the workspace is on no branch', () => {
    expect(incomingChangesFor(NOTHING, false)).toBe('offBranch');
  });

  it('keys what was read under the head it was read at, the key the check finds once it sees that head', () => {
    expect(incomingChangesKey('/w', incomingChangesReadFor(read))).toEqual(incomingChangesKey('/w', incomingChangesFor(checked, false)!));
    const partial: PartialIncomingChanges = { branch: '/main', partial: true, headChangeset: 7, items: [] };
    expect(incomingChangesReadFor(partial)).toEqual({ branch: '/main', partial: true });
    expect(incomingChangesReadFor({ ...NOTHING, changesets: [], moreChangesets: false, files: [], conflicts: [], blockedPaths: [] })).toBe('offBranch');
  });

  it('is another key once the head moves or the workspace loads another changeset', () => {
    const key = (summary: BranchIncoming) => incomingChangesKey('/w', incomingChangesFor(summary, false)!);
    expect(key({ ...checked, headChangeset: 44 })).not.toEqual(key(checked));
    expect(key({ ...checked, loadedChangeset: 42 })).not.toEqual(key(checked));
    expect(key({ ...checked, changesetCount: 3, authors: ['ana', 'bob'] })).toEqual(key(checked));
  });
});

describe('reading once per head', () => {
  it('holds at a head, where what came in changes only with a new head', () => {
    expect(readsOncePerHead(incomingChangesFor(checked, false))).toBe(true);
  });

  it("leaves the rest to the default refreshes: a partial workspace's, off a branch, unchecked, or not yet known", () => {
    expect(readsOncePerHead({ branch: '/main', partial: true })).toBe(false);
    expect(readsOncePerHead('offBranch')).toBe(false);
    expect(readsOncePerHead('unchecked')).toBe(false);
    expect(readsOncePerHead(undefined)).toBe(false);
  });
});

describe('what collides with the local changes', () => {
  it("follows Changes' pending changes read after the incoming ones: a file changed since collides, one undone no longer does", () => {
    const changes = withLocalCollisions({ data: read, readAt: 100 }, { data: pending(local('src/b.txt', ['changed']), local('src/gone.txt', ['checkedOut'])), readAt: 200 });

    expect(changes).toMatchObject({ conflicts: [{ path: 'src/b.txt', baseRevisionId: 10, incomingRevisionId: 20 }], blockedPaths: ['src/gone.txt'] });
  });

  it('leaves out what the update never collides with: a file private, or deleted on disk only', () => {
    const changes = withLocalCollisions({ data: read, readAt: 100 }, { data: pending(local('src/gone.txt', ['locallyDeleted']), local('src/b.txt', ['private'])), readAt: 200 });

    expect(changes).toMatchObject({ conflicts: [], blockedPaths: [] });
  });

  it('is the same object while the conflicts and blocked files come out the same, so what shows them keeps its place', () => {
    const changes = withLocalCollisions({ data: read, readAt: 100 }, { data: pending(local('src/a.txt', ['checkedOut', 'changed']), local('notes.txt', ['changed'])), readAt: 200 });

    expect(changes).toBe(read);
  });

  it('keeps what the incoming changes found when the pending changes were read before them', () => {
    expect(withLocalCollisions({ data: read, readAt: 200 }, { data: pending(), readAt: 100 })).toBe(read);
  });

  it('keeps what the incoming changes found until the pending changes are read', () => {
    expect(withLocalCollisions({ data: read, readAt: 100 }, undefined)).toBe(read);
    expect(withLocalCollisions(undefined, { data: pending(), readAt: 100 })).toBeUndefined();
  });

  it('works nothing out when nothing comes in that changes files', () => {
    const nothing = { ...read, files: [] };
    expect(withLocalCollisions({ data: nothing, readAt: 100 }, { data: pending(local('src/a.txt', ['changed'])), readAt: 200 })).toBe(nothing);
  });

  it("leaves a partial workspace's items as compared: each says itself whether it conflicts", () => {
    const partial: IncomingChanges = {
      branch: '/main',
      partial: true,
      headChangeset: 7,
      items: [{ kind: 'changed', path: 'a.txt', isDirectory: false, conflict: true, loadedRevisionId: 1, headRevisionId: 2 }],
    };
    expect(withLocalCollisions({ data: partial, readAt: 100 }, { data: pending(), readAt: 200 })).toBe(partial);
  });
});

describe('the incoming changes on screen at a head', () => {
  let client: QueryClient;
  beforeEach(() => {
    client = createQueryClient();
    client.mount();
    vi.useFakeTimers({ toFake: ['Date'] });
    fakeApi.answer('merge.incomingChanges', () => read);
  });
  afterEach(() => {
    client.unmount();
    client.clear();
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  const query = (summary: BranchIncoming) => incomingChangesQuery('/w', incomingChangesFor(summary, false));
  /** The read the query has under way, or the last one done: awaited, whatever a focus or a refresh started. */
  const readOf = (summary: BranchIncoming) => client.getQueryCache().find({ queryKey: query(summary).queryKey, exact: true })?.promise;

  it('are never read again on a window focus or as a view shows them, however long the head stays', async () => {
    const view = new QueryObserver(client, query(checked));
    view.subscribe(() => {});
    await readOf(checked);

    vi.advanceTimersByTime(60 * 60_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await readOf(checked);
    await showOnce(client, query(checked));

    expect(fakeApi.argsOf('merge.incomingChanges')).toHaveLength(1);
  });

  it('are read once more for a new head, as a new key', async () => {
    await showOnce(client, query(checked));

    await showOnce(client, query({ ...checked, headChangeset: 44 }));

    expect(fakeApi.argsOf('merge.incomingChanges')).toHaveLength(2);
  });

  it('are read again when an operation refreshes them under the same head', async () => {
    const view = new QueryObserver(client, query(checked));
    view.subscribe(() => {});
    await readOf(checked);

    // What `refreshQueries` does with the refreshes an operation declares (`isAffectedByCheckinOrUpdate`).
    await client.invalidateQueries({ queryKey: query(checked).queryKey });

    expect(fakeApi.argsOf('merge.incomingChanges')).toHaveLength(2);
  });
});

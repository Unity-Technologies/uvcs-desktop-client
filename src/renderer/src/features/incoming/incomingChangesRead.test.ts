import { fakeApi } from '../../testing/fakeWindow';
import { focusManager, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../app/queryClient';
import type { DiffEntry } from '@shared/domain/diff';
import type { BranchIncoming, BranchIncomingChanges, IncomingChanges, IncomingSummary, NothingIncoming, PartialIncomingChanges } from '@shared/domain/incoming';
import type { PendingChange } from '@shared/domain/pendingChanges';
import {
  checksLocalCollisions,
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
  it('is checked only when something comes in that changes files', () => {
    expect(checksLocalCollisions(read)).toBe(true);
    expect(checksLocalCollisions({ ...read, files: [] })).toBe(false);
    expect(checksLocalCollisions(undefined)).toBe(false);
    expect(checksLocalCollisions({ branch: '/main', partial: true, headChangeset: 7, items: [] })).toBe(false);
  });

  it('follows the local changes read after the incoming ones: a file changed since collides, one undone no longer does', () => {
    const changes = withLocalCollisions({ data: read, readAt: 100 }, { data: [local('src/b.txt', ['changed']), local('src/gone.txt', ['checkedOut'])], readAt: 200 });

    expect(changes).toMatchObject({ conflicts: [{ path: 'src/b.txt', baseRevisionId: 10, incomingRevisionId: 20 }], blockedPaths: ['src/gone.txt'] });
  });

  it('keeps what the incoming changes found when the local changes were read before them', () => {
    expect(withLocalCollisions({ data: read, readAt: 200 }, { data: [], readAt: 100 })).toBe(read);
  });

  it('keeps what the incoming changes found until the local changes are read', () => {
    expect(withLocalCollisions({ data: read, readAt: 100 }, undefined)).toBe(read);
    expect(withLocalCollisions(undefined, { data: [], readAt: 100 })).toBeUndefined();
  });

  it("leaves a partial workspace's items as compared: each says itself whether it conflicts", () => {
    const partial: IncomingChanges = {
      branch: '/main',
      partial: true,
      headChangeset: 7,
      items: [{ kind: 'changed', path: 'a.txt', isDirectory: false, conflict: true, loadedRevisionId: 1, headRevisionId: 2 }],
    };
    expect(withLocalCollisions({ data: partial, readAt: 100 }, { data: [], readAt: 200 })).toBe(partial);
  });
});

describe('the incoming changes on screen at a head', () => {
  let client: QueryClient;
  beforeEach(() => {
    client = createQueryClient();
    client.mount();
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    client.unmount();
    client.clear();
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  /** Lets the client handle what just happened (a focus, a key changing) and run the reads it starts. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  function show(summary: BranchIncoming): QueryObserver<IncomingChanges> {
    const observer = new QueryObserver(client, incomingChangesQuery('/w', incomingChangesFor(summary, false)!));
    observer.subscribe(() => {});
    return observer;
  }

  it('are never read again on a window focus, however long the head stays', async () => {
    fakeApi.answer('merge.incomingChanges', () => read);
    show(checked);
    await settle();

    vi.advanceTimersByTime(60 * 60_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await settle();

    expect(fakeApi.argsOf('merge.incomingChanges')).toHaveLength(1);
  });

  it('are read once more for a new head, as a new key', async () => {
    fakeApi.answer('merge.incomingChanges', () => read);
    const observer = show(checked);
    await settle();

    observer.setOptions(incomingChangesQuery('/w', incomingChangesFor({ ...checked, headChangeset: 44 }, false)!));
    await settle();

    expect(fakeApi.argsOf('merge.incomingChanges')).toHaveLength(2);
  });

  it('are read again when an operation refreshes them under the same head', async () => {
    fakeApi.answer('merge.incomingChanges', () => read);
    show(checked);
    await settle();

    // What `refreshQueries` does with the refreshes an operation declares (`isAffectedByCheckinOrUpdate`).
    await client.invalidateQueries({ queryKey: incomingChangesKey('/w', incomingChangesFor(checked, false)!) });

    expect(fakeApi.argsOf('merge.incomingChanges')).toHaveLength(2);
  });
});

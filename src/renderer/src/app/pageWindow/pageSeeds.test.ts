import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import type { Changeset } from '@shared/domain/changeset';
import type { Shelve } from '@shared/domain/shelve';
import { queryKeys } from '../../api/queryKeys';
import { listedChangeset } from '../../features/changesets/useChangeset';
import { cachedShelve } from '../../features/shelves/cachedShelve';
import type { Page } from '../navigation/pages';
import { queryClient } from '../queryClient';
import { pageSeed, plantPageSeed } from './pageSeeds';

const WS = '/work/game';
const READ_AT = 1_700_000_000_000;
const CHANGESET: Changeset = { id: 10, guid: 'g10', parent: 9, branch: '/main/drift', owner: 'ana', date: '2026-10-16T10:00:00Z', comment: 'Drift physics', repository: 'game@local' };
const SHELVE: Shelve = { id: 4, guid: 'g4', comment: 'Wip', owner: 'ana', date: '2026-10-01T10:00:00Z', parentChangeset: 9, repository: 'game@local' };
const diffOf = (target: Extract<Page, { kind: 'diff' }>['target']): Page => ({ kind: 'diff', title: 'A diff', target });

beforeEach(() => queryClient.clear());

describe('handing a page window what its page shows', () => {
  it("takes a changeset's or shelve's row from the lists already read, with when they were read", () => {
    queryClient.setQueryData(queryKeys.inWorkspace(WS, 'changesets', { since: 'month' }), [CHANGESET], { updatedAt: READ_AT });
    queryClient.setQueryData(queryKeys.inWorkspace(WS, 'shelves', {}), [SHELVE], { updatedAt: READ_AT });

    expect(pageSeed(WS, diffOf({ kind: 'changeset', changesetId: 10 }))).toEqual({ readAt: READ_AT, changeset: CHANGESET });
    expect(pageSeed(WS, diffOf({ kind: 'shelve', shelveId: 4 }))).toEqual({ readAt: READ_AT, shelve: SHELVE });
  });

  it('hands nothing no list read, nor for a page without such a row', () => {
    expect(pageSeed(WS, diffOf({ kind: 'changeset', changesetId: 10 }))).toBeUndefined();
    expect(pageSeed(WS, diffOf({ kind: 'branch', branch: '/main/drift' }))).toBeUndefined();
    expect(pageSeed(WS, { kind: 'history', path: 'src/player.cs' })).toBeUndefined();
  });

  it("stays while the window lives, though nothing observes it: a shelve's page reads it at every render", () => {
    vi.useFakeTimers();
    try {
      plantPageSeed(WS, { readAt: READ_AT, shelve: SHELVE });
      vi.advanceTimersByTime(60 * 60 * 1000);

      expect(cachedShelve(workspacePlace(WS), 4)).toEqual(SHELVE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is found in the page window where its page looks, as read when its window read it', () => {
    plantPageSeed(WS, { readAt: READ_AT, changeset: CHANGESET, shelve: SHELVE });

    expect(listedChangeset(workspacePlace(WS), 10)).toEqual({ changeset: CHANGESET, readAt: READ_AT });
    expect(cachedShelve(workspacePlace(WS), 4)).toEqual(SHELVE);
  });
});

import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Shelve } from '@shared/domain/shelve';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { cachedShelve } from './cachedShelve';

const ws = '/ws';
const shelve = (id: number): Shelve => ({ id, guid: `g${id}`, comment: '', owner: 'ana', date: '', parentChangeset: 1, repository: 'game@local' });

beforeEach(() => queryClient.clear());

describe('cachedShelve', () => {
  it("finds the shelve in any list of shelves already read: the user's, everyone's or a search's", () => {
    queryClient.setQueryData(queryKeys.inWorkspace(ws, 'shelves', { owners: ['me'] }), [shelve(3)]);
    queryClient.setQueryData(queryKeys.inWorkspace(ws, 'shelves', { text: 'login' }), undefined);
    queryClient.setQueryData(queryKeys.inWorkspace(ws, 'shelves', {}), [shelve(7), shelve(9)]);

    expect(cachedShelve(ws, 9)).toEqual(shelve(9));
    expect(cachedShelve(ws, 3)).toEqual(shelve(3));
  });

  it("is unknown when no list of this workspace read it: the diff page then offers nothing to apply", () => {
    queryClient.setQueryData(queryKeys.inWorkspace('/other', 'shelves', {}), [shelve(9)]);

    expect(cachedShelve(ws, 9)).toBeUndefined();
  });
});

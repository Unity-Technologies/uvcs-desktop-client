import '../../testing/fakeWindow';
import { QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '../../app/queryClient';
import { MEMBER_NAMES_QUERY } from './permissionsQueries';

describe('a list of users or groups the server refused', () => {
  it('is not asked again by each view that mounts with it, as every row of the reviews list does', async () => {
    const client = createQueryClient();
    const queryKey = ['members', 'local', 'group', ''];
    let reads = 0;
    const queryFn = async (): Promise<string[]> => {
      reads++;
      throw new Error('LDAP size limit exceeded');
    };
    await client.fetchQuery({ queryKey, queryFn, ...MEMBER_NAMES_QUERY }).catch(() => undefined);

    const rows = [1, 2, 3].map(() => new QueryObserver(client, { queryKey, queryFn, ...MEMBER_NAMES_QUERY }));
    const unsubscribes = rows.map((row) => row.subscribe(() => {}));
    await Promise.resolve();

    expect(reads).toBe(1);
    for (const unsubscribe of unsubscribes) unsubscribe();
  });
});

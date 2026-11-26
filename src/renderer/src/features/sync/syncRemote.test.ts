import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { syncRemoteChange } from './syncRemote';

const summary = { id: '2', name: 'game', server: 'acme@cloud', owner: 'ana', spec: 'game@acme@cloud' };

describe('syncRemoteChange', () => {
  it('keeps the remote picked by its spec and its GUID, which finds it once renamed', () => {
    const guid = repositoryGuidFor(1);

    expect(syncRemoteChange({ ...summary, guid })).toEqual({ syncRemote: 'game@acme@cloud', syncRemoteGuid: guid });
  });

  it('forgets the GUID of a remote picked before when the one picked now has none, a listing that printed none', () => {
    expect(syncRemoteChange(summary)).toEqual({ syncRemote: 'game@acme@cloud', syncRemoteGuid: null });
  });
});

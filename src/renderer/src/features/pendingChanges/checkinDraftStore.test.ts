import { describe, expect, it } from 'vitest';
import { useCheckinDraftStore } from './checkinDraftStore';

describe('checkinDraftStore', () => {
  it('clears the comment after a check-in and keeps the files left out of it left out', () => {
    const store = useCheckinDraftStore.getState();
    store.setMessage('/wk', { summary: 'Fix the build', description: 'Details' });
    store.setIncluded('/wk', ['private.txt', 'build/out.log'], false);
    store.clearMessage('/wk');
    const draft = useCheckinDraftStore.getState().drafts['/wk']!;
    expect(draft).toMatchObject({ summary: '', description: '' });
    expect([...draft.excludedPaths]).toEqual(['private.txt', 'build/out.log']);
  });

  it('goes back to the files the user left out once a prepared changelist is done with', () => {
    const store = useCheckinDraftStore.getState();
    store.setIncluded('/prepared', ['a.txt'], false);
    store.prepareChangelist('/prepared', { name: 'ui', paths: new Set(['b.txt']) });
    store.setIncluded('/prepared', ['c.txt'], true);
    expect([...useCheckinDraftStore.getState().drafts['/prepared']!.prepared!.paths].sort()).toEqual(['b.txt', 'c.txt']);

    store.endPrepared('/prepared');

    expect(useCheckinDraftStore.getState().drafts['/prepared']).toMatchObject({ prepared: null, excludedPaths: new Set(['a.txt']) });
  });
});

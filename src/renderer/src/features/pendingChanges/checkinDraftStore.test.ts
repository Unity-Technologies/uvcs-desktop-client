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
});

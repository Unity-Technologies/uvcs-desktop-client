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

  it('keeps the panel checking in or shelving per workspace, and sets which files a check-in leaves out in one go', () => {
    const store = useCheckinDraftStore.getState();
    store.setIncluded('/modes', ['a.txt'], false);
    store.setMode('/modes', 'shelve');
    store.setExcluded('/modes', ['b.txt', 'c.txt']);
    const draft = useCheckinDraftStore.getState().drafts['/modes']!;
    expect(draft.mode).toBe('shelve');
    expect([...draft.excludedPaths].sort()).toEqual(['b.txt', 'c.txt']);
    expect(useCheckinDraftStore.getState().drafts['/other']?.mode ?? 'checkin').toBe('checkin');
  });
});

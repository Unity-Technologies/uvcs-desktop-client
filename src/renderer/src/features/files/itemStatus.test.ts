import { describe, expect, it } from 'vitest';
import { iconOverlay } from './itemStatus';

const xlink = { writable: true, path: '/', changeset: 12, repository: 'lib', server: 'local' };

describe('iconOverlay', () => {
  it('shows the pending status first', () => {
    expect(iconOverlay({ isPrivate: false, xlink }, { tone: 'changed', label: 'Changed' })).toBe('changed');
  });

  it('marks xlinks, private items and up-to-date controlled items', () => {
    expect(iconOverlay({ isPrivate: false, xlink }, null)).toBe('xlink');
    expect(iconOverlay({ isPrivate: true }, null)).toBe('private');
    expect(iconOverlay({ isPrivate: false }, null)).toBe('controlled');
  });
});

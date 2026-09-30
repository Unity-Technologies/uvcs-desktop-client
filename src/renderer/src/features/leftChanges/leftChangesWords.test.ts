import { describe, expect, it } from 'vitest';
import type { LeftChanges } from '@shared/domain/switchWithChanges';
import { leftChangesDetail, leftChangesTitle } from './leftChangesWords';

const NOW = Date.parse('2026-09-27T12:00:00Z');

const left = (overrides: Partial<LeftChanges> = {}): LeftChanges => ({
  shelveId: 12,
  sourceName: '/main/task',
  targetName: '/main',
  mode: 'leave',
  reason: 'switch',
  count: 3,
  createdAt: '2026-09-27T10:00:00Z',
  foreign: false,
  ...overrides,
});

describe('Welcome back', () => {
  it('welcomes the user back to the changes they left on switching away', () => {
    expect(leftChangesTitle(left())).toBe('Welcome back — you left 3 changes on /main/task');
    expect(leftChangesDetail(left(), NOW)).toBe('Shelved 2 hours ago (shelve 12) when you switched to /main.');
  });

  it('names no destination for a shelve another app left, which only says it was left', () => {
    expect(leftChangesDetail(left({ targetName: undefined }), NOW)).toBe('Shelved 2 hours ago (shelve 12).');
    expect(leftChangesDetail(left({ foreign: true }), NOW)).toBe('Shelved 2 hours ago (shelve 12), left from another workspace or app.');
  });

  it('tells changes still waiting to be brought, whose files need a decision', () => {
    const bring = left({ mode: 'bring' });
    expect(leftChangesTitle(bring)).toBe('Your changes from /main/task are waiting to be brought here');
    expect(leftChangesDetail(bring, NOW)).toBe('Shelved 2 hours ago (shelve 12) when you switched here. Some files need your decision.');
  });

  it('tells changes put aside to update from changes left by a switch', () => {
    expect(leftChangesTitle(left({ reason: 'update', count: 1 }))).toBe('1 change put aside to update');
    expect(leftChangesDetail(left({ reason: 'update', count: 1 }), NOW)).toBe(
      'Shelved 2 hours ago (shelve 12): /main/task deleted or moved the file. Restoring merges your changes back.',
    );
    expect(leftChangesDetail(left({ reason: 'update' }), NOW)).toContain('deleted or moved the files.');
  });
});

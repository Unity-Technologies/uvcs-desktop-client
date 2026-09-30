import { describe, expect, it } from 'vitest';
import { draftTargetSpec } from './reviewDraft';

describe('draftTargetSpec', () => {
  it('takes a full branch name, as typed but for the spaces around it', () => {
    expect(draftTargetSpec('branch', ' /main/task ')).toBe('br:/main/task');
    expect(draftTargetSpec('branch', 'main/task')).toBeNull();
  });

  it('takes a changeset or shelve by number', () => {
    expect(draftTargetSpec('changeset', '42')).toBe('cs:42');
    expect(draftTargetSpec('shelve', ' 7')).toBe('sh:7');
  });

  it('takes nothing that is not a number for a changeset or shelve', () => {
    expect(draftTargetSpec('changeset', 'cs:42')).toBeNull();
    expect(draftTargetSpec('shelve', '')).toBeNull();
    expect(draftTargetSpec('changeset', '4.2')).toBeNull();
  });
});

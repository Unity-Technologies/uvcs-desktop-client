import { describe, expect, it } from 'vitest';
import { workingObjectName } from './workingObject';

describe('workingObjectName', () => {
  it('shows branches and labels by name', () => {
    expect(workingObjectName({ kind: 'branch', name: '/main/task' })).toBe('/main/task');
    expect(workingObjectName({ kind: 'label', name: 'v1.0' })).toBe('v1.0');
  });

  it('shows changesets and shelves as specs', () => {
    expect(workingObjectName({ kind: 'changeset', name: '12' })).toBe('cs:12');
    expect(workingObjectName({ kind: 'shelve', name: '3' })).toBe('sh:3');
  });
});

import { describe, expect, it } from 'vitest';
import { workingObjectLabel } from './workingObjectLabel';

describe('workingObjectLabel', () => {
  it('shows a switch’s progress over anything else, even before the workspace is known', () => {
    expect(workingObjectLabel('Switching to /main/task', { kind: 'branch', name: '/main' })).toEqual({ kind: 'switching', text: 'Switching to /main/task…' });
    expect(workingObjectLabel('Switching to /main/task', undefined)).toEqual({ kind: 'switching', text: 'Switching to /main/task…' });
  });

  it('holds the line with a placeholder while what the workspace is on isn’t known', () => {
    expect(workingObjectLabel(null, undefined)).toEqual({ kind: 'loading' });
  });

  it('shows a branch by its name, for the path and its merge request', () => {
    expect(workingObjectLabel(null, { kind: 'branch', name: '/main/task' })).toEqual({ kind: 'branch', title: '/main/task' });
  });

  it('names a label as one, and changesets and shelves as they explain themselves', () => {
    expect(workingObjectLabel(null, { kind: 'label', name: '1.0' })).toEqual({ kind: 'other', title: 'Label 1.0' });
    expect(workingObjectLabel(null, { kind: 'changeset', name: '42' })).toMatchObject({ kind: 'other' });
    expect(workingObjectLabel(null, { kind: 'shelve', name: '3' })).toMatchObject({ kind: 'other' });
  });
});

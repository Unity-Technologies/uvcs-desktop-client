import { Archive, GitBranch, GitCommitVertical, Tag } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { selectorChip, workingObjectName } from './workingObject';

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

describe('selectorChip', () => {
  it('shows a branch by its last segment, with the branch icon, the whole name in its tooltip', () => {
    expect(selectorChip({ kind: 'branch', name: '/main/task' })).toEqual({ icon: GitBranch, text: 'task', tip: 'Branch', tipSub: '/main/task' });
  });

  it('shows a changeset, a label or a shelve with its own icon, as the status bar does', () => {
    expect(selectorChip({ kind: 'changeset', name: '12' })).toEqual({ icon: GitCommitVertical, text: 'cs:12', tip: 'Changeset', tipSub: 'cs:12' });
    expect(selectorChip({ kind: 'label', name: 'v1.0' }).icon).toBe(Tag);
    expect(selectorChip({ kind: 'shelve', name: '3' }).icon).toBe(Archive);
  });
});

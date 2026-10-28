import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { mergeLabels } from './mergeDescription';
import { directoryConflictIdentity } from '@shared/domain/directoryConflictIdentity';
import type { DirectoryConflict } from '@shared/domain/merge';
import { resolutionsByConflict } from './directoryConflicts/directoryDecisions';
import { mergeProgress, type MergeItem } from './mergeItems';
import { changeTone, describeChange, directoryConflictStatus, fileConflictStatus, groupProgress, mergeGroupProgress, planProgress, presentStatus, summarizePlan } from './mergeStatus';
import type { FileConflictState } from './resolve/useFileConflicts';

const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });
const contents = { base: text('a\n'), source: text('S\n'), destination: text('D\n') };

function fileState(overrides: Partial<FileConflictState>): FileConflictState {
  return {
    file: { key: '/a.txt', path: 'a.txt', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
    status: 'ready',
    contents,
    isBinary: false,
    decidedByUser: false,
    resolution: null,
    mergedAutomatically: false,
    remainingConflicts: 0,
    ...overrides,
  };
}

const workspaceLabels = mergeLabels({ kind: 'merge', sourceSpec: 'br:/main' }, undefined);

describe('fileConflictStatus', () => {
  it('tells files merged without the user from files waiting for them', () => {
    expect(fileConflictStatus(fileState({ mergedAutomatically: true, resolution: { choice: 'text', text: 'x\n' } }))).toBe('automatic');
    expect(fileConflictStatus(fileState({ remainingConflicts: 1 }))).toBe('needsDecision');
    expect(fileConflictStatus(fileState({ status: 'loading' }))).toBe('reading');
  });

  it('names the side kept, whether as a whole file or by picking it for every conflict', () => {
    expect(fileConflictStatus(fileState({ resolution: { choice: 'source' } }))).toBe('keepingSource');
    expect(fileConflictStatus(fileState({ decision: { kind: 'text', text: 'D\n' }, resolution: { choice: 'text', text: 'D\n' } }))).toBe('keepingDestination');
  });

  it('tells a result combining both sides from one edited by hand', () => {
    expect(fileConflictStatus(fileState({ decision: { kind: 'text', text: 'D\nS\n' }, resolution: { choice: 'text', text: 'D\nS\n' } }))).toBe('combined');
    expect(fileConflictStatus(fileState({ decision: { kind: 'text', text: 'D\n', edited: true }, resolution: { choice: 'text', text: 'D\n' } }))).toBe('edited');
  });
});

describe('directoryConflictStatus', () => {
  it('follows the resolution picked', () => {
    expect(directoryConflictStatus(undefined)).toBe('needsDecision');
    expect(directoryConflictStatus({ choice: 'rename', newName: 'b' })).toBe('keepingBoth');
  });

  it('is being applied while cm calculates the merge again on its decision, whatever it was decided before', () => {
    expect(directoryConflictStatus(undefined, true)).toBe('applying');
    expect(directoryConflictStatus({ choice: 'source' }, true)).toBe('applying');
    expect(presentStatus('applying', workspaceLabels).label).toBe('Updating the merge…');
  });
});

describe('presentStatus', () => {
  it('speaks of what the merge will do, in the words of the side', () => {
    expect(presentStatus('automatic', workspaceLabels).label).toBe('Will merge automatically');
    expect(presentStatus('keepingDestination', workspaceLabels).label).toBe('Keeping yours');
    expect(presentStatus('keepingSource', workspaceLabels).explanation).toBe('/main');
    const serverLabels = mergeLabels({ kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' }, undefined);
    expect(presentStatus('keepingDestination', serverLabels).label).toBe('Keeping destination');
  });

  it('tells a tool the user works in from UnityYAMLMerge, which merges on its own', () => {
    expect(presentStatus('openInTool', workspaceLabels, 'VS Code')).toMatchObject({ label: 'Open in VS Code…', explanation: 'Save and close it in VS Code' });
    expect(presentStatus('openInTool', workspaceLabels, 'UnityYAMLMerge')).toMatchObject({ label: 'Merging…', explanation: 'UnityYAMLMerge is merging it' });
    expect(presentStatus('resolvedInTool', workspaceLabels, 'VS Code')).toMatchObject({ label: 'Resolved in VS Code', explanation: 'Saved in VS Code' });
    expect(presentStatus('resolvedInTool', workspaceLabels, 'UnityYAMLMerge')).toMatchObject({ label: 'Merged by UnityYAMLMerge', explanation: 'UnityYAMLMerge merged both sides’ changes' });
  });
});

describe('describeChange', () => {
  it('says what will happen to the file', () => {
    expect(describeChange({ kind: 'added', path: '/a' }, workspaceLabels)).toBe('Will be added: new on the incoming side');
    expect(describeChange({ kind: 'moved', path: '/b', oldPath: '/a' }, workspaceLabels)).toBe('Will be moved from /a');
  });
});

describe('summarizePlan', () => {
  it('counts the changes and where the conflicts stand', () => {
    expect(summarizePlan(1, [])).toBe('1 change to apply · no conflicts');
    expect(summarizePlan(598, ['automatic', 'needsDecision'])).toBe('598 changes to apply · 2 conflicts: 1 will merge automatically, 1 needs your decision');
    expect(summarizePlan(3, ['combined', 'keepingSource', 'automatic'])).toBe('3 changes to apply · 3 conflicts: 1 will merge automatically, 2 decided');
  });
});

describe('planProgress', () => {
  it('counts the conflicts resolved and those still to decide, or says the merge is ready', () => {
    expect(planProgress([])).toBe('Ready to merge');
    expect(planProgress(['automatic', 'keepingSource'])).toBe('Ready to merge');
    expect(planProgress(['needsDecision', 'needsDecision'])).toBe('2 conflicts to decide');
    // Merged automatically counts as resolved: it needs nothing from the user.
    expect(planProgress(['automatic', 'needsDecision'])).toBe('1 resolved · 1 to decide');
    expect(planProgress(['needsDecision', 'openInTool', 'combined'])).toBe('1 resolved · 2 to decide');
    // A directory decision being applied isn't in the merge yet: it can't complete meanwhile.
    expect(planProgress(['applying', 'combined'])).toBe('1 resolved · 1 to decide');
  });
});

describe('groupProgress', () => {
  it("counts a group's conflicts resolved out of all, with those still to decide in its tooltip", () => {
    expect(groupProgress(['keepingSource', 'needsDecision', 'reading'])).toEqual({ count: '1 of 3', tip: '1 resolved, 2 to decide' });
    expect(groupProgress(['automatic', 'keepingBoth'])).toEqual({ count: '2 of 2' });
    expect(groupProgress(['needsDecision'])).toEqual({ count: '0 of 1', tip: '1 to decide' });
  });
});

describe('mergeGroupProgress', () => {
  it("counts the conflict groups' conflicts as they stand, and gives the changes to apply their plain count", () => {
    const state = fileState({ file: { ...fileState({}).file, key: 'a' }, resolution: { choice: 'source' } });
    const conflict: MergeItem = { kind: 'fileConflict', key: 'file:a', path: 'a.txt', file: state.file };
    const change: MergeItem = { kind: 'change', key: 'change:0', path: 'b.txt', change: { kind: 'added', path: '/b.txt' } };
    const progress = mergeProgress([state], new Map());

    expect(mergeGroupProgress('fileConflicts', [conflict], progress)).toEqual({ count: '1 of 1' });
    expect(mergeGroupProgress('changes', [change], progress)).toBeUndefined();
  });

  it('counts a directory conflict decided as resolved, and one whose decision is being applied as still to decide', () => {
    const side = { operation: 'added' as const, path: '/shared', description: 'Added /shared' };
    const conflictOf = (itemId: number): DirectoryConflict => ({ type: 'evilTwin', title: '', explanation: '', itemId, isDirectory: true, source: side, destination: side });
    const [decided, applying] = [conflictOf(30), conflictOf(31)];
    const items: MergeItem[] = [decided, applying].map((conflict) => ({ kind: 'directoryConflict', key: `directory:${conflict.itemId}`, path: 'shared', conflict }));
    const progress = mergeProgress([], resolutionsByConflict([{ conflict: decided, resolution: { choice: 'source' } }]), directoryConflictIdentity(applying));

    expect(mergeGroupProgress('directoryConflicts', items, progress)).toEqual({ count: '1 of 2', tip: '1 resolved, 1 to decide' });
  });
});

describe('changeTone', () => {
  it('badges a clean change by its kind', () => {
    expect(changeTone({ kind: 'moved', path: '/b.ts', oldPath: '/a.ts' })).toBe('moved');
    expect(changeTone({ kind: 'permissions', path: '/run.sh' })).toBe('permissions');
  });
});

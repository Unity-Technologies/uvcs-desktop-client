import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { mergeLabels } from './mergeDescription';
import { describeChange, directoryConflictStatus, fileConflictStatus, planProgress, presentStatus, summarizePlan } from './mergeStatus';
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
});

describe('presentStatus', () => {
  it('speaks of what the merge will do, in the words of the side', () => {
    expect(presentStatus('automatic', workspaceLabels).label).toBe('Will merge automatically');
    expect(presentStatus('keepingDestination', workspaceLabels).label).toBe('Keeping yours');
    expect(presentStatus('keepingSource', workspaceLabels).explanation).toBe('/main');
    const serverLabels = mergeLabels({ kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' }, undefined);
    expect(presentStatus('keepingDestination', serverLabels).label).toBe('Keeping destination');
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
  it('counts what still stands in the way, or says the merge is ready', () => {
    expect(planProgress([])).toBe('Ready to merge');
    expect(planProgress(['automatic', 'keepingSource'])).toBe('Ready to merge');
    expect(planProgress(['automatic', 'needsDecision'])).toBe('1 conflict to decide');
    expect(planProgress(['needsDecision', 'openInTool', 'combined'])).toBe('2 conflicts to decide');
  });
});

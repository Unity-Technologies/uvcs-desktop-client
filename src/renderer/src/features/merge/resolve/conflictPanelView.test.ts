import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { effectiveView, mergedText, textToEdit } from './conflictPanelView';
import type { FileConflictState } from './useFileConflicts';

const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });
const MARKED = '<<<<<<< /main\nmine\n=======\ntheirs\n>>>>>>> /main/task\n';

function stateOf(overrides: Partial<FileConflictState> = {}): FileConflictState {
  return {
    file: { key: '/a.ts', path: 'src/a.ts', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
    status: 'ready',
    contents: { base: text('base'), source: text('theirs'), destination: text('mine') },
    isBinary: false,
    document: { text: MARKED } as FileConflictState['document'],
    decision: { kind: 'text', text: MARKED },
    decidedByUser: false,
    resolution: null,
    mergedAutomatically: false,
    remainingConflicts: 1,
    ...overrides,
  };
}

describe('effectiveView', () => {
  it('opens on the conflicts while any is left, then on what the merge changes', () => {
    expect(effectiveView(undefined, stateOf())).toBe('conflicts');
    expect(effectiveView('changes', stateOf())).toBe('conflicts');
    expect(effectiveView('conflicts', stateOf({ remainingConflicts: 0 }))).toBe('changes');
  });

  it('keeps a contributor picked, but not a base the file has none of', () => {
    expect(effectiveView('source', stateOf())).toBe('source');
    expect(effectiveView('base', stateOf())).toBe('conflicts');
    const withBase = stateOf({ file: { ...stateOf().file, base: { kind: 'spec', spec: 'serverpath:/src/a.ts#cs:4' } } });
    expect(effectiveView('base', withBase)).toBe('base');
  });
});

describe('mergedText', () => {
  it('is nothing while conflicts are left', () => {
    expect(mergedText(stateOf())).toBeNull();
  });

  it('is the resolved text, or the version kept whole', () => {
    expect(mergedText(stateOf({ decision: { kind: 'text', text: 'both' }, remainingConflicts: 0 }))).toBe('both');
    expect(mergedText(stateOf({ decision: { kind: 'wholeFile', side: 'source' }, remainingConflicts: 0 }))).toBe('theirs');
  });

  it('is nothing for a binary', () => {
    expect(mergedText(stateOf({ isBinary: true, decision: { kind: 'wholeFile', side: 'source' } }))).toBeNull();
  });
});

describe('textToEdit', () => {
  it('starts from where the file stands: the text with its markers, or the version kept', () => {
    expect(textToEdit(stateOf())).toBe(MARKED);
    expect(textToEdit(stateOf({ decision: { kind: 'wholeFile', side: 'destination' } }))).toBe('mine');
    expect(textToEdit(stateOf({ decision: undefined }))).toBe(MARKED);
  });
});

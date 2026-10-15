import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { LONGEST_DRAWN_LINE } from '../../diff/viewer/longLines';
import { effectiveView, editInAppUnavailable, mergedText, rendersVersions, textToEdit } from './conflictPanelView';
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

describe('a binary file', () => {
  const model = (size: number): FileContent => ({ isBinary: true, size, model: { bytes: new Uint8Array(size), format: 'fbx' } });
  const image = (size: number): FileContent => ({ isBinary: true, size, image: { bytes: new Uint8Array(size), mimeType: 'image/png' } });
  const opaque = (size: number): FileContent => ({ isBinary: true, size });
  const binary = (contents: FileConflictState['contents']): FileConflictState =>
    stateOf({ isBinary: true, contents, document: undefined, decision: undefined, remainingConflicts: 1 });

  it('opens on the versions to choose from', () => {
    expect(effectiveView(undefined, binary({ base: model(1), source: model(2), destination: model(3) }))).toBe('choice');
    expect(effectiveView('conflicts', binary({ base: model(1), source: model(2), destination: model(3) }))).toBe('choice');
  });

  it('shows each side against the base where its versions render: models and images', () => {
    expect(rendersVersions(binary({ base: model(1), source: model(2), destination: model(3) }))).toBe(true);
    expect(rendersVersions(binary({ base: image(1), source: image(2), destination: image(3) }))).toBe(true);
    expect(effectiveView('source', binary({ base: model(1), source: model(2), destination: model(3) }))).toBe('source');
  });

  it('offers only the choice for a binary that renders as nothing', () => {
    const state = binary({ base: opaque(1), source: opaque(2), destination: opaque(3) });
    expect(rendersVersions(state)).toBe(false);
    expect(effectiveView('source', state)).toBe('choice');
  });

  it('takes a side added on both, with no base, as still rendering', () => {
    expect(rendersVersions(binary({ base: { isBinary: false, size: 0, text: '' }, source: model(2), destination: model(3) }))).toBe(true);
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

describe('editInAppUnavailable', () => {
  it('offers editing the text in the app', () => {
    expect(editInAppUnavailable(stateOf())).toBeNull();
  });

  it("says why a text with a line too long to draw unwrapped isn't edited in the app: typing there froze the window", () => {
    const minified = `<<<<<<< /main\n${'var a=b;'.repeat(LONGEST_DRAWN_LINE / 4)}\n=======\nx\n>>>>>>> /main/task\n`;
    expect(editInAppUnavailable(stateOf({ decision: { kind: 'text', text: minified } }))).toBe('A line of this file is too long to edit here');
  });
});

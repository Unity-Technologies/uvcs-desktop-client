import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { LONGEST_DRAWN_LINE, LONGEST_EDITED_LINE } from '../../diff/viewer/longLines';
import {
  FRESH_PANEL,
  conflictsToStep,
  editInAppUnavailable,
  effectiveView,
  hasBase,
  justDecided,
  mergedText,
  offersConflictBase,
  offersKeepBase,
  rememberConflicts,
  rendersVersions,
  textToEdit,
  type PanelMemory,
} from './conflictPanelView';
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

/** A file with a common ancestor: one a test keeps the base of. */
const withBaseFile = (overrides: Partial<FileConflictState> = {}): FileConflictState =>
  stateOf({ file: { ...stateOf().file, base: { kind: 'spec', spec: 'itemid:7#cs:4@game@local', fileName: 'src/a.ts' } }, ...overrides });

describe('hasBase', () => {
  it('offers keeping the base only for a file that has one: not one added on both sides', () => {
    expect(hasBase(withBaseFile())).toBe(true);
    expect(hasBase(stateOf())).toBe(false);
    expect(hasBase(stateOf({ isBinary: true, document: undefined }))).toBe(false);
  });
});

describe('offersKeepBase', () => {
  it('offers keeping a base the file has, but not the change an undo takes away', () => {
    expect(offersKeepBase(withBaseFile())).toBe(true);
    expect(offersKeepBase(stateOf())).toBe(false);
    expect(offersKeepBase(withBaseFile({ file: { ...withBaseFile().file, baseIsUndoneChange: true } }))).toBe(false);
  });
});

describe('offersConflictBase', () => {
  const marked = { kind: 'text' as const, text: MARKED, conflictBases: ['base\n'] };
  it('offers keeping one conflict\'s base when the file offers its base and that conflict\'s is known', () => {
    expect(offersConflictBase(withBaseFile({ decision: marked }), 0)).toBe(true);
    expect(offersConflictBase(withBaseFile({ decision: { kind: 'text', text: MARKED, edited: true } }), 0)).toBe(false);
    expect(offersConflictBase(withBaseFile({ decision: marked, file: { ...withBaseFile().file, baseIsUndoneChange: true } }), 0)).toBe(false);
  });
});

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
    expect(mergedText(withBaseFile({ decision: { kind: 'wholeFile', side: 'base' }, remainingConflicts: 0 }))).toBe('base');
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

describe('conflictsToStep', () => {
  it('steps through the conflicts left in the conflicts view', () => {
    expect(conflictsToStep('conflicts', stateOf({ remainingConflicts: 3 }), false)).toBe(3);
  });

  it("leaves a diff's changes to the diff's own arrows, and steps through nothing in the base or while the file loads", () => {
    for (const view of ['changes', 'destination', 'source', 'base'] as const) expect(conflictsToStep(view, stateOf(), false)).toBeNull();
    expect(conflictsToStep('changes', stateOf({ status: 'loading', remainingConflicts: 0 }), false)).toBeNull();
  });

  it('takes a binary waiting for the version to keep as one conflict, and none once one is kept', () => {
    const binary = stateOf({ isBinary: true, document: undefined, decision: undefined, remainingConflicts: 0 });
    expect(conflictsToStep('choice', binary, false)).toBe(1);
    expect(conflictsToStep('choice', { ...binary, resolution: { choice: 'source' } }, false)).toBe(0);
  });

  it('keeps the arrows, with none left, in a file just decided while shown: they go straight on to the next file', () => {
    expect(conflictsToStep('changes', stateOf({ remainingConflicts: 0 }), true)).toBe(0);
  });

  it("has none in a file that couldn't be read, whose arrows still go on to the next file", () => {
    expect(conflictsToStep('changes', stateOf({ status: 'error', remainingConflicts: 0 }), false)).toBe(0);
  });
});

describe('justDecided', () => {
  const decided = stateOf({ remainingConflicts: 0, decision: { kind: 'text', text: 'merged' } });
  const opened = (state: FileConflictState): PanelMemory => rememberConflicts(FRESH_PANEL, state);

  it('is a file whose last conflict was resolved while it showed, whatever view the user picks', () => {
    const memory = rememberConflicts(opened(stateOf({ remainingConflicts: 2 })), decided);
    expect(justDecided(memory, decided)).toBe(true);
    expect(justDecided({ ...memory, chosen: 'changes' }, decided)).toBe(true);
  });

  it("isn't a file that waits still, nor one decided before it showed", () => {
    expect(justDecided(opened(stateOf()), stateOf())).toBe(false);
    expect(justDecided(opened(decided), decided)).toBe(false);
  });

  it('opens the conflicts again once started over, and is just decided once they are resolved again', () => {
    const before = { ...opened(decided), chosen: 'source' as const };
    const startedOver = rememberConflicts(before, stateOf({ remainingConflicts: 2 }));
    expect(startedOver.chosen).toBeUndefined();
    expect(justDecided(startedOver, stateOf({ remainingConflicts: 2 }))).toBe(false);
    expect(justDecided(rememberConflicts(startedOver, decided), decided)).toBe(true);
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

  it(`says the same of a line longer than ${LONGEST_EDITED_LINE} characters`, () => {
    expect(editInAppUnavailable(stateOf({ decision: { kind: 'text', text: 'x'.repeat(LONGEST_EDITED_LINE + 1) } }))).toBe('A line of this file is too long to edit here');
    expect(editInAppUnavailable(stateOf({ decision: { kind: 'text', text: 'x'.repeat(LONGEST_EDITED_LINE) } }))).toBeNull();
  });
});

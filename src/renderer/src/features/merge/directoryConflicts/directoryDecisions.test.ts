import { describe, expect, it } from 'vitest';
import type { DirectoryConflict, DirectoryDecision } from '@shared/domain/merge';
import { applyToNextBox, applyToNextLabel, canKeepBothAs, changesDecisions, droppedDecisions, droppedDecisionsToast, isDecidedAs, nextOfSameKind, pickedChoice, resolutionsByConflict, withDecision, withDecisionAndNext } from './directoryDecisions';

const conflictAt = (path: string, itemId: number): DirectoryConflict => ({
  type: 'evilTwin',
  title: 'Added on both sides with the same name',
  explanation: '',
  itemId,
  isDirectory: true,
  source: { operation: 'added', path, description: `Added ${path}` },
  destination: { operation: 'added', path, description: `Added ${path}` },
});
const shared = conflictAt('/src/shared', 30);
const assets = conflictAt('/assets', 31);
const keepIncoming = (conflict: DirectoryConflict): DirectoryDecision => ({ conflict, resolution: { choice: 'source' } });
const keepYours = (conflict: DirectoryConflict): DirectoryDecision => ({ conflict, resolution: { choice: 'destination' } });

describe('withDecision', () => {
  it('adds a new decision after the others, and changes one made before in its place', () => {
    const first = withDecision([], shared, { choice: 'source' });
    const both = withDecision(first, assets, { choice: 'source' });

    expect(both).toEqual([keepIncoming(shared), keepIncoming(assets)]);
    expect(withDecision(both, { ...shared }, { choice: 'destination' })).toEqual([keepYours(shared), keepIncoming(assets)]);
  });
});

describe('droppedDecisions', () => {
  it('names the decisions asked that the merge no longer took', () => {
    expect(droppedDecisions([keepYours(shared), keepIncoming(assets)], [keepYours(shared)])).toEqual([keepIncoming(assets)]);
    expect(droppedDecisions([keepYours(shared)], [keepYours(shared)])).toEqual([]);
  });
});

describe('resolutionsByConflict', () => {
  it("tells each decided conflict's resolution apart from the others'", () => {
    const resolutions = resolutionsByConflict([keepYours(shared), keepIncoming(assets)]);

    expect([...resolutions.values()]).toEqual([{ choice: 'destination' }, { choice: 'source' }]);
    expect(resolutions.size).toBe(2);
  });
});

describe('droppedDecisionsToast', () => {
  it('names the one decision dropped by its item, and counts several', () => {
    expect(droppedDecisionsToast([keepIncoming(assets)]).title).toBe('Your decision on assets no longer applies');
    expect(droppedDecisionsToast([keepIncoming(assets), keepYours(shared)]).title).toBe('2 decisions no longer apply');
  });
});

describe('canKeepBothAs', () => {
  it('takes a name the merge takes that differs from the one applied', () => {
    expect(canKeepBothAs('shared-main', undefined)).toBe(true);
    expect(canKeepBothAs('shared-main', { choice: 'source' })).toBe(true);
    expect(canKeepBothAs('shared-main', { choice: 'rename', newName: 'shared-main' })).toBe(false);
    expect(canKeepBothAs('shared-2', { choice: 'rename', newName: 'shared-main' })).toBe(true);
  });

  it("refuses a name that isn't one", () => {
    for (const name of ['', '  ', 'a/b', 'a\\b', '.', '..']) expect(canKeepBothAs(name, undefined)).toBe(false);
  });
});

describe('pickedChoice', () => {
  it('shows Keep both picked while its name is given, else the decision applied', () => {
    expect(pickedChoice(true, { choice: 'source' })).toBe('rename');
    expect(pickedChoice(false, { choice: 'source' })).toBe('source');
    expect(pickedChoice(false, undefined)).toBeUndefined();
  });
});

describe('isDecidedAs', () => {
  it('tells a conflict decided the same way, keeping both under the same name', () => {
    const decisions = [keepIncoming(shared), { conflict: assets, resolution: { choice: 'rename', newName: 'assets-main' } } as DirectoryDecision];

    expect(isDecidedAs(decisions, shared, { choice: 'source' })).toBe(true);
    expect(isDecidedAs(decisions, shared, { choice: 'destination' })).toBe(false);
    expect(isDecidedAs(decisions, assets, { choice: 'rename', newName: 'assets-main' })).toBe(true);
    expect(isDecidedAs(decisions, assets, { choice: 'rename', newName: 'assets-2' })).toBe(false);
    expect(isDecidedAs([], shared, { choice: 'source' })).toBe(false);
  });
});

describe('nextOfSameKind', () => {
  const deleted = (path: string, itemId: number): DirectoryConflict => ({ ...conflictAt(path, itemId), type: 'changeDelete' });
  const docs = conflictAt('/docs', 32);
  const tests = deleted('/tests', 33);
  const ordered = [assets, tests, shared, docs];

  it('names the undecided conflicts of the same kind after it, in the order the list shows them', () => {
    expect(nextOfSameKind(ordered, assets, new Map())).toEqual([shared, docs]);
    expect(nextOfSameKind(ordered, shared, new Map())).toEqual([docs]);
    expect(nextOfSameKind(ordered, docs, new Map())).toEqual([]);
  });

  it('leaves out those decided already, and finds the conflict by its identity', () => {
    expect(nextOfSameKind(ordered, { ...assets }, resolutionsByConflict([keepYours(shared)]))).toEqual([docs]);
  });

  it('names none for a conflict the list no longer shows', () => {
    expect(nextOfSameKind(ordered, conflictAt('/gone', 99), new Map())).toEqual([]);
  });
});

describe('withDecisionAndNext', () => {
  it('decides the next conflicts the same way, after the one decided', () => {
    expect(withDecisionAndNext([keepYours(shared)], assets, { choice: 'source' }, [shared])).toEqual([keepIncoming(shared), keepIncoming(assets)]);
    expect(withDecisionAndNext([], assets, { choice: 'destination' }, [shared])).toEqual([keepYours(assets), keepYours(shared)]);
  });

  it('never keeps both for the next ones: each needs a name of its own', () => {
    expect(withDecisionAndNext([], assets, { choice: 'rename', newName: 'assets-main' }, [shared])).toEqual([{ conflict: assets, resolution: { choice: 'rename', newName: 'assets-main' } }]);
  });
});

describe('applyToNextLabel', () => {
  it('counts the next conflicts of the same kind', () => {
    expect(applyToNextLabel(1)).toBe('Do the same for the next conflict of this kind');
    expect(applyToNextLabel(3)).toBe('Do the same for the next 3 conflicts of this kind');
  });
});

describe('changesDecisions', () => {
  it('changes nothing deciding a conflict again as it is decided, unless the next ones are decided with it', () => {
    expect(changesDecisions([keepYours(assets)], assets, { choice: 'destination' }, [])).toBe(false);
    expect(changesDecisions([keepYours(assets)], assets, { choice: 'destination' }, [shared])).toBe(true);
    expect(changesDecisions([keepYours(assets)], assets, { choice: 'source' }, [])).toBe(true);
  });

  it('ignores the next ones for Keep both, which decides only its own conflict', () => {
    const asMain = { choice: 'rename', newName: 'assets-main' } as const;
    expect(changesDecisions([{ conflict: assets, resolution: asMain }], assets, asMain, [shared])).toBe(false);
  });
});

describe('applyToNextBox', () => {
  it('is not offered when no next conflict of the kind waits', () => {
    expect(applyToNextBox(0, 'source', true)).toBeUndefined();
  });

  it('offers the next conflicts with the choice the user is making, as the user left it', () => {
    expect(applyToNextBox(2, undefined, false)).toEqual({ label: 'Do the same for the next 2 conflicts of this kind', checked: false, disabled: false });
    expect(applyToNextBox(2, 'destination', true)).toEqual({ label: 'Do the same for the next 2 conflicts of this kind', checked: true, disabled: false });
  });

  it('is off and disabled while Keep both is picked: the name it gives belongs to one item', () => {
    expect(applyToNextBox(1, 'rename', true)).toEqual({ label: 'Do the same for the next conflict of this kind', checked: false, disabled: true });
  });
});

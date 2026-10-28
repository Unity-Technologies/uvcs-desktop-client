import { describe, expect, it } from 'vitest';
import type { DirectoryConflict, DirectoryDecision } from '@shared/domain/merge';
import { canKeepBothAs, droppedDecisions, droppedDecisionsToast, isDecidedAs, pickedChoice, resolutionsByConflict, withDecision } from './directoryDecisions';

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

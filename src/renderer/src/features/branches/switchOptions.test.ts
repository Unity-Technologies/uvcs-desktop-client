import { describe, expect, it } from 'vitest';
import type { SwitchPreflight } from '@shared/domain/switchWithChanges';
import { createBranchButton, newBranchSwitch, planSwitch, switchButton, switchNotes } from './switchOptions';

const preflight: SwitchPreflight = {
  sourceName: '/main/t1',
  pendingCount: 4,
  privateCount: 0,
  unchangedCheckoutsOnly: false,
  inMerge: false,
  lockedPaths: [],
  leftShelveCount: 0,
};

describe('planSwitch', () => {
  it('just switches without pending changes or with only unchanged checkouts', () => {
    expect(planSwitch({ ...preflight, pendingCount: 0, privateCount: 3 }, 'ask', 'switch')).toEqual({ kind: 'plain' });
    expect(planSwitch({ ...preflight, unchangedCheckoutsOnly: true }, 'ask', 'switch')).toEqual({ kind: 'plain' });
  });

  it('asks, preselecting the flow’s default', () => {
    const plan = planSwitch(preflight, 'ask', 'switch');
    expect(plan).toMatchObject({ kind: 'ask', choice: { leave: { enabled: true }, bring: { enabled: true }, defaultAction: 'leave' } });
    expect(planSwitch(preflight, 'ask', 'newBranch')).toMatchObject({ choice: { defaultAction: 'bring' } });
  });

  it('follows the setting when it is possible', () => {
    expect(planSwitch(preflight, 'bring', 'switch')).toEqual({ kind: 'automatic', action: 'bring' });
    expect(planSwitch({ ...preflight, bringDisabledReason: 'label' }, 'bring', 'switch')).toMatchObject({ kind: 'ask', choice: { defaultAction: 'leave' } });
  });

  it('explains why changes can’t come along, and falls back to leaving them', () => {
    const plan = planSwitch({ ...preflight, bringDisabledReason: 'label' }, 'ask', 'newBranch');
    expect(plan).toMatchObject({ kind: 'ask', choice: { bring: { enabled: false }, defaultAction: 'leave' } });
    if (plan.kind === 'ask') expect(plan.choice.bring.disabledReason).toMatch(/fixed snapshot/);
  });

  it('offers nothing when neither option is possible', () => {
    const plan = planSwitch({ ...preflight, bringDisabledReason: 'shelve', leaveDisabledReason: 'shelveSource' }, 'leave', 'switch');
    expect(plan).toMatchObject({ kind: 'ask', choice: { defaultAction: null } });
  });

  it('blocks the switch during a merge', () => {
    expect(planSwitch({ ...preflight, inMerge: true }, 'leave', 'switch')).toMatchObject({
      kind: 'blockedByMerge',
      choice: { leave: { enabled: false }, bring: { enabled: false }, defaultAction: null },
    });
  });

  it('notes private files, locks and older left changes', () => {
    expect(switchNotes({ ...preflight, privateCount: 1, lockedPaths: ['a.png', 'b.png'], leftShelveCount: 1 }, 'leave')).toEqual([
      '1 private file isn’t shelved: it stays in the folder.',
      'Your locks on 2 files are released while the changes are shelved.',
      'You already left changes on t1. They stay; leaving these makes another shelve next to them.',
    ]);
  });

  it('offers undoing the changes, never preselected', () => {
    expect(planSwitch(preflight, 'ask', 'switch')).toMatchObject({ kind: 'ask', choice: { discard: { enabled: true }, defaultAction: 'leave' } });
    expect(planSwitch(preflight, 'ask', 'newBranch')).toMatchObject({ kind: 'ask', choice: { discard: { enabled: true }, defaultAction: 'bring' } });
    // Where neither shelving option is possible, undoing them is still the user's to pick.
    const stuck = planSwitch({ ...preflight, bringDisabledReason: 'shelve', leaveDisabledReason: 'shelveSource' }, 'ask', 'switch');
    expect(stuck).toMatchObject({ kind: 'ask', choice: { discard: { enabled: true }, defaultAction: null } });
  });

  it('blocks undoing the changes during a merge too', () => {
    expect(planSwitch({ ...preflight, inMerge: true }, 'ask', 'switch')).toMatchObject({ kind: 'blockedByMerge', choice: { discard: { enabled: false } } });
  });
});

describe('switchNotes', () => {
  const everything: SwitchPreflight = { ...preflight, privateCount: 2, lockedPaths: ['a.png'], leftShelveCount: 1 };

  it('has nothing to say about a workspace with only changes', () => {
    expect(switchNotes(preflight, 'leave')).toEqual([]);
  });

  it('speaks of shelving while nothing is chosen yet', () => {
    expect(switchNotes(everything, null)).toEqual(switchNotes(everything, 'leave'));
  });

  it('mentions another shelve only when leaving these changes too', () => {
    expect(switchNotes(everything, 'bring')).toEqual([
      '2 private files aren’t shelved: they stay in the folder.',
      'Your locks on 1 file are released while the changes are shelved.',
      'You already left changes on t1. They stay.',
    ]);
  });

  it('shelves nothing when undoing the changes, and releases the locks for good', () => {
    expect(switchNotes(everything, 'discard')).toEqual([
      '2 private files stay in the folder.',
      'Your locks on 1 file are released.',
      'You already left changes on t1. They stay.',
    ]);
    expect(switchNotes({ ...everything, privateCount: 1 }, 'discard')[0]).toBe('1 private file stays in the folder.');
  });
});

describe('newBranchSwitch', () => {
  const created = { label: 'Create branch', variant: 'primary' };
  const pendingWith = (overrides: Partial<SwitchPreflight> = {}) => {
    const changes = { ...preflight, ...overrides };
    return { preflight: changes, plan: planSwitch(changes, 'ask', 'newBranch') };
  };

  it('asks about the pending changes, with Review changes, when switching to the new branch', () => {
    const pending = pendingWith();
    const asked = newBranchSwitch(true, pending, 'discard');
    expect(asked.question).toEqual({ choice: pending.plan.kind === 'ask' ? pending.plan.choice : null, preflight: pending.preflight });
    expect(asked).toMatchObject({ blockedByMerge: false, button: { label: 'Create & undo changes', variant: 'danger' } });
  });

  it('asks nothing when not switching, even with Undo chosen before', () => {
    expect(newBranchSwitch(false, pendingWith(), 'discard')).toEqual({ question: null, blockedByMerge: false, button: created });
  });

  it('asks nothing until the workspace was read, nor when the setting or nothing pending decides', () => {
    expect(newBranchSwitch(true, undefined, null)).toEqual({ question: null, blockedByMerge: false, button: created });
    expect(newBranchSwitch(true, { preflight, plan: { kind: 'automatic', action: 'bring' } }, 'bring')).toEqual({ question: null, blockedByMerge: false, button: created });
    expect(newBranchSwitch(true, { preflight, plan: { kind: 'plain' } }, null)).toEqual({ question: null, blockedByMerge: false, button: created });
  });

  it('stays put during a merge: no question, no Review changes, a plain Create branch', () => {
    expect(newBranchSwitch(true, pendingWith({ inMerge: true }), 'discard')).toEqual({ question: null, blockedByMerge: true, button: created });
  });
});

describe('createBranchButton', () => {
  it('says the changes are undone, in red, only when switching to the new branch undoes them', () => {
    expect(createBranchButton('discard', true)).toEqual({ label: 'Create & undo changes', variant: 'danger' });
    expect(createBranchButton('discard', false)).toEqual({ label: 'Create branch', variant: 'primary' });
    expect(createBranchButton('bring', true)).toEqual({ label: 'Create branch', variant: 'primary' });
    expect(createBranchButton(null, true)).toEqual({ label: 'Create branch', variant: 'primary' });
  });
});

describe('switchButton', () => {
  it('says the changes are undone, in red, only when that is the choice', () => {
    expect(switchButton('discard')).toEqual({ label: 'Undo & switch', variant: 'danger' });
    expect(switchButton('leave')).toEqual({ label: 'Switch', variant: 'primary' });
    expect(switchButton('bring')).toEqual({ label: 'Switch', variant: 'primary' });
    expect(switchButton(null)).toEqual({ label: 'Switch', variant: 'primary' });
  });
});

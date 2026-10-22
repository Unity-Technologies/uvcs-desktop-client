import { describe, expect, it } from 'vitest';
import type { SwitchPreflight } from '@shared/domain/switchWithChanges';
import { planSwitch, switchButton } from './switchOptions';

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
    expect(plan).toMatchObject({ kind: 'ask', choice: { leave: { enabled: true }, bring: { enabled: true }, defaultAction: 'leave', notes: [] } });
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
    const plan = planSwitch({ ...preflight, privateCount: 1, lockedPaths: ['a.png', 'b.png'], leftShelveCount: 1 }, 'ask', 'switch');
    expect(plan.kind === 'ask' && plan.choice.notes).toEqual([
      '1 private file isn’t shelved: it stays in the folder.',
      'Your locks on 2 files are released while the changes are shelved.',
      'You already left changes on t1. They stay; leaving these makes another shelve next to them.',
    ]);
  });

  it('offers undoing the changes when switching, never preselected', () => {
    expect(planSwitch(preflight, 'ask', 'switch')).toMatchObject({ kind: 'ask', choice: { discard: { enabled: true }, defaultAction: 'leave' } });
    // Where neither shelving option is possible, undoing them is still the user's to pick.
    const stuck = planSwitch({ ...preflight, bringDisabledReason: 'shelve', leaveDisabledReason: 'shelveSource' }, 'ask', 'switch');
    expect(stuck).toMatchObject({ kind: 'ask', choice: { discard: { enabled: true }, defaultAction: null } });
  });

  it('never offers undoing the changes for a new branch, made to carry on with them', () => {
    const plan = planSwitch(preflight, 'ask', 'newBranch');
    expect(plan.kind === 'ask' && plan.choice.discard).toBeUndefined();
  });

  it('blocks undoing the changes during a merge too', () => {
    expect(planSwitch({ ...preflight, inMerge: true }, 'ask', 'switch')).toMatchObject({ kind: 'blockedByMerge', choice: { discard: { enabled: false } } });
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

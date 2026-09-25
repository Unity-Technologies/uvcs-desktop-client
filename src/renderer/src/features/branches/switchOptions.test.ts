import { describe, expect, it } from 'vitest';
import type { SwitchPreflight } from '@shared/domain/switchWithChanges';
import { planSwitch } from './switchOptions';

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
    expect(planSwitch({ ...preflight, pendingCount: 0, privateCount: 3 }, 'ask', 'leave')).toEqual({ kind: 'plain' });
    expect(planSwitch({ ...preflight, unchangedCheckoutsOnly: true }, 'ask', 'leave')).toEqual({ kind: 'plain' });
  });

  it('asks, preselecting the flow’s default', () => {
    const plan = planSwitch(preflight, 'ask', 'leave');
    expect(plan).toMatchObject({ kind: 'ask', choice: { leave: { enabled: true }, bring: { enabled: true }, defaultAction: 'leave', notes: [] } });
    expect(planSwitch(preflight, 'ask', 'bring')).toMatchObject({ choice: { defaultAction: 'bring' } });
  });

  it('follows the setting when it is possible', () => {
    expect(planSwitch(preflight, 'bring', 'leave')).toEqual({ kind: 'automatic', action: 'bring' });
    expect(planSwitch({ ...preflight, bringDisabledReason: 'label' }, 'bring', 'leave')).toMatchObject({ kind: 'ask', choice: { defaultAction: 'leave' } });
  });

  it('explains why changes can’t come along, and falls back to leaving them', () => {
    const plan = planSwitch({ ...preflight, bringDisabledReason: 'label' }, 'ask', 'bring');
    expect(plan).toMatchObject({ kind: 'ask', choice: { bring: { enabled: false }, defaultAction: 'leave' } });
    if (plan.kind === 'ask') expect(plan.choice.bring.disabledReason).toMatch(/fixed snapshot/);
  });

  it('offers nothing when neither option is possible', () => {
    const plan = planSwitch({ ...preflight, bringDisabledReason: 'shelve', leaveDisabledReason: 'shelveSource' }, 'leave', 'leave');
    expect(plan).toMatchObject({ kind: 'ask', choice: { defaultAction: null } });
  });

  it('blocks the switch during a merge', () => {
    expect(planSwitch({ ...preflight, inMerge: true }, 'leave', 'leave')).toMatchObject({
      kind: 'blockedByMerge',
      choice: { leave: { enabled: false }, bring: { enabled: false }, defaultAction: null },
    });
  });

  it('notes private files, locks and older left changes', () => {
    const plan = planSwitch({ ...preflight, privateCount: 1, lockedPaths: ['a.png', 'b.png'], leftShelveCount: 1 }, 'ask', 'leave');
    expect(plan.kind === 'ask' && plan.choice.notes).toEqual([
      '1 private file isn’t shelved: it stays in the folder.',
      'Your locks on 2 files are released while the changes are shelved.',
      'You already left changes on /main/t1. They stay; leaving these makes another shelve next to them.',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { mergePageStateOf } from './mergePageState';

const plan = (status: MergePlan['status']) => ({ status }) as MergePlan;
const RULE = "Cannot perform the merge because of the Merge Rules. Branch '/main/task1' needs an open merge request to '/main'.";

describe('mergePageStateOf', () => {
  it('says what happened once merged, whatever else is known', () => {
    expect(mergePageStateOf({ completed: true, isLoading: false, error: null, plan: plan('ready') })).toEqual({ kind: 'completed' });
  });

  it('is calculating while the preview is read', () => {
    expect(mergePageStateOf({ completed: false, isLoading: true, error: null, plan: undefined })).toEqual({ kind: 'calculating' });
  });

  it("explains a merge rule's refusal, and shows any other failure as cm says it", () => {
    expect(mergePageStateOf({ completed: false, isLoading: false, error: new Error(RULE), plan: undefined })).toEqual({
      kind: 'refused',
      refusal: { rule: 'needsMergeRequest', source: '/main/task1', destination: '/main' },
    });
    expect(mergePageStateOf({ completed: false, isLoading: false, error: new Error('The server is down'), plan: undefined })).toEqual({ kind: 'failed' });
    expect(mergePageStateOf({ completed: false, isLoading: false, error: null, plan: undefined })).toEqual({ kind: 'failed' });
  });

  it("says why a plan can't be merged, and is ready otherwise", () => {
    expect(mergePageStateOf({ completed: false, isLoading: false, error: null, plan: plan('alreadyMerged') })).toEqual({ kind: 'notPossible', plan: plan('alreadyMerged') });
    expect(mergePageStateOf({ completed: false, isLoading: false, error: null, plan: plan('ready') })).toEqual({ kind: 'ready', plan: plan('ready') });
  });
});

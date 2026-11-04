import { describe, expect, it } from 'vitest';
import { changeNavigatorView, type NavigatorFacts } from './changeNavigatorView';

/** A text diff with 12 changes beside a list of files, none current yet: the first move goes to its first. */
const textBeforeStepping: NavigatorFacts = { stepsOwn: true, count: 12, current: null, noun: 'change', previous: 'file', next: 'step', besideFiles: true, hostSteps: true };
/** A diff with no changes of its own to step through, beside a list: one loading, failed, identical, binary, an image, a model. */
const noStepsOfItsOwn: NavigatorFacts = { stepsOwn: false, count: 0, current: null, noun: 'change', previous: 'file', next: 'file', besideFiles: true, hostSteps: true };

describe('changeNavigatorView', () => {
  it('says nothing of a text diff before a change is current; the arrows carry the count', () => {
    expect(changeNavigatorView(textBeforeStepping)).toEqual({
      label: '',
      previous: { tip: "Previous file's last change", enabled: true },
      next: { tip: 'Next change · 12 in this file', enabled: true },
    });
  });

  it('says which change is current once one is, in one form only', () => {
    const onAChange = { ...textBeforeStepping, current: 2, previous: 'step', next: 'step' } as const;
    expect(changeNavigatorView(onAChange)).toEqual({
      label: '3 of 12',
      previous: { tip: 'Previous change · 12 in this file', enabled: true },
      next: { tip: 'Next change · 12 in this file', enabled: true },
    });
  });

  it("goes on to the file beside it past the last change, to that file's first", () => {
    const onTheLast = { ...textBeforeStepping, current: 11, previous: 'step', next: 'file' } as const;
    expect(changeNavigatorView(onTheLast)?.next).toEqual({ tip: "Next file's first change", enabled: true });
  });

  it('goes from file to file, with no label, where the diff has no changes of its own: loading, identical, binary, image, model, failed', () => {
    expect(changeNavigatorView(noStepsOfItsOwn)).toEqual({
      label: '',
      previous: { tip: 'Previous file', enabled: true },
      next: { tip: 'Next file', enabled: true },
    });
  });

  it('keeps the arrows, disabled, at the first and last file of the list: they never come and go', () => {
    expect(changeNavigatorView({ ...noStepsOfItsOwn, previous: null, next: null })).toEqual({
      label: '',
      previous: { tip: 'Previous file', enabled: false },
      next: { tip: 'Next file', enabled: false },
    });
  });

  it('says nothing of a text diff without changes either (whitespace ignored): the diff itself says so', () => {
    expect(changeNavigatorView({ ...textBeforeStepping, count: 0, previous: 'file', next: 'file' })).toEqual({
      label: '',
      previous: { tip: 'Previous file', enabled: true },
      next: { tip: 'Next file', enabled: true },
    });
  });

  it("keeps the arrows, disabled, on an image or binary in a view with no list of files that steps through changes (History, Files): they never come and go there either", () => {
    expect(changeNavigatorView({ ...noStepsOfItsOwn, besideFiles: false, previous: null, next: null })).toEqual({
      label: '',
      previous: { tip: 'Previous change', enabled: false },
      next: { tip: 'Next change', enabled: false },
    });
  });

  it("draws no arrows at all where the view doesn't step through its diff's changes and lists no files (a merge page's diff with its own conflict arrows)", () => {
    expect(changeNavigatorView({ ...noStepsOfItsOwn, hostSteps: false, besideFiles: false, previous: null, next: null })).toBeNull();
    expect(changeNavigatorView({ ...textBeforeStepping, hostSteps: false, besideFiles: false, previous: null, next: null })).toBeNull();
  });

  it('steps through the changes of a diff with no list beside it', () => {
    const alone = { ...textBeforeStepping, besideFiles: false, current: 0, previous: null, next: 'step' } as const;
    expect(changeNavigatorView(alone)).toEqual({
      label: '1 of 12',
      previous: { tip: 'Previous change · 12 in this file', enabled: false },
      next: { tip: 'Next change · 12 in this file', enabled: true },
    });
  });

  it('keeps a merged file\'s conflict arrows, disabled, with no conflict left and nowhere to go: they never come and go', () => {
    const nothingLeft = { ...textBeforeStepping, count: 0, noun: 'conflict', besideFiles: false, previous: null, next: null } as const;
    expect(changeNavigatorView(nothingLeft)).toEqual({
      label: '',
      previous: { tip: 'Previous conflict', enabled: false },
      next: { tip: 'Next conflict', enabled: false },
    });
  });

  it('keeps both arrows enabled with a neutral tip while presses wait for the file being read, wherever it sits in the list', () => {
    const queued = { ...noStepsOfItsOwn, previous: 'queued', next: 'queued' } as const;
    expect(changeNavigatorView(queued)).toEqual({
      label: '',
      previous: { tip: 'Previous change', enabled: true },
      next: { tip: 'Next change', enabled: true },
    });
  });

  it("names the merge page's steps by its noun", () => {
    const conflicts = { ...textBeforeStepping, count: 3, current: 0, noun: 'conflict', previous: 'file', next: 'step' } as const;
    expect(changeNavigatorView(conflicts)).toEqual({
      label: '1 of 3',
      previous: { tip: "Previous file's last conflict", enabled: true },
      next: { tip: 'Next conflict · 3 in this file', enabled: true },
    });
  });
});

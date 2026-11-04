import { describe, expect, it } from 'vitest';
import { changeNavigatorView, type NavigatorFacts } from './changeNavigatorView';

/** A text diff with 12 changes beside a list of files, none moved to yet. */
const textWithChanges: NavigatorFacts = { stepsOwn: true, count: 12, label: '12 changes', noun: 'change', previous: null, next: 'step', besideFiles: true };
/** What has no changes of its own to step through (identical text, a binary, an image, a model, a diff loading), beside a list. */
const nothingToStep: NavigatorFacts = { stepsOwn: false, count: 0, label: 'No changes', noun: 'change', previous: 'file', next: 'file', besideFiles: true };

describe('changeNavigatorView', () => {
  it("shows a text diff's place among its changes, the arrows going to them", () => {
    expect(changeNavigatorView(textWithChanges)).toEqual({
      label: '12 changes',
      previous: { tip: 'Previous change', enabled: false },
      next: { tip: 'Next change', enabled: true },
    });
  });

  it('goes on to the file beside it past the first or last change', () => {
    const atLast = { ...textWithChanges, label: '12 of 12', previous: 'step', next: 'file' } as const;
    expect(changeNavigatorView(atLast)?.next).toEqual({ tip: "Next file's first change", enabled: true });
  });

  it('keeps the arrows for what has no changes to step through, beside a list: they go from file to file, with no label', () => {
    expect(changeNavigatorView(nothingToStep)).toEqual({
      label: '',
      previous: { tip: 'Previous file', enabled: true },
      next: { tip: 'Next file', enabled: true },
    });
  });

  it('keeps them, disabled, at the first or last file of the list: the slot never comes and goes', () => {
    expect(changeNavigatorView({ ...nothingToStep, previous: null, next: null })).toEqual({
      label: '',
      previous: { tip: 'Previous file', enabled: false },
      next: { tip: 'Next file', enabled: false },
    });
  });

  it('says a text diff stepping through its changes has none', () => {
    expect(changeNavigatorView({ ...textWithChanges, count: 0, label: 'No changes', previous: 'file', next: 'file' })?.label).toBe('No changes');
  });

  it('shows no arrows with no list of files and nothing to step through (a diff on its own)', () => {
    expect(changeNavigatorView({ ...nothingToStep, besideFiles: false, previous: null, next: null })).toBeNull();
  });

  it('steps through the changes of a diff with no list beside it', () => {
    expect(changeNavigatorView({ ...textWithChanges, besideFiles: false })?.label).toBe('12 changes');
  });

  it("names the merge page's steps by its noun", () => {
    const conflicts = { ...textWithChanges, count: 3, label: '1 of 3', noun: 'conflict', previous: 'file', next: 'step' } as const;
    expect(changeNavigatorView(conflicts)?.previous.tip).toBe("Previous file's last conflict");
  });
});

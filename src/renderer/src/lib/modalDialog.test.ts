import { describe, expect, it } from 'vitest';
import { escapeTakenBy, isInModalDialog, isModalDialogOpen, keysReach, windowShortcutMayRun } from './modalDialog';

/** A document holding the elements matching the given selectors. */
const documentWith = (...present: string[]) => ({ querySelector: (selector: string) => (present.includes(selector) ? ({} as Element) : null) });

const noDialog = documentWith();
const dialog = documentWith('[data-modal-dialog]');

describe('windowShortcutMayRun', () => {
  it('runs a shortcut pressed with nothing in the way', () => {
    expect(windowShortcutMayRun({ repeat: false }, noDialog)).toBe(true);
  });

  it('runs it once per press: a held key repeats nothing', () => {
    expect(windowShortcutMayRun({ repeat: true }, noDialog)).toBe(false);
  });

  it('leaves the keys to a modal dialog while one is open', () => {
    expect(isModalDialogOpen(dialog)).toBe(true);
    expect(windowShortcutMayRun({ repeat: false }, dialog)).toBe(false);
  });
});

describe('isInModalDialog', () => {
  it('tells an element inside one of the app’s dialogs', () => {
    const within = { closest: (selector: string) => (selector === '[data-modal-dialog]' ? ({} as Element) : null) };
    const outside = { closest: () => null };
    expect(isInModalDialog(within)).toBe(true);
    expect(isInModalDialog(outside)).toBe(false);
    expect(isInModalDialog(null)).toBe(false);
  });
});

describe('keysReach', () => {
  const within = { closest: (selector: string) => (selector === '[data-modal-dialog]' ? ({} as Element) : null) };
  const outside = { closest: () => null };

  it('reaches anything while no dialog is open', () => {
    expect(keysReach(outside, noDialog)).toBe(true);
  });

  it('reaches only what is inside the open dialog: a diff in it steps, the one behind it waits', () => {
    expect(keysReach(within, dialog)).toBe(true);
    expect(keysReach(outside, dialog)).toBe(false);
    expect(keysReach(null, dialog)).toBe(false);
  });
});

describe('escapeTakenBy', () => {
  const element = (takes: boolean) => ({ closest: (selector: string) => (takes && selector === '[data-takes-escape]' ? {} : null) }) as unknown as Element;

  it('leaves Esc to an element that takes it itself, so its dialog stays open', () => {
    expect(escapeTakenBy(element(true))).toBe(true);
  });

  it('leaves Esc to the dialog anywhere else', () => {
    expect(escapeTakenBy(element(false))).toBe(false);
    expect(escapeTakenBy(null)).toBe(false);
  });
});

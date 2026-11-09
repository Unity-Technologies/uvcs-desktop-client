import { describe, expect, it } from 'vitest';
import { isInModalDialog, isModalDialogOpen, windowShortcutMayRun } from './modalDialog';

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

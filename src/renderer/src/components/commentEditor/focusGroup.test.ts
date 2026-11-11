import { describe, expect, it } from 'vitest';
import { blurOutcome, caretAfterMove, focusLeavesGroup, focusModeFields, groupMove } from './focusGroup';
import { withinText } from './fieldSelection';

const at = { atEnd: false, onFirstLine: false };

describe('focusModeFields', () => {
  it('opens the check-in’s summary and description together, every other comment alone', () => {
    expect(focusModeFields('checkin')).toEqual(['summary', 'description']);
    expect(focusModeFields('single')).toEqual(['description']);
  });
});

describe('groupMove', () => {
  it('goes from the summary to the description’s start with Tab, or ↓ at the summary’s end', () => {
    expect(groupMove('summary', 'Tab', at)).toEqual({ to: 'description', caret: 'start' });
    expect(groupMove('summary', 'ArrowDown', { ...at, atEnd: true })).toEqual({ to: 'description', caret: 'start' });
    expect(groupMove('summary', 'ArrowDown', at)).toBeNull();
  });

  it('goes back to the summary’s end with ↑ on the description’s first line; ⇧Tab outdents there instead', () => {
    expect(groupMove('description', 'ShiftTab', at)).toBeNull();
    expect(groupMove('description', 'ArrowUp', { ...at, onFirstLine: true })).toEqual({ to: 'summary', caret: 'end' });
    expect(groupMove('description', 'ArrowUp', at)).toBeNull();
  });

  it('leaves the other keys their usual way out', () => {
    expect(groupMove('summary', 'ShiftTab', at)).toBeNull();
    expect(groupMove('description', 'Tab', at)).toBeNull();
    expect(groupMove('description', 'ArrowDown', { ...at, atEnd: true })).toBeNull();
  });
});

describe('focusLeavesGroup', () => {
  const inGroup = { inside: true, inMenu: false };
  it('stays open while the focus moves within the group or into a menu it opened (Recent comments)', () => {
    expect(focusLeavesGroup(inGroup)).toBe(false);
    expect(focusLeavesGroup({ inside: false, inMenu: true })).toBe(false);
  });

  it('closes as the focus goes anywhere else', () => {
    expect(focusLeavesGroup({ inside: false, inMenu: false })).toBe(true);
  });
});

describe('caretAfterMove', () => {
  const caret = { anchor: 5, head: 5 };

  it('takes the caret and selection it had, going in and coming back', () => {
    expect(caretAfterMove({ opening: true, selection: caret })).toEqual(caret);
    expect(caretAfterMove({ opening: false, selection: { anchor: 8, head: 2 } })).toEqual({ anchor: 8, head: 2 });
  });

  it("opened with no caret in it (its button), takes the focus at the text's end", () => {
    const end = caretAfterMove({ opening: true, selection: null });
    expect(end && withinText(end, 12)).toEqual({ anchor: 12, head: 12 });
  });

  it('closed with no caret in it (the focus gone elsewhere), leaves the focus where it went', () => {
    expect(caretAfterMove({ opening: false, selection: null })).toBeNull();
  });
});

describe('blurOutcome', () => {
  it('closes as the focus goes out of the group, but not into a menu it opened', () => {
    expect(blurOutcome({ inside: false, inMenu: false })).toBe('close');
    expect(blurOutcome({ inside: false, inMenu: true })).toBe('stay');
    expect(blurOutcome({ inside: true, inMenu: false })).toBe('stay');
  });

  it('going nowhere (the window left, or an editor made anew as the panel moved), looks again a frame later', () => {
    expect(blurOutcome(null)).toBe('nextFrame');
  });
});

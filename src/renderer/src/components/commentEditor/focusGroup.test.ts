import { describe, expect, it } from 'vitest';
import { focusLeavesGroup, focusModeFields, groupMove } from './focusGroup';

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

  it('closes as the focus goes anywhere else, or nowhere', () => {
    expect(focusLeavesGroup({ inside: false, inMenu: false })).toBe(true);
    expect(focusLeavesGroup(null)).toBe(true);
  });
});
